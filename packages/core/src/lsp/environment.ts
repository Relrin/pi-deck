import { spawn } from "node:child_process";
import type { LanguageServerDef } from "./server-defs.js";
import { deckPathToUri, type LspMapping, parseWslRoot, toPosixPath } from "./uri.js";

/**
 * Where a project's language servers run and how to find/launch them there. Projects rooted at
 * a WSL UNC share (`\\wsl.localhost\<distro>\...`) get servers spawned *inside* the distro via
 * `wsl.exe` — a Windows-native server pointed at the 9P mount would be slow and fragile.
 * Everything else runs on the local machine.
 *
 * Detection is async on purpose: probing PATH (and especially `wsl.exe`, ~seconds per call)
 * with `spawnSync` would stall the host event loop and every in-flight command with it.
 *
 * Kept as mostly-pure helpers with injectable deps so detection / launch building can be
 * unit-tested without touching PATH or `wsl.exe` (same pattern as `terminal/shells.ts`).
 */

export interface LspEnvironment {
  mapping: LspMapping;
  /** POSIX-normalised deck path of the project root. */
  deckRoot: string;
  /** `file://` URI of the root as the server sees it (guest-form for WSL). */
  rootUri: string;
}

/** Classify a project root into its server environment. Null when no URI can represent it. */
export function environmentForRoot(projectRoot: string): LspEnvironment | null {
  const deckRoot = toPosixPath(projectRoot);
  const wsl = parseWslRoot(deckRoot);
  const mapping: LspMapping = wsl ? { kind: "wsl", distro: wsl.distro } : { kind: "local" };
  const rootUri = deckPathToUri(deckRoot, mapping);
  if (!rootUri) return null;
  return { mapping, deckRoot, rootUri };
}

export interface LspDetectionDeps {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  /** First PATH resolution of a bare command (`where` / `which`), or null. */
  whichLocal: (command: string) => Promise<string | null>;
  /** True when the command resolves inside the distro (login shell, so profile PATH applies). */
  existsInWsl: (distro: string, command: string) => Promise<boolean>;
}

/** Run a probe command, swallowing every failure mode into a non-zero status. */
function runProbe(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ status: number | null; stdout: string }> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      resolve({ status: null, stdout: "" });
      return;
    }
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // Already gone.
      }
    }, timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ status: null, stdout: "" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ status: code, stdout: Buffer.concat(chunks).toString("utf8") });
    });
  });
}

function defaultWhichLocal(platform: NodeJS.Platform): (command: string) => Promise<string | null> {
  return async (command: string) => {
    if (!command) return null;
    const res = await runProbe(platform === "win32" ? "where" : "which", [command], 5000);
    if (res.status !== 0 || !res.stdout) return null;
    // `where` lists every match, one per line — the first is what the shell would run.
    const first = res.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return first ?? null;
  };
}

async function defaultExistsInWsl(distro: string, command: string): Promise<boolean> {
  const res = await runProbe(
    "wsl.exe",
    ["-d", distro, "--", "sh", "-lc", `command -v ${command}`],
    10_000,
  );
  return res.status === 0;
}

function resolveDeps(partial: Partial<LspDetectionDeps>): LspDetectionDeps {
  const platform = partial.platform ?? process.platform;
  return {
    platform,
    env: partial.env ?? process.env,
    whichLocal: partial.whichLocal ?? defaultWhichLocal(platform),
    existsInWsl: partial.existsInWsl ?? defaultExistsInWsl,
  };
}

export interface ServerAvailability {
  available: boolean;
  /** Absolute path on the local PATH; the bare command for WSL (resolution happens in-guest). */
  resolvedCommand: string | null;
}

/**
 * Module-level cache for zero-dependency (production) detection — the installed-server set is
 * stable for an app run, and probing PATH / `wsl.exe` on every file open would add latency.
 * Caching the promise also dedupes concurrent probes for the same command.
 * `lsp.status { refresh: true }` clears it so the settings UI can re-detect after an install.
 */
const detectionCache = new Map<string, Promise<ServerAvailability>>();

export function clearLspDetectionCache(): void {
  detectionCache.clear();
}

function envCacheKey(mapping: LspMapping): string {
  return mapping.kind === "wsl" ? `wsl:${mapping.distro}` : "local";
}

/** Whether (and where) a server's command exists in the given environment. */
export function detectServer(
  def: LanguageServerDef,
  mapping: LspMapping,
  partial: Partial<LspDetectionDeps> = {},
): Promise<ServerAvailability> {
  const useCache = Object.keys(partial).length === 0;
  const cacheKey = `${envCacheKey(mapping)}:${def.command}`;
  if (useCache) {
    const hit = detectionCache.get(cacheKey);
    if (hit) return hit;
  }
  const deps = resolveDeps(partial);
  const probe = (async (): Promise<ServerAvailability> => {
    if (mapping.kind === "wsl") {
      return {
        available: await deps.existsInWsl(mapping.distro, def.command),
        resolvedCommand: def.command,
      };
    }
    const resolved = await deps.whichLocal(def.command);
    return { available: resolved !== null, resolvedCommand: resolved };
  })();
  if (useCache) detectionCache.set(cacheKey, probe);
  return probe;
}

export interface ServerLaunch {
  command: string;
  args: string[];
  windowsVerbatimArguments?: boolean;
}

/** Build the spawn invocation for a server in its environment, or null when it's missing. */
export async function buildServerLaunch(
  def: LanguageServerDef,
  mapping: LspMapping,
  partial: Partial<LspDetectionDeps> = {},
): Promise<ServerLaunch | null> {
  const deps = resolveDeps(partial);
  const detected = await detectServer(def, mapping, partial);
  if (!detected.available) return null;

  if (mapping.kind === "wsl") {
    // Login shell so the spawn PATH matches what detection saw (nvm / cargo bins are added by
    // profile scripts). `exec` keeps the server as the shell's process, not a child of it.
    const cmdline = [def.command, ...def.args].join(" ");
    return {
      command: "wsl.exe",
      args: ["-d", mapping.distro, "--", "sh", "-lc", `exec ${cmdline}`],
    };
  }

  const resolved = detected.resolvedCommand ?? def.command;
  if (deps.platform === "win32" && /\.(cmd|bat)$/i.test(resolved)) {
    // npm global installs are cmd shims; CreateProcess can't exec those directly. The
    // cross-spawn formula: cmd /d /s /c with the whole quoted command line as one verbatim arg.
    const line = [`"${resolved}"`, ...def.args].join(" ");
    return {
      command: deps.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", `"${line}"`],
      windowsVerbatimArguments: true,
    };
  }
  return { command: resolved, args: [...def.args] };
}
