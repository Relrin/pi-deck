export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "auth-failed";

export interface WsClientOptions {
  url: string;
  token: string;
  onStatusChange?: (status: ConnectionStatus) => void;
  onEvent?: (topic: string, payload: unknown) => void;
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
}

const MAX_RETRY_DELAY_MS = 5_000;

export class WsClient {
  private ws: WebSocket | undefined;
  private status: ConnectionStatus = "idle";
  private readonly pending = new Map<string, PendingRequest>();
  private nextId = 1;
  private retryAttempt = 0;
  private closed = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  /** Callers waiting for the socket to enter OPEN. Resolved on `open`, rejected on `close`. */
  private openWaiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

  constructor(private readonly opts: WsClientOptions) {}

  connect(): void {
    if (this.closed) return;
    this.setStatus("connecting");
    const ws = new WebSocket(this.opts.url, this.opts.token);
    this.ws = ws;

    // Each handler captures the local `ws` and bails if a later `connect()` already abandoned
    // this socket. Without this guard, a late `open` event from a stale WS can flip status to
    // "connected" while `this.ws` already points to a newer socket still in CONNECTING.
    ws.addEventListener("open", () => {
      if (this.ws !== ws) return;
      this.retryAttempt = 0;
      this.setStatus("connected");
      const queued = this.openWaiters;
      this.openWaiters = [];
      for (const waiter of queued) waiter.resolve();
    });

    ws.addEventListener("message", (ev) => {
      if (this.ws !== ws) return;
      this.handleMessage(typeof ev.data === "string" ? ev.data : "");
    });

    ws.addEventListener("close", (ev) => {
      if (this.ws !== ws) return;
      if (ev.code === 4401) {
        this.setStatus("auth-failed");
        this.closed = true;
        this.failOpenWaiters(new Error("WebSocket auth failed"));
        return;
      }
      this.setStatus("disconnected");
      for (const pending of this.pending.values()) {
        pending.reject(new Error("WebSocket closed before response"));
      }
      this.pending.clear();
      this.failOpenWaiters(new Error("WebSocket closed before opening"));
      if (!this.closed) this.scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      // close handler will fire after this; nothing to do here.
    });
  }

  close(): void {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close(1000, "Client closing");
    this.ws = undefined;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  async request<T = unknown>(cmd: string, payload: unknown, timeoutMs = 30_000): Promise<T> {
    // If the socket is still mid-handshake, wait briefly rather than failing outright. Callers
    // that fire right after `setStatus("connected")` can otherwise race the actual readyState
    // transition (or be tripped up by a stale event from an abandoned socket).
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      try {
        await this.waitForOpen(2_000);
      } catch {
        // Fall through to the readyState check below; produces the same error message.
      }
    }
    return new Promise<T>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error(`Cannot send '${cmd}' — not connected (status: ${this.status})`));
        return;
      }
      const id = `r${this.nextId++}`;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request '${cmd}' timed out after ${timeoutMs}ms`));
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
      this.ws.send(JSON.stringify({ kind: "request", id, cmd, payload }));
    });
  }

  /** Resolve when the current socket reaches OPEN; reject on close or timeout. */
  private waitForOpen(timeoutMs: number): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.openWaiters.findIndex((w) => w.resolve === wrappedResolve);
        if (idx >= 0) this.openWaiters.splice(idx, 1);
        reject(new Error(`Timed out waiting for WebSocket open after ${timeoutMs}ms`));
      }, timeoutMs);
      const wrappedResolve = () => {
        clearTimeout(timer);
        resolve();
      };
      const wrappedReject = (err: Error) => {
        clearTimeout(timer);
        reject(err);
      };
      this.openWaiters.push({ resolve: wrappedResolve, reject: wrappedReject });
    });
  }

  private failOpenWaiters(err: Error): void {
    const queued = this.openWaiters;
    this.openWaiters = [];
    for (const waiter of queued) waiter.reject(err);
  }

  private setStatus(next: ConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.opts.onStatusChange?.(next);
  }

  private scheduleReconnect(): void {
    const delay = Math.min(MAX_RETRY_DELAY_MS, 500 * 2 ** this.retryAttempt);
    this.retryAttempt++;
    this.retryTimer = setTimeout(() => {
      if (!this.closed) this.connect();
    }, delay);
  }

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
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
      else pending.reject(new Error(r.error?.message ?? "Host returned an error"));
      return;
    }
    if (frame.kind === "event") {
      const e = parsed as { topic: string; payload: unknown };
      this.opts.onEvent?.(e.topic, e.payload);
    }
  }
}
