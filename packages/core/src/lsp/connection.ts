import {
  type CancellationToken,
  createMessageConnection,
  ErrorCodes,
  type MessageConnection,
  ResponseError,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node";

export interface LspConnectionHandlers {
  /** Every server & client notification (publishDiagnostics included) lands here. */
  onNotification: (method: string, params: unknown) => void;
}

/**
 * JSON-RPC plumbing for one language-server child: stdio streams in, generic request/notify
 * out. The renderer owns the LSP session semantics — this layer only moves messages and
 * answers the small set of server→client *requests* a passthrough must handle locally
 * (capability registration, configuration pulls, progress tokens), since the renderer never
 * sees those.
 */
export class LspConnection {
  private readonly conn: MessageConnection;

  constructor(
    stdin: NodeJS.WritableStream,
    stdout: NodeJS.ReadableStream,
    handlers: LspConnectionHandlers,
  ) {
    this.conn = createMessageConnection(
      new StreamMessageReader(stdout),
      new StreamMessageWriter(stdin),
    );

    this.conn.onNotification((method: string, params: unknown) => {
      handlers.onNotification(method, params);
    });

    this.conn.onRequest((method: string, params: unknown) => {
      switch (method) {
        case "client/registerCapability":
        case "client/unregisterCapability":
        case "window/workDoneProgress/create":
          return null;
        case "workspace/configuration": {
          // "No opinion" for every requested section — servers fall back to their defaults.
          const items = (params as { items?: unknown[] } | null)?.items;
          return Array.isArray(items) ? items.map(() => null) : [null];
        }
        default:
          throw new ResponseError(
            ErrorCodes.MethodNotFound,
            `pi-deck does not handle server request '${method}'`,
          );
      }
    });

    // Surfaced via the child's exit; transport-level errors here would double-report.
    this.conn.onError(() => {});
    this.conn.onClose(() => {});
    this.conn.listen();
  }

  request(method: string, params: unknown, token?: CancellationToken): Promise<unknown> {
    return this.conn.sendRequest(method, params, token);
  }

  notify(method: string, params: unknown): void {
    void this.conn.sendNotification(method, params);
  }

  dispose(): void {
    try {
      this.conn.dispose();
    } catch {
      // Streams already torn down with the process.
    }
  }
}
