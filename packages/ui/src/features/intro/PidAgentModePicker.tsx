import type { AgentMode } from "@pi-deck/core/domain/session.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import type { ComponentType } from "react";
import { Check, Map as MapIcon, ShieldCheck, SquareCheck } from "../../components/icons/index.js";
import { useIntroComposerStore } from "./useIntroComposerStore.js";

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
    Icon: SquareCheck,
  },
  {
    value: "plan",
    label: "Plan",
    blurb: "Plan-only — no writes, no commands.",
    Icon: MapIcon,
  },
];

const PLAN_MODE: ModeEntry = MODES[2] ?? {
  value: "plan",
  label: "Plan",
  blurb: "Plan-only — no writes, no commands.",
  Icon: MapIcon,
};

export function PidAgentModePicker() {
  const agentMode = useIntroComposerStore((s) => s.agentMode);
  const setAgentMode = useIntroComposerStore((s) => s.setAgentMode);
  const active = MODES.find((m) => m.value === agentMode) ?? PLAN_MODE;
  const ActiveIcon = active.Icon;

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button type="button" className="pid-picker-trigger" aria-label="Agent mode">
          <ActiveIcon size={12} className="pid-picker-trigger-icon" />
          <span className="pid-picker-trigger-label">{active.label}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25}
            className="pid-picker-trigger-chev"
            aria-hidden
          >
            <title>chevron</title>
            <path d="M3.5 5.5 L7 9 L10.5 5.5" />
          </svg>
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="start"
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
