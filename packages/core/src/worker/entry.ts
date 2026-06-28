import type { AgentMode, SessionModelRef, ThinkingLevel } from "../domain/session.js";
import type { ApprovalDecision } from "../extensions/agent-mode/index.js";
import { createJsonlReader, encodeJsonl } from "../host/jsonl.js";
import type { AskUserAnswer, PromptAttachment, PromptImage } from "../protocol/commands.js";
import { type AgentBridge, initBridge } from "./agent-bridge.js";
import { installLifecycleHandlers } from "./lifecycle.js";

type IncomingFrame =
  | { kind: "request"; id: string; cmd: string; payload: unknown }
  | { kind: "notify"; cmd: string; payload: unknown };

let bridge: AgentBridge | undefined;

installLifecycleHandlers(() => bridge);

function emitEvent(topic: string, payload: unknown): void {
  process.stdout.write(encodeJsonl({ kind: "event", topic, payload }));
}

function sendOk(id: string, result: unknown): void {
  process.stdout.write(encodeJsonl({ kind: "response", id, ok: true, result }));
}

function sendErr(id: string, code: string, message: string): void {
  process.stdout.write(encodeJsonl({ kind: "response", id, ok: false, error: { code, message } }));
}

async function handleRequest(frame: { id: string; cmd: string; payload: unknown }): Promise<void> {
  try {
    switch (frame.cmd) {
      case "init": {
        const params = frame.payload as {
          projectPath: string;
          sessionFile?: string;
          modelRef?: SessionModelRef;
          thinkingLevel?: ThinkingLevel;
          agentMode?: AgentMode;
          excludedTools?: string[];
        };
        bridge = await initBridge(params, emitEvent);
        sendOk(frame.id, { sessionId: bridge.sessionId, sessionFile: bridge.sessionFile });
        return;
      }
      case "prompt": {
        if (!bridge) throw new Error("Worker not initialized");
        const params = frame.payload as { text: string; images?: PromptImage[] };
        const result = await bridge.prompt(params.text, { images: params.images });
        sendOk(frame.id, result);
        return;
      }
      case "cancel": {
        if (!bridge) throw new Error("Worker not initialized");
        await bridge.cancel();
        sendOk(frame.id, { ok: true });
        return;
      }
      case "setModel": {
        if (!bridge) throw new Error("Worker not initialized");
        const params = frame.payload as {
          modelRef: SessionModelRef;
          thinkingLevel?: ThinkingLevel;
        };
        await bridge.setModel(params.modelRef, params.thinkingLevel);
        sendOk(frame.id, { ok: true });
        return;
      }
      case "setThinkingLevel": {
        if (!bridge) throw new Error("Worker not initialized");
        const params = frame.payload as { level: ThinkingLevel };
        bridge.setThinkingLevel(params.level);
        sendOk(frame.id, { ok: true });
        return;
      }
      case "setAgentMode": {
        if (!bridge) throw new Error("Worker not initialized");
        const params = frame.payload as { mode: AgentMode };
        bridge.setAgentMode(params.mode);
        sendOk(frame.id, { ok: true });
        return;
      }
      case "setPendingAttachments": {
        if (!bridge) throw new Error("Worker not initialized");
        const params = frame.payload as { attachments: PromptAttachment[] };
        bridge.setPendingAttachments(params.attachments);
        sendOk(frame.id, { ok: true });
        return;
      }
      case "setEditAllowlist": {
        if (!bridge) throw new Error("Worker not initialized");
        const params = frame.payload as { paths: string[] };
        bridge.setEditAllowlist(params.paths);
        sendOk(frame.id, { ok: true });
        return;
      }
      case "resolveApproval": {
        if (!bridge) throw new Error("Worker not initialized");
        const params = frame.payload as {
          approvalId: string;
          decision: ApprovalDecision;
          reason?: string;
        };
        bridge.resolveApproval(params.approvalId, params.decision, params.reason);
        sendOk(frame.id, { ok: true });
        return;
      }
      case "answerQuestion": {
        if (!bridge) throw new Error("Worker not initialized");
        const params = frame.payload as { askId: string; answer: AskUserAnswer };
        bridge.answerQuestion(params.askId, params.answer);
        sendOk(frame.id, { ok: true });
        return;
      }
      case "getHistory": {
        if (!bridge) throw new Error("Worker not initialized");
        sendOk(frame.id, bridge.getHistory());
        return;
      }
      case "commands": {
        if (!bridge) throw new Error("Worker not initialized");
        sendOk(frame.id, { commands: bridge.getCommands() });
        return;
      }
      default:
        sendErr(frame.id, "unknown_command", `Unknown worker command: ${frame.cmd}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendErr(frame.id, "handler_error", message);
  }
}

createJsonlReader(process.stdin, (line) => {
  let parsed: IncomingFrame;
  try {
    parsed = JSON.parse(line) as IncomingFrame;
  } catch (err) {
    process.stderr.write(`[worker] invalid JSON: ${(err as Error).message}\n`);
    return;
  }
  if (parsed.kind === "request") {
    void handleRequest(parsed);
  }
});

process.stdin.on("end", () => {
  // Host closed stdin: shut down gracefully.
  bridge?.dispose();
  process.exit(0);
});
