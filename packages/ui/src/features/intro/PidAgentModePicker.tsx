import type { AgentMode } from "@pi-deck/core/domain/session.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import type { ComponentType } from "react";
import {
  Check,
  CheckCheck,
  ChevronDown,
  Map as MapIcon,
  ShieldCheck,
  Sparkles,
} from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../i18n/i18n-types.js";
import { useSessionDefaultsStore } from "../settings/useSessionDefaultsStore.js";

interface ModeEntry {
  value: AgentMode;
  label: string;
  blurb: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}

/**
 * Built per render from the catalog rather than held as a module constant: a module-level table
 * would capture whatever locale was loaded at import time and never update on a language switch.
 * `value` stays the protocol agent mode.
 *
 * Exported for `test/i18n/option-tables.test.ts`.
 */
export function agentModes(t: TranslationFunctions): ModeEntry[] {
  const copy = t.intro.agentMode;
  return [
    {
      value: "ask",
      label: copy.ask.label(),
      blurb: copy.ask.blurb(),
      Icon: ShieldCheck,
    },
    {
      value: "accept-edits",
      label: copy.acceptEdits.label(),
      blurb: copy.acceptEdits.blurb(),
      Icon: CheckCheck,
    },
    {
      value: "auto",
      label: copy.auto.label(),
      blurb: copy.auto.blurb(),
      Icon: Sparkles,
    },
    {
      value: "plan",
      label: copy.plan.label(),
      blurb: copy.plan.blurb(),
      Icon: MapIcon,
    },
  ];
}

export function PidAgentModePicker() {
  const { LL } = useI18nContext();
  const agentMode = useSessionDefaultsStore((s) => s.defaultAgentMode);
  const setAgentMode = useSessionDefaultsStore((s) => s.setDefaultAgentMode);
  const modes = agentModes(LL);
  // Fallback display when the stored mode somehow is not one of the four — matches the built-in
  // default (accept-edits) rather than plan.
  const active = modes.find((m) => m.value === agentMode) ?? modes[1] ?? modes[0];
  const ActiveIcon = active?.Icon ?? CheckCheck;

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="pid-picker-trigger"
          aria-label={LL.intro.agentMode.label()}
        >
          <ActiveIcon size={12} className="pid-picker-trigger-icon" />
          <span className="pid-picker-trigger-label">{active?.label}</span>
          <ChevronDown size={10} className="pid-picker-trigger-chev" aria-hidden />
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="start"
          side="top"
          sideOffset={6}
          className="pid-picker-menu"
          style={{ minWidth: 280 }}
        >
          <div className="pid-picker-menu-header">{LL.intro.agentMode.header()}</div>
          {modes.map((mode) => {
            const isActive = mode.value === agentMode;
            const ModeIcon = mode.Icon;
            return (
              <RadixDropdown.Item
                key={mode.value}
                onSelect={() => setAgentMode(mode.value)}
                className="pid-picker-menu-item pid-picker-mode-item"
                data-active={isActive || undefined}
              >
                <span className="pid-picker-menu-item-check" aria-hidden>
                  <ModeIcon size={14} />
                </span>
                <span className="pid-picker-mode-body">
                  <span className="pid-picker-menu-item-label">{mode.label}</span>
                  <span className="pid-picker-mode-blurb">{mode.blurb}</span>
                </span>
                <span className="pid-picker-menu-item-sub" aria-hidden>
                  {isActive ? <Check size={12} /> : null}
                </span>
              </RadixDropdown.Item>
            );
          })}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
