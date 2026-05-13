import { createServer, type Server as HttpServer, type IncomingMessage } from "node:http";
import { type WebSocket, WebSocketServer } from "ws";
import type { EventTopic } from "../protocol/events.js";
import { FrameSchema } from "../protocol/frames.js";
import { dispatch, type RouterContext, RouterError } from "./router.js";

export interface WsServerOptions {
  token: string;
  router: RouterContext;
}

export interface WsServerHandle {
  readonly port: number;
  broadcast: (topic: EventTopic, payload: unknown) => void;
  close: () => Promise<void>;
}

const AUTH_REJECT_CODE = 4401;

export async function startWsServer(opts: WsServerOptions): Promise<WsServerHandle> {
  const http: HttpServer = createServer((_req, res) => {
    res.statusCode = 426;
    res.setHeader("Content-Type", "text/plain");
    res.end("WebSocket only");
  });

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

  http.on("upgrade", (req, socket, head) => {
    if (!authorize(req, opts.token)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
    ws.on("message", (data) => {
      void handleMessage(ws, data.toString(), opts.router);
    });
  });

  await new Promise<void>((resolve) => {
    http.listen(0, "127.0.0.1", () => resolve());
  });

  const addr = http.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Failed to bind WebSocket server");
  }
  const port = addr.port;
  console.log(`[host] WS listening on 127.0.0.1:${port}`);

  return {
    port,
    broadcast: (topic, payload) => {
      const frame = JSON.stringify({ kind: "event", topic, payload });
      for (const ws of clients) {
        if (ws.readyState === ws.OPEN) ws.send(frame);
      }
    },
    close: async () => {
      for (const ws of clients) ws.close(1001, "Host shutdown");
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}

function authorize(req: IncomingMessage, expectedToken: string): boolean {
  const proto = req.headers["sec-websocket-protocol"];
  if (typeof proto === "string") {
    const tokens = proto.split(",").map((s) => s.trim());
    if (tokens.includes(expectedToken)) return true;
  }
  const url = req.url ?? "";
  const queryIdx = url.indexOf("?");
  if (queryIdx >= 0) {
    const params = new URLSearchParams(url.slice(queryIdx + 1));
    if (params.get("token") === expectedToken) return true;
  }
  return false;
}

async function handleMessage(ws: WebSocket, raw: string, router: RouterContext): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    sendErr(ws, "", "invalid_json", "Failed to parse JSON frame");
    return;
  }
  const frameResult = FrameSchema.safeParse(parsed);
  if (!frameResult.success) {
    sendErr(ws, "", "invalid_frame", frameResult.error.message);
    return;
  }
  const frame = frameResult.data;
  if (frame.kind !== "request") return;

  try {
    const result = await dispatch(router, frame.cmd, frame.payload);
    sendOk(ws, frame.id, result);
  } catch (err) {
    if (err instanceof RouterError) {
      sendErr(ws, frame.id, err.code, err.message);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      sendErr(ws, frame.id, "handler_error", msg);
    }
  }
}

function sendOk(ws: WebSocket, id: string, result: unknown): void {
  ws.send(JSON.stringify({ kind: "response", id, ok: true, result }));
}

function sendErr(ws: WebSocket, id: string, code: string, message: string): void {
  ws.send(JSON.stringify({ kind: "response", id, ok: false, error: { code, message } }));
}

export const AUTH_REJECT_WS_CODE = AUTH_REJECT_CODE;
