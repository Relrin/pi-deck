import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { ChevronsUpDown } from "../../components/icons/index.js";
import { type DiffThemeOption, labelForDiffTheme } from "./diffThemes.js";

interface DiffThemePickerProps {
  value: string;
  options: readonly DiffThemeOption[];
  onChange: (name: string) => void;
  ariaLabel: string;
}

/**
 * Compact dropdown for picking a Pierre/Shiki theme by name. Two of these mount
 * inside the Settings → Git & GitHub "Diff themes" section — one for the light
 * theme, one for the dark — each driving the matching preview card.
 *
 * Reuses the visual language of `GroupModeMenu` (the existing trigger button
 * style + Radix DropdownMenu portal) so the picker feels native to the app.
 */
export function DiffThemePicker({ value, options, onChange, ariaLabel }: DiffThemePickerProps) {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button type="button" className="pid-diff-theme-trigger" aria-label={ariaLabel}>
          <span className="pid-diff-theme-trigger-label">{labelForDiffTheme(options, value)}</span>
          <ChevronsUpDown size={11} aria-hidden />
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="start"
          side="bottom"
          sideOffset={6}
          className="pid-diff-theme-menu"
        >
          <RadixDropdown.RadioGroup value={value} onValueChange={onChange}>
            {options.map((opt) => (
              <RadixDropdown.RadioItem
                key={opt.name}
                value={opt.name}
                className="pid-diff-theme-menu-item"
                data-active={opt.name === value || undefined}
              >
                <span className="pid-diff-theme-menu-dot" aria-hidden />
                <span className="pid-diff-theme-menu-label">{opt.label}</span>
                <span className="pid-diff-theme-menu-name">{opt.name}</span>
              </RadixDropdown.RadioItem>
            ))}
          </RadixDropdown.RadioGroup>
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
