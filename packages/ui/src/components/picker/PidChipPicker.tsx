import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { Check, ChevronDown } from "../icons/index.js";

export interface PidChipPickerOption {
  value: string;
  /** Visible label (left side). Falls back to `value` if omitted. */
  label?: string;
  /** Secondary right-aligned label (e.g. "default", "balanced", "14m"). */
  sub?: ReactNode;
  /** Disable selecting this option (but still render it). */
  disabled?: boolean;
}

export interface PidChipPickerFooterAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}

export interface PidChipPickerProps {
  /** Trigger icon. */
  icon?: ReactNode;
  /** Replace the default trigger icon with a custom node */
  triggerLeading?: ReactNode;
  /** Override the chip's visible label; defaults to the active option's label/value. */
  triggerLabel?: string;
  /** Header text shown above the option list (e.g. "SELECT"). Defaults to "SELECT". */
  header?: string;
  value: string;
  options: PidChipPickerOption[];
  onChange: (value: string) => void;
  footerAction?: PidChipPickerFooterAction;
  disabled?: boolean;
  ariaLabel: string;
  /** Tweak the popover width to fit longer option labels. */
  minPopoverWidth?: number;
}

export function PidChipPicker({
  icon,
  triggerLeading,
  triggerLabel,
  header = "Select",
  value,
  options,
  onChange,
  footerAction,
  disabled,
  ariaLabel,
  minPopoverWidth = 260,
}: PidChipPickerProps) {
  const active = options.find((o) => o.value === value);
  const labelText = triggerLabel ?? active?.label ?? active?.value ?? value;

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild disabled={disabled}>
        <button type="button" className="pid-picker-trigger" aria-label={ariaLabel}>
          {triggerLeading === undefined ? (icon ?? null) : triggerLeading}
          <span className="pid-picker-trigger-label">{labelText}</span>
          <ChevronDown size={10} className="pid-picker-trigger-chev" />
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="start"
          side="top"
          sideOffset={6}
          className="pid-picker-menu"
          style={{ minWidth: minPopoverWidth }}
        >
          <div className="pid-picker-menu-header">{header}</div>
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <RadixDropdown.Item
                key={opt.value}
                disabled={opt.disabled}
                onSelect={() => onChange(opt.value)}
                className="pid-picker-menu-item"
                data-active={isActive || undefined}
              >
                <span className="pid-picker-menu-item-check" aria-hidden>
                  {isActive ? <Check size={12} /> : null}
                </span>
                <span className="pid-picker-menu-item-label">{opt.label ?? opt.value}</span>
                {opt.sub != null && <span className="pid-picker-menu-item-sub">{opt.sub}</span>}
              </RadixDropdown.Item>
            );
          })}
          {footerAction && (
            <>
              <RadixDropdown.Separator className="pid-picker-menu-sep" />
              <RadixDropdown.Item
                onSelect={footerAction.onSelect}
                className="pid-picker-menu-item pid-picker-menu-footer"
              >
                <span className="pid-picker-menu-item-check" aria-hidden>
                  {footerAction.icon ?? null}
                </span>
                <span className="pid-picker-menu-item-label">{footerAction.label}</span>
              </RadixDropdown.Item>
            </>
          )}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
