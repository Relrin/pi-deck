import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { ChevronsUpDown } from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../i18n/i18n-types.js";
import { rich, slot } from "../../i18n/rich.js";
import type { GroupMode } from "./useGroupModeStore.js";

interface Props {
  mode: GroupMode;
  onChange: (mode: GroupMode) => void;
}

interface OptionDef {
  value: GroupMode;
  label: string;
  description: string;
}

/**
 * Built per render from the catalog rather than held as a module constant: a module-level table
 * would capture whatever locale was loaded at import time and never update on a language switch.
 * `value` stays an identifier — it is the persisted grouping mode.
 *
 * Exported for `test/i18n/option-tables.test.ts`, which calls it with a sentinel translations
 * object so a label that comes back as a literal fails there.
 */
export function groupModeOptions(t: TranslationFunctions): readonly OptionDef[] {
  const copy = t.git.groupMenu.option;
  return [
    { value: "file", label: copy.file.label(), description: copy.file.description() },
    { value: "hunk", label: copy.hunk.label(), description: copy.hunk.description() },
    { value: "change", label: copy.change.label(), description: copy.change.description() },
    { value: "folder", label: copy.folder.label(), description: copy.folder.description() },
  ];
}

/** The short form shown on the trigger, as opposed to the menu row label. */
function triggerValue(t: TranslationFunctions, mode: GroupMode): string {
  return t.git.groupMenu.option[mode].value();
}

export function GroupModeMenu({ mode, onChange }: Props) {
  const { LL } = useI18nContext();
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="pid-git-group-trigger"
          aria-label={LL.git.groupMenu.label()}
          data-non-default={mode === "file" ? undefined : true}
        >
          <ChevronsUpDown size={11} aria-hidden />
          <span className="pid-git-group-trigger-label">
            {rich(LL.git.groupMenu.trigger({ value: slot("value") }), {
              value: <span className="pid-git-group-trigger-value">{triggerValue(LL, mode)}</span>,
            })}
          </span>
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="start"
          side="bottom"
          sideOffset={6}
          className="pid-git-group-menu"
        >
          <div className="pid-git-group-menu-header">{LL.git.groupMenu.header()}</div>
          <RadixDropdown.RadioGroup
            value={mode}
            onValueChange={(value) => onChange(value as GroupMode)}
          >
            {groupModeOptions(LL).map((opt) => (
              <RadixDropdown.RadioItem
                key={opt.value}
                value={opt.value}
                className="pid-git-group-menu-item"
                data-active={opt.value === mode || undefined}
              >
                <span className="pid-git-group-menu-dot" aria-hidden />
                <span className="pid-git-group-menu-text">
                  <span className="pid-git-group-menu-label">{opt.label}</span>
                  <span className="pid-git-group-menu-sub">{opt.description}</span>
                </span>
              </RadixDropdown.RadioItem>
            ))}
          </RadixDropdown.RadioGroup>
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
