import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import type { ComponentType } from "react";
import {
  Check,
  CheckCheck,
  ChevronDown,
  Map as MapIcon,
  ShieldCheck,
  Sparkles,
} from "../../../components/icons/index.js";
import { useI18nContext } from "../../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../../i18n/i18n-types.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";
import { type ExecutionMode, useComposerStore } from "./useComposerStore.js";

interface ModeEntry {
  value: ExecutionMode;
  label: string;
  blurb: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}

/**
 * Built per render — a module constant would freeze the launch locale. `value` is the
 * `ExecutionMode` protocol value and stays an identifier.
 */
export function modeEntries(t: TranslationFunctions): ModeEntry[] {
  const copy = t.chat.modeMenu;
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

export function SessionAgentModePicker() {
  const { LL } = useI18nContext();
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const mode = useComposerStore((s) => s.getMode(activeSessionId));
  const setMode = useComposerStore((s) => s.setMode);
  const modes = modeEntries(LL);
  const active = modes.find((m) => m.value === mode) ?? (modes[0] as ModeEntry);
  const ActiveIcon = active.Icon;

  // No active session = nothing to gate. Render disabled so the button doesn't dangle as a
  // tease — the intro composer uses a different mode store (useIntroComposerStore) anyway.
  const disabled = !activeSessionId;

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="pid-picker-trigger"
          aria-label={LL.chat.modeMenu.ariaLabel()}
          disabled={disabled}
        >
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
          <div className="pid-picker-menu-header">{LL.chat.modeMenu.header()}</div>
          {modes.map((m) => {
            const isActive = m.value === mode;
            const ModeIcon = m.Icon;
            return (
              <RadixDropdown.Item
                key={m.value}
                onSelect={() => {
                  if (!activeSessionId) return;
                  void setMode(activeSessionId, m.value);
                }}
                className="pid-picker-menu-item pid-picker-mode-item"
                data-active={isActive || undefined}
              >
                <span className="pid-picker-menu-item-check" aria-hidden>
                  <ModeIcon size={14} />
                </span>
                <span className="pid-picker-mode-body">
                  <span className="pid-picker-menu-item-label">{m.label}</span>
                  <span className="pid-picker-mode-blurb">{m.blurb}</span>
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
