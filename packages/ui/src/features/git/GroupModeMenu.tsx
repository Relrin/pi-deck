import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { ChevronsUpDown } from "../../components/icons/index.js";
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

const OPTIONS: readonly OptionDef[] = [
  { value: "file", label: "File", description: "one row per file (default)" },
  { value: "hunk", label: "Hunk", description: "expand each file into its hunks" },
  { value: "change", label: "Change type", description: "added · modified · deleted" },
  { value: "folder", label: "Folder", description: "group by parent directory" },
];

const TRIGGER_LABEL: Record<GroupMode, string> = {
  file: "file",
  hunk: "hunk",
  change: "change type",
  folder: "folder",
};

export function GroupModeMenu({ mode, onChange }: Props) {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="pid-git-group-trigger"
          aria-label="Group changes by"
          data-non-default={mode === "file" ? undefined : true}
        >
          <ChevronsUpDown size={11} aria-hidden />
          <span className="pid-git-group-trigger-label">
            group: <span className="pid-git-group-trigger-value">{TRIGGER_LABEL[mode]}</span>
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
          <div className="pid-git-group-menu-header">Group changes by</div>
          <RadixDropdown.RadioGroup
            value={mode}
            onValueChange={(value) => onChange(value as GroupMode)}
          >
            {OPTIONS.map((opt) => (
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
