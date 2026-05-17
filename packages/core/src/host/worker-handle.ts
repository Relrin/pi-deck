import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import treeKill from "tree-kill";
import { createJsonlReader, encodeJsonl } from "./jsonl.js";

export interface WorkerSpawnOptions {
  workerEntry: string;
  execPath: string;
  execArgv: string[];
  env: NodeJS.ProcessEnv;
  cwd?: string;
}

export type WorkerHandleEvents = {
  event: [topic: string, payload: unknown];
  exit: [code: number | null, signal: NodeJS.Signals | null];
  error: [err: Error];
};

type PendingRequest = {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
};

export class WorkerHandle extends EventEmitter<WorkerHandleEvents> {
  private readonly child: ChildProcess;
  private readonly pending = new Map<string, PendingRequest>();
  private nextRequestId = 1;
  private exited = false;

  constructor(opts: WorkerSpawnOptions) {
    super();
    this.child = spawn(opts.execPath, [...opts.execArgv, opts.workerEntry], {
      env: opts.env,
      cwd: opts.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    if (!this.child.stdout || !this.child.stdin || !this.child.stderr) {
      throw new Error("Failed to open worker stdio pipes");
    }

    createJsonlReader(this.child.stdout, (line) => this.handleLine(line));

    this.child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      // Forward stderr to host stderr for debugging visibility.
      process.stderr.write(`[worker ${this.child.pid}] ${text}`);
    });

    this.child.on("exit", (code, signal) => {
      this.exited = true;
      for (const pending of this.pending.values()) {
        pending.reject(new Error("Worker exited before responding"));
      }
      this.pending.clear();
      this.emit("exit", code, signal);
    });

    this.child.on("error", (err) => {
      this.emit("error", err);
    });
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  get isAlive(): boolean {
    return !this.exited;
  }

  request<T = unknown>(cmd: string, payload: unknown, timeoutMs = 60_000): Promise<T> {
    if (this.exited) {
      return Promise.reject(new Error("Worker has exited"));
    }
    const id = `w${this.nextRequestId++}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Worker request '${cmd}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result as T);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.writeFrame({ kind: "request", id, cmd, payload });
    });
  }

  notify(cmd: string, payload: unknown): void {
    if (this.exited) return;
    this.writeFrame({ kind: "notify", cmd, payload });
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): void {
    if (this.exited) return;
    const pid = this.child.pid;
    if (!pid) {
      this.child.kill(signal);
      return;
    }
    // Windows child processes survive parent death by default and don't share a
    // POSIX process group, so a plain `child.kill()` leaks any descendants the
    // worker spawned. tree-kill shells out to `taskkill /F /T` on Windows and
    // walks /proc on POSIX to take down the whole subtree.
    treeKill(pid, signal, (err) => {
      if (err && !this.exited) {
        try {
          this.child.kill(signal);
        } catch {
          // Process already gone.
        }
      }
    });
  }

  private writeFrame(frame: unknown): void {
    if (!this.child.stdin || this.child.stdin.destroyed) return;
    this.child.stdin.write(encodeJsonl(frame));
  }

  private handleLine(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      process.stderr.write(
        `[host] worker ${this.child.pid} emitted invalid JSON: ${(err as Error).message}\n`,
      );
      return;
    }

    const frame = parsed as { kind?: string };
    if (frame.kind === "response") {
      const r = parsed as {
        id: string;
        ok: boolean;
        result?: unknown;
        error?: { code: string; message: string };
      };
      const pending = this.pending.get(r.id);
      if (!pending) return;
      this.pending.delete(r.id);
      if (r.ok) pending.resolve(r.result);
      else pending.reject(new Error(r.error?.message ?? "Worker error"));
      return;
    }
    if (frame.kind === "event") {
      const e = parsed as { topic: string; payload: unknown };
      this.emit("event", e.topic, e.payload);
      return;
    }
  }
}
