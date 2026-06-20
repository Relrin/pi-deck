import type { PlanGatePolicy } from "@pi-deck/core/domain/session.js";
import {
  PidSegmentedPill,
  type PidSegmentedPillOption,
} from "../../../components/segmented/PidSegmentedPill.js";
import { ToolsAllOffWarning } from "../../tools/ToolsAllOffWarning.js";
import { ToolsList } from "../../tools/ToolsList.js";
import { BUILT_IN_TOOLS } from "../../tools/toolCatalog.js";
import { useToolsStore } from "../../tools/useToolsStore.js";

const PLAN_GATE_OPTIONS: PidSegmentedPillOption<PlanGatePolicy>[] = [
  {
    value: "approve",
    label: "Ask for approval",
    description: "Prompt to allow or deny each non-read-only operation while planning.",
  },
  {
    value: "block",
    label: "Always block",
    description: "Refuse every non-read-only operation while planning (strict plan-only).",
  },
];

export function ToolsSection() {
  const defaultExcludedTools = useToolsStore((s) => s.defaultExcludedTools);
  const setDefaultExcludedTools = useToolsStore((s) => s.setDefaultExcludedTools);
  const planGatePolicy = useToolsStore((s) => s.planGatePolicy);
  const setPlanGatePolicy = useToolsStore((s) => s.setPlanGatePolicy);

  const allOff = defaultExcludedTools.length === BUILT_IN_TOOLS.length;

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">Settings · Tools</div>
        <h1 className="pid-settings-section-title">Tools</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">Plan mode</div>
        <p className="pid-settings-block-desc">
          What plan mode does when the agent reaches for something that isn't a read-only inspection
          - an edit, an MCP or network call, or a workspace-changing shell command. Read-only
          commands (ls, cat, grep, find, git log, etc) always run. Applies to new conversations.
        </p>
        <PidSegmentedPill
          ariaLabel="Plan mode policy"
          value={planGatePolicy}
          options={PLAN_GATE_OPTIONS}
          onChange={setPlanGatePolicy}
        />
      </section>

      <section className="pid-settings-block pid-tools-settings-block">
        <div className="pid-settings-block-label">Disabled tools</div>
        <p className="pid-settings-block-desc pid-tools-settings-blurb">
          Disable tools you don't want the agent to use. This applies to new sessions; existing
          sessions keep their own setting.
        </p>
        <ToolsList excludedTools={defaultExcludedTools} onChange={setDefaultExcludedTools} />
        {allOff && <ToolsAllOffWarning />}
      </section>
    </div>
  );
}
