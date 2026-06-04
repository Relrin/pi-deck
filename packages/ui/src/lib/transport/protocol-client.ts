import type {
  CommandName,
  CommandRequest,
  CommandResponse,
} from "@pi-deck/core/protocol/commands.js";
import type { ThemeListing, ThemeSpec } from "@pi-deck/core/protocol/theme.js";
import type { WsClient } from "./ws-client.js";

/** Decisions the renderer can return from an inline `<ApprovalPill>`. */
export type ToolApprovalDecision = "allow" | "deny";

/** Modes a session can transition to when a plan is approved. */
export type ApprovePlanTargetMode = "ask" | "accept-edits";

export class ProtocolClient {
  constructor(private readonly ws: WsClient) {}

  call<C extends CommandName>(cmd: C, payload: CommandRequest<C>): Promise<CommandResponse<C>> {
    return this.ws.request(cmd, payload) as Promise<CommandResponse<C>>;
  }

  ping(): Promise<CommandResponse<"ping">> {
    return this.call("ping", {});
  }

  /**
   * Resolve a `session.tool.approval.requested` event. Wraps `session.toolApproval` so the
   * `<ApprovalPill>` doesn't have to know about the underlying RPC name.
   */
  toolApproval(
    sessionId: string,
    approvalId: string,
    decision: ToolApprovalDecision,
    reason?: string,
  ): Promise<CommandResponse<"session.toolApproval">> {
    return this.call("session.toolApproval", { sessionId, approvalId, decision, reason });
  }

  /**
   * Approve the current plan and flip the session into an executing mode. The host immediately
   * sends a continuation prompt — the renderer renders the resulting turn through the usual
   * `session.user.message` + `session.message.delta` flow, no special-case wiring needed.
   */
  approvePlan(
    sessionId: string,
    targetMode: ApprovePlanTargetMode,
    continuationText?: string,
  ): Promise<CommandResponse<"session.approvePlan">> {
    return this.call("session.approvePlan", { sessionId, targetMode, continuationText });
  }

  /**
   * Fetch the current contents of a session's plan file. Also starts the host-side watcher
   * so subsequent edits stream via `plan.file.changed`. Returns `null` content when the file
   * doesn't exist yet (e.g. before the agent's first plan-mode turn).
   */
  planFileRead(sessionId: string): Promise<CommandResponse<"plan.file.read">> {
    return this.call("plan.file.read", { sessionId });
  }

  terminal = {
    open: (req: CommandRequest<"terminal.open">): Promise<CommandResponse<"terminal.open">> =>
      this.call("terminal.open", req),
    write: (terminalId: string, dataB64: string): Promise<CommandResponse<"terminal.write">> =>
      this.call("terminal.write", { terminalId, dataB64 }),
    resize: (
      terminalId: string,
      cols: number,
      rows: number,
    ): Promise<CommandResponse<"terminal.resize">> =>
      this.call("terminal.resize", { terminalId, cols, rows }),
    close: (terminalId: string): Promise<CommandResponse<"terminal.close">> =>
      this.call("terminal.close", { terminalId }),
    list: (): Promise<CommandResponse<"terminal.list">> => this.call("terminal.list", {}),
    snapshot: (terminalId: string): Promise<CommandResponse<"terminal.snapshot">> =>
      this.call("terminal.snapshot", { terminalId }),
    detectShells: (): Promise<CommandResponse<"terminal.detectShells">> =>
      this.call("terminal.detectShells", {}),
  };

  themes = {
    list: async (): Promise<{ activeName: string; themes: ThemeListing[] }> => {
      return this.call("theme.list", {});
    },
    get: async (name: string): Promise<{ spec: ThemeSpec; vscodeRaw?: unknown }> => {
      const res = await this.call("theme.get", { name });
      return { spec: res.theme as ThemeSpec, vscodeRaw: res.vscodeRaw };
    },
    setActive: async (name: string): Promise<void> => {
      await this.call("theme.setActive", { name });
    },
    import: async (sourcePath: string): Promise<{ name: string }> => {
      const res = await this.call("theme.import", { sourcePath });
      return { name: res.name };
    },
    delete: async (name: string): Promise<void> => {
      await this.call("theme.delete", { name });
    },
  };
}
