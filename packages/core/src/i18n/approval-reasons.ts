/**
 * Structured approval reasons.
 *
 * Every string the agent layer produces is read by exactly one audience, and that decides its
 * language. This file covers the half the **user** reads.
 *
 * An `approve` decision becomes a `session.tool.approval.requested` event and is rendered on the
 * approval pill in `ToolCallCard`. It never reaches the model. So it travels as a stable `code`
 * plus params and is translated in the renderer, in the *interface* language.
 *
 * The other half — `block`, deny and timeout reasons — becomes the tool *result*. Those are
 * model-only "do not retry" instructions, they stay plain English strings, and they are
 * deliberately not represented here.
 *
 * `fallback` carries the English text so logs stay readable and a renderer that does not know a
 * newer code still shows something sensible instead of a blank pill.
 */
export interface ApprovalReason {
  /** Stable identifier the renderer maps to a catalog key. Never shown to anyone. */
  code: ApprovalReasonCode;
  /** Interpolation values, pre-formatted. Only `auto.mcpTool` uses one today. */
  params?: Readonly<Record<string, string>>;
  /** English text. A log line and a last resort, not the primary UI copy. */
  fallback: string;
}

export const APPROVAL_REASON_CODES = [
  // Plan mode
  "plan.shellNotReadOnly",
  "plan.mutatingOperation",
  // accept-edits mode
  "acceptEdits.outsideAllowlist",
  // Auto mode — MCP
  "auto.mcpTool",
  // Auto mode — shell shapes
  "auto.forkBomb",
  "auto.blockDeviceRedirect",
  "auto.recursiveDelete",
  "auto.windowsDelete",
  "auto.filesystemDestroy",
  "auto.deviceWrite",
  "auto.permissionSweep",
  "auto.privilegeEscalation",
  "auto.powerControl",
  "auto.killAll",
  "auto.rawNetwork",
  "auto.upload",
  "auto.remoteCopy",
  "auto.secretOverNetwork",
  "auto.pipeToShell",
  // Auto mode — write shapes
  "auto.writeSecret",
  "auto.writeGitDir",
  "auto.writeOutsideProject",
] as const;

export type ApprovalReasonCode = (typeof APPROVAL_REASON_CODES)[number];

/** Terse constructor so the rule engines stay readable. */
export function approvalReason(
  code: ApprovalReasonCode,
  fallback: string,
  params?: Readonly<Record<string, string>>,
): ApprovalReason {
  return params ? { code, params, fallback } : { code, fallback };
}
