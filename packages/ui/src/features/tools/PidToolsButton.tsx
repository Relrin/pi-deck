import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { ToolCase } from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import { useIntroComposerStore } from "../intro/useIntroComposerStore.js";
import { ToolsList } from "./ToolsList.js";
import { useToolsStore } from "./useToolsStore.js";

/**
 * Intro-screen variant of the tools button. The intro composer has no live session yet,
 * so changes are staged on `useIntroComposerStore.pendingExcludedTools` and rolled into
 * the next `session.create` call. `undefined` pending = "use the global default" — flip
 * a switch and the override list starts tracking explicitly.
 */
export function PidToolsButton() {
  const { LL } = useI18nContext();
  const pendingExcludedTools = useIntroComposerStore((s) => s.pendingExcludedTools);
  const setPendingExcludedTools = useIntroComposerStore((s) => s.setPendingExcludedTools);
  const defaultExcluded = useToolsStore((s) => s.defaultExcludedTools);

  const excludedTools = pendingExcludedTools ?? defaultExcluded;
  const hasExclusions = excludedTools.length > 0;

  const onChange = (next: string[]) => {
    setPendingExcludedTools(next);
  };

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="pid-picker-trigger pid-picker-trigger-icon-only"
          aria-label={
            hasExclusions
              ? LL.tools.session.titleWithCount({ count: excludedTools.length })
              : LL.tools.session.title()
          }
          title={LL.tools.session.title()}
          data-has-exclusions={hasExclusions || undefined}
        >
          <ToolCase size={14} aria-hidden />
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="start"
          side="top"
          sideOffset={6}
          className="pid-picker-menu pid-tools-menu"
        >
          <div className="pid-picker-menu-header">{LL.tools.session.title()}</div>
          <p className="pid-tools-menu-blurb">{LL.tools.session.blurb()}</p>
          <ToolsList excludedTools={excludedTools} onChange={onChange} />
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
