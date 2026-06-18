import { TriangleAlert } from "../../components/icons/index.js";

/**
 * Quiet (never error) banner shown when every built-in tool is disabled — at that point the
 * agent can only reply with text. Uses the muted `--warn`/`--mod-soft` palette so it reads as
 * a heads-up rather than a failure. Mirrors the mockup's `ToolsAllOffWarning`.
 */
export function ToolsAllOffWarning() {
  return (
    <div className="pid-tools-alloff" role="status">
      <TriangleAlert size={12} className="pid-tools-alloff-icon" aria-hidden />
      <span>
        With every tool disabled, the agent can only reply with text — it can't read or modify
        files.
      </span>
    </div>
  );
}
