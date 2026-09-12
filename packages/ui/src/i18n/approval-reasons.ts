import type { TranslationFunctions } from "./i18n-types";

/**
 * Renders an approval-pill reason in the interface language.
 *
 * The mapping is explicit rather than a path lookup so a typo is a compile error and the catalog
 * shape is free to differ from the code strings. Codes come from
 * `packages/core/src/i18n/approval-reasons.ts`; the `chat.approval.reason.*` keys mirror them.
 *
 * An unmapped code returns `undefined` and the caller falls back to the English text the host
 * sent, which is what happens when a newer host meets an older renderer.
 */
export function localizeApprovalReason(
  t: TranslationFunctions,
  code: string | undefined,
  params: Record<string, string> | undefined,
): string | undefined {
  const r = t.chat.approval.reason;
  switch (code) {
    case "plan.shellNotReadOnly":
      return r.plan.shellNotReadOnly();
    case "plan.mutatingOperation":
      return r.plan.mutatingOperation();
    case "acceptEdits.outsideAllowlist":
      return r.acceptEdits.outsideAllowlist();
    case "auto.mcpTool":
      // The only reason that interpolates. The worker has already formatted the tool name
      // (backticks included), so it passes through verbatim.
      return r.auto.mcpTool({ tool: params?.tool ?? "" });
    case "auto.forkBomb":
      return r.auto.forkBomb();
    case "auto.blockDeviceRedirect":
      return r.auto.blockDeviceRedirect();
    case "auto.recursiveDelete":
      return r.auto.recursiveDelete();
    case "auto.windowsDelete":
      return r.auto.windowsDelete();
    case "auto.filesystemDestroy":
      return r.auto.filesystemDestroy();
    case "auto.deviceWrite":
      return r.auto.deviceWrite();
    case "auto.permissionSweep":
      return r.auto.permissionSweep();
    case "auto.privilegeEscalation":
      return r.auto.privilegeEscalation();
    case "auto.powerControl":
      return r.auto.powerControl();
    case "auto.killAll":
      return r.auto.killAll();
    case "auto.rawNetwork":
      return r.auto.rawNetwork();
    case "auto.upload":
      return r.auto.upload();
    case "auto.remoteCopy":
      return r.auto.remoteCopy();
    case "auto.secretOverNetwork":
      return r.auto.secretOverNetwork();
    case "auto.pipeToShell":
      return r.auto.pipeToShell();
    case "auto.writeSecret":
      return r.auto.writeSecret();
    case "auto.writeGitDir":
      return r.auto.writeGitDir();
    case "auto.writeOutsideProject":
      return r.auto.writeOutsideProject();
    default:
      return undefined;
  }
}
