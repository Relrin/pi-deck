import { spawnSync } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";
import type { TerminalShell } from "../protocol/commands.js";

/**
 * OS-aware shell detection for the integrated terminal. Adapted from coder/mux's
 * `resolveLocalPtyShell`: enumerate platform-appropriate candidates, keep only the ones that
 * actually exist as executables, and dedupe by resolved path. `detectShells` powers the
 * Terminal settings picker; `resolveShell` picks what to actually spawn (honouring a
 * user-configured override when it's valid).
 *
 * Kept as a mostly-pure helper with injectable deps so it can be unit-tested without touching
 * the real filesystem or `process`.
 */

export interface ShellDetectionDeps {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  /** True when a bare command resolves on PATH (via `where` / `which`). */
  isOnPath: (command: string) => boolean;
  /** True when a path-like value points at an executable file. */
  isExecutableFile: (candidate: string) => boolean;
}

interface ShellCandidate {
  label: string;
  /** Absolute path or a bare command resolvable on PATH. */
  command: string;
  args: string[];
}

function isPathLike(command: string): boolean {
  return command.includes("/") || command.includes("\\");
}

/**
 * WSL surfaces POSIX paths / a bare `bash` that don't exist as real Windows executables — skip
 * them. Crucially this must NOT match a real path like `C:\Program Files\Git\bin\bash.exe`
 * (Git Bash), so only bare commands or the System32 WSL stub count.
 */
function looksLikeWslShell(shell: string): boolean {
  if (shell.startsWith("/")) return true;
  const normalized = shell.replace(/\//g, "\\").toLowerCase();
  if (normalized.endsWith("\\windows\\system32\\bash.exe")) return true;
  if (!normalized.includes("\\")) {
    return (
      normalized === "wsl" ||
      normalized === "wsl.exe" ||
      normalized === "bash" ||
      normalized === "bash.exe"
    );
  }
  return false;
}

function defaultIsOnPath(platform: NodeJS.Platform): (command: string) => boolean {
  return (command: string) => {
    if (!command) return false;
    try {
      const result = spawnSync(platform === "win32" ? "where" : "which", [command], {
        stdio: "ignore",
      });
      return result.status === 0;
    } catch {
      return false;
    }
  };
}

function defaultIsExecutableFile(candidate: string): boolean {
  try {
    if (!statSync(candidate).isFile()) return false;
    if (process.platform !== "win32") {
      accessSync(candidate, constants.X_OK);
      return true;
    }
    const ext = path.win32.extname(candidate).toLowerCase();
    if (!ext) return false;
    const pathExt = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").toLowerCase();
    return pathExt
      .split(";")
      .map((e) => e.trim())
      .includes(ext);
  } catch {
    return false;
  }
}

function basenameLabel(command: string): string {
  const base = command.replace(/\\/g, "/").split("/").pop() ?? command;
  return base.replace(/\.(exe|cmd|bat|com)$/i, "");
}

function windowsCandidates(env: NodeJS.ProcessEnv): ShellCandidate[] {
  const candidates: ShellCandidate[] = [];
  const systemRoot = env.SystemRoot || "C:\\Windows";
  candidates.push({ label: "PowerShell", command: "pwsh.exe", args: [] });
  candidates.push({
    label: "Windows PowerShell",
    command: path.win32.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    args: [],
  });
  // Git Bash — try the usual install roots; launch as an interactive login shell.
  const programRoots = [env.ProgramW6432, env.ProgramFiles, env["ProgramFiles(x86)"]].filter(
    (p): p is string => Boolean(p),
  );
  for (const root of programRoots) {
    candidates.push({
      label: "Git Bash",
      command: path.win32.join(root, "Git", "bin", "bash.exe"),
      args: ["-i", "-l"],
    });
  }
  candidates.push({ label: "Command Prompt", command: env.ComSpec || "cmd.exe", args: [] });
  return candidates;
}

function unixCandidates(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): ShellCandidate[] {
  const candidates: ShellCandidate[] = [];
  const envShell = env.SHELL?.trim();
  if (envShell) candidates.push({ label: basenameLabel(envShell), command: envShell, args: [] });
  const ordered =
    platform === "darwin"
      ? ["/bin/zsh", "/bin/bash", "/bin/sh"]
      : ["/bin/bash", "/usr/bin/zsh", "/bin/zsh", "/bin/sh"];
  for (const sh of ordered) candidates.push({ label: basenameLabel(sh), command: sh, args: [] });
  return candidates;
}

function resolveDeps(partial: Partial<ShellDetectionDeps>): ShellDetectionDeps {
  const platform = partial.platform ?? process.platform;
  return {
    platform,
    env: partial.env ?? process.env,
    isOnPath: partial.isOnPath ?? defaultIsOnPath(platform),
    isExecutableFile: partial.isExecutableFile ?? defaultIsExecutableFile,
  };
}

function isAvailable(command: string, deps: ShellDetectionDeps): boolean {
  if (!command) return false;
  if (deps.platform === "win32" && looksLikeWslShell(command)) return false;
  return isPathLike(command) ? deps.isExecutableFile(command) : deps.isOnPath(command);
}

/** Detected shells, in preference order, deduped by command. First entry is the default. */
export function detectShells(partial: Partial<ShellDetectionDeps> = {}): TerminalShell[] {
  const deps = resolveDeps(partial);
  const raw =
    deps.platform === "win32"
      ? windowsCandidates(deps.env)
      : unixCandidates(deps.platform, deps.env);
  const shells: TerminalShell[] = [];
  const seen = new Set<string>();
  for (const candidate of raw) {
    if (!isAvailable(candidate.command, deps)) continue;
    const key = candidate.command.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    shells.push({ label: candidate.label, path: candidate.command, args: candidate.args });
  }
  return shells;
}

/**
 * Pick the shell to spawn. A valid `configured` override wins; otherwise the first detected
 * shell; otherwise a platform-native last resort so we never strand the terminal.
 */
export function resolveShell(
  configured: string | undefined,
  partial: Partial<ShellDetectionDeps> = {},
): { command: string; args: string[] } {
  const deps = resolveDeps(partial);
  const detected = detectShells(partial);

  const override = configured?.trim();
  if (override) {
    const known = detected.find((s) => s.path.toLowerCase() === override.toLowerCase());
    if (known) return { command: known.path, args: known.args };
    if (isAvailable(override, deps)) return { command: override, args: [] };
  }

  const first = detected[0];
  if (first) return { command: first.path, args: first.args };

  if (deps.platform === "win32") return { command: deps.env.ComSpec || "cmd.exe", args: [] };
  if (deps.platform === "darwin") return { command: "/bin/zsh", args: [] };
  return { command: "/bin/bash", args: [] };
}
