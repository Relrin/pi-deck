/**
 * Thin wrapper over node-pty. The host runs in the Electron main process (native modules are
 * fine there). We prefer `@lydell/node-pty` — it ships per-platform prebuilt N-API binaries, so
 * there's no electron-rebuild step — and fall back to upstream `node-pty` if it's present.
 *
 * Loaded lazily via a dynamic `import()` (kept ESM/CJS-agnostic so it type-checks in both the
 * core ESM project and the desktop main CommonJS project) so importing this module — e.g. for
 * types in tests — doesn't force the native binding to resolve until a terminal is opened.
 */

export interface PtyDisposable {
  dispose(): void;
}

export interface PtyProcess {
  readonly pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  pause(): void;
  resume(): void;
  onData(listener: (data: string) => void): PtyDisposable;
  onExit(
    listener: (e: { exitCode: number | null; signal: number | string | null }) => void,
  ): PtyDisposable;
}

interface NodePtyModule {
  spawn(
    file: string,
    args: string[],
    options: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: { [key: string]: string | undefined };
    },
  ): PtyProcess;
}

let cached: NodePtyModule | undefined;

/** A dynamically-imported module may expose `spawn` directly or under `default` (CJS interop). */
function pickSpawn(mod: unknown): NodePtyModule | undefined {
  const m = mod as { spawn?: unknown; default?: { spawn?: unknown } };
  const spawn = typeof m.spawn === "function" ? m.spawn : m.default?.spawn;
  return typeof spawn === "function" ? ({ spawn } as NodePtyModule) : undefined;
}

/**
 * Import by a *variable* specifier so neither `tsc` nor the bundler tries to statically resolve
 * it — the native packages are externalized and resolved from node_modules at runtime. This also
 * lets `node-pty` stay an optional runtime fallback without being a compile-time dependency.
 */
function importPty(specifier: string): Promise<unknown> {
  return import(specifier);
}

async function loadNodePty(): Promise<NodePtyModule> {
  if (cached) return cached;
  const errors: string[] = [];
  for (const specifier of ["@lydell/node-pty", "node-pty"]) {
    try {
      const mod = pickSpawn(await importPty(specifier));
      if (mod) {
        cached = mod;
        return mod;
      }
      errors.push(`${specifier}: no spawn() export`);
    } catch (err) {
      errors.push(`${specifier}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(
    `Failed to load a node-pty backend. The integrated terminal is unavailable.\n${errors.join("\n")}`,
  );
}

export interface SpawnPtyOptions {
  shell: string;
  args: string[];
  cwd: string;
  cols: number;
  rows: number;
  env?: NodeJS.ProcessEnv;
}

export async function spawnPty(opts: SpawnPtyOptions): Promise<PtyProcess> {
  const pty = await loadNodePty();
  const baseEnv = opts.env ?? process.env;
  // node-pty wants a string-valued env; carry the parent env through and force a sane TERM so
  // full-screen TUIs (vim, htop) render with colour.
  const env: { [key: string]: string | undefined } = {
    ...baseEnv,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    LANG: baseEnv.LANG || (process.platform === "darwin" ? "en_US.UTF-8" : "C.UTF-8"),
  };
  return pty.spawn(opts.shell, opts.args, {
    name: "xterm-256color",
    cols: opts.cols,
    rows: opts.rows,
    cwd: opts.cwd,
    env,
  });
}

/**
 * Kill a PTY and (on POSIX) its process group so child processes started by the shell don't
 * orphan. On Windows `kill()` rejects a signal argument and ConPTY tears down the console group.
 */
export function killPty(pty: PtyProcess): void {
  if (process.platform !== "win32") {
    try {
      process.kill(-pty.pid, "SIGTERM");
    } catch {
      // No process group / already dead — fall through to the direct kill.
    }
  }
  try {
    pty.kill();
  } catch {
    // Already exited.
  }
}
