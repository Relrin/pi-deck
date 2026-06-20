import type { AgentMode } from "@pi-deck/core/domain/session.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import type { ComponentType } from "react";
import {
  Check,
  CheckCheck,
  ChevronDown,
  Map as MapIcon,
  ShieldCheck,
} from "../../components/icons/index.js";
import { useSessionDefaultsStore } from "../settings/useSessionDefaultsStore.js";

interface ModeEntry {
  value: AgentMode;
  label: string;
  blurb: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}

const MODES: ModeEntry[] = [
  {
    value: "ask",
    label: "Ask",
    blurb: "Confirm before each write or shell command.",
    Icon: ShieldCheck,
  },
  {
    value: "accept-edits",
    label: "Accept edits",
    blurb: "Auto-accept edits to listed files & paths.",
    Icon: CheckCheck,
  },
  {
    value: "plan",
    label: "Plan",
    blurb: "Plan-only — no writes, no commands.",
    Icon: MapIcon,
  },
];

// Fallback display when the stored mode somehow isn't one of MODES — matches the built-in
// default (accept-edits) rather than plan.
const FALLBACK_MODE: ModeEntry = MODES[1] ?? {
  value: "accept-edits",
  label: "Accept edits",
  blurb: "Auto-accept edits to listed files & paths.",
  Icon: CheckCheck,
};

export function PidAgentModePicker() {
  const agentMode = useSessionDefaultsStore((s) => s.defaultAgentMode);
  const setAgentMode = useSessionDefaultsStore((s) => s.setDefaultAgentMode);
  const active = MODES.find((m) => m.value === agentMode) ?? FALLBACK_MODE;
  const ActiveIcon = active.Icon;

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button type="button" className="pid-picker-trigger" aria-label="Agent mode">
          <ActiveIcon size={12} className="pid-picker-trigger-icon" />
          <span className="pid-picker-trigger-label">{active.label}</span>
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
          <div className="pid-picker-menu-header">Agent mode</div>
          {MODES.map((mode) => {
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
