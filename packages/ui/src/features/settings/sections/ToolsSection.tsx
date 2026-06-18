import { ToolsAllOffWarning } from "../../tools/ToolsAllOffWarning.js";
import { ToolsList } from "../../tools/ToolsList.js";
import { BUILT_IN_TOOLS } from "../../tools/toolCatalog.js";
import { useToolsStore } from "../../tools/useToolsStore.js";

export function ToolsSection() {
  const defaultExcludedTools = useToolsStore((s) => s.defaultExcludedTools);
  const setDefaultExcludedTools = useToolsStore((s) => s.setDefaultExcludedTools);

  const allOff = defaultExcludedTools.length === BUILT_IN_TOOLS.length;

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">Settings · Tools</div>
        <h1 className="pid-settings-section-title">Tools</h1>
      </header>
      <p className="pid-settings-block-desc pid-tools-settings-blurb">
        Disable tools you don't want the agent to use. This applies to new sessions; existing
        sessions keep their own setting.
      </p>
      <section className="pid-settings-block pid-tools-settings-block">
        <ToolsList excludedTools={defaultExcludedTools} onChange={setDefaultExcludedTools} />
        {allOff && <ToolsAllOffWarning />}
      </section>
    </div>
  );
}
