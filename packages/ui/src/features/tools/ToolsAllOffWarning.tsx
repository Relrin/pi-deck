import { TriangleAlert } from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";

/**
 * Quiet (never error) banner shown when every built-in tool is disabled — at that point the
 * agent can only reply with text. Uses the muted `--warn`/`--mod-soft` palette so it reads as
 * a heads-up rather than a failure. Mirrors the mockup's `ToolsAllOffWarning`.
 */
export function ToolsAllOffWarning() {
  const { LL } = useI18nContext();
  return (
    <div className="pid-tools-alloff" role="status">
      <TriangleAlert size={12} className="pid-tools-alloff-icon" aria-hidden />
      <span>{LL.tools.allOffWarning()}</span>
    </div>
  );
}
