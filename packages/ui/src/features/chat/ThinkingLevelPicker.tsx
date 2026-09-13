import type { ThinkingLevel } from "@pi-deck/core/domain/session.js";
import type { ModelInfo } from "@pi-deck/core/providers/types.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { Check, Sparkles } from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../i18n/i18n-types.js";
import { useProvidersStore } from "../models/useProvidersStore.js";

interface ThinkingLevelPickerProps {
  sessionId: string;
  model: ModelInfo | undefined;
  level: ThinkingLevel | undefined;
}

/** Built per render — a module constant would freeze the launch locale. `id` is a protocol value. */
export function thinkingLevels(t: TranslationFunctions): { id: ThinkingLevel; label: string }[] {
  const copy = t.chat.thinkingPicker.level;
  return [
    { id: "off", label: copy.off() },
    { id: "minimal", label: copy.minimal() },
    { id: "low", label: copy.low() },
    { id: "medium", label: copy.medium() },
    { id: "high", label: copy.high() },
    { id: "xhigh", label: copy.xhigh() },
  ];
}

export function ThinkingLevelPicker({ sessionId, model, level }: ThinkingLevelPickerProps) {
  const { LL } = useI18nContext();
  const setThinkingLevel = useProvidersStore((s) => s.setSessionThinkingLevel);
  if (!model?.supportsThinking) return null;

  const allowed = new Set<ThinkingLevel>(["off", ...(model.thinkingLevels ?? [])]);
  const current = level ?? "off";

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="pid-chip"
          data-variant={current !== "off" ? "accent" : undefined}
          aria-label={LL.chat.thinkingPicker.ariaLabel({ level: current })}
        >
          <Sparkles size={10} />
          {LL.chat.thinkingPicker.chip({ level: current })}
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[10rem] rounded-[var(--radius)] bg-[var(--bg-1)] border border-[var(--line)] py-1 shadow-lg"
        >
          {thinkingLevels(LL).map((l) => {
            const enabled = allowed.has(l.id);
            const active = l.id === current;
            return (
              <RadixDropdown.Item
                key={l.id}
                disabled={!enabled}
                onSelect={() => {
                  if (enabled) void setThinkingLevel(sessionId, l.id);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer outline-none data-[highlighted]:bg-[var(--bg-2)] data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed"
                style={{ color: "var(--ink-1)" }}
              >
                <span style={{ width: 12, display: "inline-flex", color: "var(--accent)" }}>
                  {active ? <Check size={12} /> : null}
                </span>
                {l.label}
              </RadixDropdown.Item>
            );
          })}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
