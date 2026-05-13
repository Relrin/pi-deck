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

  constructor(private readonly opts: WsClientOptions) {}

  connect(): void {
    if (this.closed) return;
    this.setStatus("connecting");
    const ws = new WebSocket(this.opts.url, this.opts.token);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.retryAttempt = 0;
      this.setStatus("connected");
    });

    ws.addEventListener("message", (ev) => {
      this.handleMessage(typeof ev.data === "string" ? ev.data : "");
    });

    ws.addEventListener("close", (ev) => {
      if (ev.code === 4401) {
        this.setStatus("auth-failed");
        this.closed = true;
        return;
      }
      this.setStatus("disconnected");
      for (const pending of this.pending.values()) {
        pending.reject(new Error("WebSocket closed before response"));
      }
      this.pending.clear();
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

  request<T = unknown>(cmd: string, payload: unknown, timeoutMs = 30_000): Promise<T> {
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
