import type { Transport } from "@codemirror/lsp-client";
import type { ProtocolClient } from "../../../lib/transport/protocol-client.js";

/**
 * `@codemirror/lsp-client` Transport over the host's LSP passthrough.
 *
 * Outgoing JSON-RPC strings are unpacked into `lsp.request` / `lsp.notify` commands (the WS
 * protocol already does correlation, so the JSON-RPC id only travels along for `$/cancelRequest`
 * matching host-side). Responses are re-fabricated as JSON-RPC strings for the client. Incoming
 * server traffic arrives via the `lsp.message` / `lsp.diagnostics` events, which the event
 * router feeds into the per-key hub here.
 *
 * Responses the client tries to send (replies to server→client requests) are dropped — the host
 * answers those itself and never forwards them.
 */

interface JsonRpcOutgoing {
  id?: string | number;
  method?: string;
  params?: unknown;
}

class LspWsTransport implements Transport {
  private readonly handlers = new Set<(value: string) => void>();

  constructor(
    private readonly client: ProtocolClient,
    private readonly key: string,
  ) {}

  send(message: string): void {
    let parsed: JsonRpcOutgoing;
    try {
      parsed = JSON.parse(message) as JsonRpcOutgoing;
    } catch {
      return;
    }
    const { id, method, params } = parsed;
    if (method && id !== undefined) {
      void this.client
        .call("lsp.request", { key: this.key, method, params, clientRequestId: id })
        .then(
          (res) => {
            if (res.error) this.deliver({ jsonrpc: "2.0", id, error: res.error });
            else this.deliver({ jsonrpc: "2.0", id, result: res.result ?? null });
          },
          (err: unknown) => {
            // Transport / router failure (server gone, method rejected) — surface as a
            // JSON-RPC error so the client's pending request settles instead of timing out.
            const msg = err instanceof Error ? err.message : String(err);
            this.deliver({ jsonrpc: "2.0", id, error: { code: -32099, message: msg } });
          },
        );
      return;
    }
    if (method) {
      void this.client.call("lsp.notify", { key: this.key, method, params }).catch(() => {
        // Notifications are fire-and-forget by contract; a failed didChange will surface
        // through the next request's error instead.
      });
    }
    // No method → a response to a server→client request. The host answered it already.
  }

  subscribe(handler: (value: string) => void): void {
    this.handlers.add(handler);
  }

  unsubscribe(handler: (value: string) => void): void {
    this.handlers.delete(handler);
  }

  deliver(message: unknown): void {
    const text = JSON.stringify(message);
    for (const handler of [...this.handlers]) handler(text);
  }
}

/** Live transports by host key, so the event router can deliver server→client traffic. */
const transports = new Map<string, LspWsTransport>();

export function createLspTransport(client: ProtocolClient, key: string): Transport {
  const transport = new LspWsTransport(client, key);
  transports.set(key, transport);
  return transport;
}

export function disposeLspTransport(key: string): void {
  transports.delete(key);
}

/** Deliver a raw server→client notification (`lsp.message` event). */
export function deliverLspServerMessage(key: string, message: unknown): void {
  transports.get(key)?.deliver(message);
}

/** Re-wrap an `lsp.diagnostics` event as the publishDiagnostics notification the client expects. */
export function deliverLspDiagnostics(
  key: string,
  params: { uri: string; version?: number; diagnostics: unknown[] },
): void {
  transports.get(key)?.deliver({
    jsonrpc: "2.0",
    method: "textDocument/publishDiagnostics",
    params,
  });
}
