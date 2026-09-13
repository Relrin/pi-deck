import type { PlanGatePolicy } from "@pi-deck/core/domain/session.js";
import {
  PidSegmentedPill,
  type PidSegmentedPillOption,
} from "../../../components/segmented/PidSegmentedPill.js";
import { useI18nContext } from "../../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../../i18n/i18n-types.js";
import { ToolsAllOffWarning } from "../../tools/ToolsAllOffWarning.js";
import { ToolsList } from "../../tools/ToolsList.js";
import { BUILT_IN_TOOLS } from "../../tools/toolCatalog.js";
import { useToolsStore } from "../../tools/useToolsStore.js";

/**
 * Built per render from the catalog — a module constant would freeze the launch locale. `value` is
 * the `PlanGatePolicy` protocol value and stays an identifier.
 */
export function planGateOptions(t: TranslationFunctions): PidSegmentedPillOption<PlanGatePolicy>[] {
  const copy = t.settings.tools.planMode;
  return [
    {
      value: "approve",
      label: copy.approve.label(),
      description: copy.approve.description(),
    },
    {
      value: "block",
      label: copy.block.label(),
      description: copy.block.description(),
    },
  ];
}

export function ToolsSection() {
  const { LL } = useI18nContext();
  const defaultExcludedTools = useToolsStore((s) => s.defaultExcludedTools);
  const setDefaultExcludedTools = useToolsStore((s) => s.setDefaultExcludedTools);
  const planGatePolicy = useToolsStore((s) => s.planGatePolicy);
  const setPlanGatePolicy = useToolsStore((s) => s.setPlanGatePolicy);

  const allOff = defaultExcludedTools.length === BUILT_IN_TOOLS.length;

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">
          {LL.settings.kicker({ section: LL.settings.tools.kicker() })}
        </div>
        <h1 className="pid-settings-section-title">{LL.settings.tools.title()}</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.tools.planMode.label()}</div>
        <p className="pid-settings-block-desc">{LL.settings.tools.planMode.desc()}</p>
        <PidSegmentedPill
          ariaLabel={LL.settings.tools.planMode.ariaLabel()}
          value={planGatePolicy}
          options={planGateOptions(LL)}
          onChange={setPlanGatePolicy}
        />
      </section>

      <section className="pid-settings-block pid-tools-settings-block">
        <div className="pid-settings-block-label">{LL.settings.tools.disabled.label()}</div>
        <p className="pid-settings-block-desc pid-tools-settings-blurb">
          {LL.settings.tools.disabled.desc()}
        </p>
        <ToolsList excludedTools={defaultExcludedTools} onChange={setDefaultExcludedTools} />
        {allOff && <ToolsAllOffWarning />}
      </section>
    </div>
  );
}
