import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { statSync } from "node:fs";
import type { TerminalShell, TerminalSummary } from "../protocol/commands.js";
import { EVENT_TERMINAL_EXIT, EVENT_TERMINAL_OUTPUT, type EventTopic } from "../protocol/events.js";
import { OutputRingBuffer } from "./buffer.js";
import { killPty, type PtyProcess, spawnPty } from "./pty.js";
import { detectShells, resolveShell } from "./shells.js";

export type TerminalManagerEvents = {
  event: [topic: EventTopic, payload: unknown];
};

export interface OpenTerminalParams {
  cwd: string;
  cols: number;
  rows: number;
  /** Optional shell override; falls back to the OS default when omitted. */
  shell?: string;
  shellArgs?: string[];
}

interface TerminalEntry {
  pty: PtyProcess;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  buffer: OutputRingBuffer;
  disposables: Array<{ dispose(): void }>;
  /** Output accumulated since the last flush, batched to bound event volume. */
  pending: string;
  flushTimer: ReturnType<typeof setTimeout> | undefined;
  /** PTY paused for backpressure; resumed after the next flush drains `pending`. */
  paused: boolean;
  /** Set when we paused due to the high-water mark — flagged on the next emitted chunk. */
  throttled: boolean;
  /** True once the PTY has exited or been closed; suppresses further emits. */
  done: boolean;
}

const MAX_TERMINALS = 24;
/** Batch window: coalesce PTY output into at most one event per ~8 ms (≈120 fps ceiling). */
const FLUSH_DELAY_MS = 8;
/** Pause the PTY when this many un-flushed output bytes pile up, protecting the renderer. */
const HIGH_WATER_BYTES = 1024 * 1024;

/**
 * Owns the live PTYs for the integrated terminal, one per `terminalId`. PTYs run in the host
 * (Electron main process) and are independent of pi sessions. Output is buffered (for repaint),
 * batched (for event volume), and flow-controlled (for runaway processes). Emits
 * `terminal.output` / `terminal.exit`; the host wires these to the WS broadcast.
 *
 * PTYs live for the app run only — `shutdownAll()` (called on host close) kills every shell so
 * no zombies survive the app.
 */
export class TerminalManager extends EventEmitter<TerminalManagerEvents> {
  private readonly terminals = new Map<string, TerminalEntry>();

  async open(params: OpenTerminalParams): Promise<TerminalSummary> {
    if (this.terminals.size >= MAX_TERMINALS) {
      throw new Error(`Too many open terminals (max ${MAX_TERMINALS})`);
    }
    let isDir = false;
    try {
      isDir = statSync(params.cwd).isDirectory();
    } catch {
      isDir = false;
    }
    if (!isDir) throw new Error(`Invalid working directory: ${params.cwd}`);

    const resolved = resolveShell(params.shell);
    const shell = resolved.command;
    const args = params.shellArgs ?? resolved.args;
    const cols = params.cols;
    const rows = params.rows;

    const pty = await spawnPty({ shell, args, cwd: params.cwd, cols, rows });
    const terminalId = randomUUID();
    const entry: TerminalEntry = {
      pty,
      cwd: params.cwd,
      shell,
      cols,
      rows,
      buffer: new OutputRingBuffer(),
      disposables: [],
      pending: "",
      flushTimer: undefined,
      paused: false,
      throttled: false,
      done: false,
    };
    entry.disposables.push(pty.onData((data) => this.onData(terminalId, entry, data)));
    entry.disposables.push(pty.onExit((e) => this.onExit(terminalId, entry, e)));
    this.terminals.set(terminalId, entry);
    return { terminalId, cwd: params.cwd, shell, cols, rows };
  }

  /** `data` is decoded plaintext (the router base64-decodes the wire payload). */
  write(terminalId: string, data: string): void {
    const entry = this.terminals.get(terminalId);
    if (!entry || entry.done) return;
    try {
      entry.pty.write(data);
    } catch {
      // Write after exit — ignore; the exit event already (or will) clean up.
    }
  }

  resize(terminalId: string, cols: number, rows: number): void {
    const entry = this.terminals.get(terminalId);
    if (!entry || entry.done) return;
    entry.cols = cols;
    entry.rows = rows;
    try {
      entry.pty.resize(cols, rows);
    } catch {
      // ConPTY occasionally rejects a resize during teardown — harmless.
    }
  }

  /** Explicit user close: kill + local cleanup, no exit event (the user already removed it). */
  close(terminalId: string): void {
    const entry = this.terminals.get(terminalId);
    if (!entry) return;
    entry.done = true;
    if (entry.flushTimer) clearTimeout(entry.flushTimer);
    for (const d of entry.disposables) safeDispose(d);
    this.terminals.delete(terminalId);
    killPty(entry.pty);
  }

  list(): TerminalSummary[] {
    return [...this.terminals.entries()].map(([terminalId, e]) => ({
      terminalId,
      cwd: e.cwd,
      shell: e.shell,
      cols: e.cols,
      rows: e.rows,
    }));
  }

  /** Base64 of the terminal's recent scrollback, for repainting a freshly-mounted view. */
  snapshot(terminalId: string): string {
    const entry = this.terminals.get(terminalId);
    if (!entry) return "";
    return Buffer.from(entry.buffer.snapshot(), "utf8").toString("base64");
  }

  detectShells(): { shells: TerminalShell[]; defaultPath: string | null } {
    const shells = detectShells();
    return { shells, defaultPath: shells[0]?.path ?? null };
  }

  shutdownAll(): void {
    for (const [, entry] of this.terminals) {
      entry.done = true;
      if (entry.flushTimer) clearTimeout(entry.flushTimer);
      for (const d of entry.disposables) safeDispose(d);
      killPty(entry.pty);
    }
    this.terminals.clear();
  }

  private onData(terminalId: string, entry: TerminalEntry, data: string): void {
    if (entry.done) return;
    entry.buffer.append(data);
    entry.pending += data;
    if (!entry.paused && Buffer.byteLength(entry.pending, "utf8") > HIGH_WATER_BYTES) {
      try {
        entry.pty.pause();
        entry.paused = true;
        entry.throttled = true;
      } catch {
        // Flow control unsupported — fall back to unthrottled delivery.
      }
    }
    if (entry.flushTimer) return;
    entry.flushTimer = setTimeout(() => this.flush(terminalId, entry), FLUSH_DELAY_MS);
  }

  private flush(terminalId: string, entry: TerminalEntry): void {
    entry.flushTimer = undefined;
    if (entry.done) return;
    if (entry.pending) {
      const dataB64 = Buffer.from(entry.pending, "utf8").toString("base64");
      const throttled = entry.throttled || undefined;
      entry.pending = "";
      entry.throttled = false;
      this.emit("event", EVENT_TERMINAL_OUTPUT, { terminalId, dataB64, throttled });
    }
    if (entry.paused) {
      try {
        entry.pty.resume();
      } catch {
        // Already gone.
      }
      entry.paused = false;
    }
  }

  private onExit(
    terminalId: string,
    entry: TerminalEntry,
    e: { exitCode: number | null; signal: number | string | null },
  ): void {
    if (entry.done) return;
    entry.done = true;
    if (entry.flushTimer) clearTimeout(entry.flushTimer);
    if (entry.pending) {
      const dataB64 = Buffer.from(entry.pending, "utf8").toString("base64");
      entry.pending = "";
      this.emit("event", EVENT_TERMINAL_OUTPUT, { terminalId, dataB64 });
    }
    for (const d of entry.disposables) safeDispose(d);
    this.terminals.delete(terminalId);
    this.emit("event", EVENT_TERMINAL_EXIT, {
      terminalId,
      exitCode: e.exitCode ?? null,
      signal: e.signal ?? null,
    });
  }
}

function safeDispose(d: { dispose(): void }): void {
  try {
    d.dispose();
  } catch {
    // Listener already disposed.
  }
}
