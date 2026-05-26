import type { ThinkingLevel } from "@pi-deck/core/domain/session.js";
import type { ModelInfo } from "@pi-deck/core/providers/types.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { Check, Sparkles } from "../../components/icons/index.js";
import { useProvidersStore } from "../models/useProvidersStore.js";

interface ThinkingLevelPickerProps {
  sessionId: string;
  model: ModelInfo | undefined;
  level: ThinkingLevel | undefined;
}

const LEVELS: { id: ThinkingLevel; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "minimal", label: "Minimal" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "X-High" },
];

export function ThinkingLevelPicker({ sessionId, model, level }: ThinkingLevelPickerProps) {
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
          aria-label={`Thinking: ${current}`}
        >
          <Sparkles size={10} />
          thinking · {current}
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[10rem] rounded-[var(--radius)] bg-[var(--bg-1)] border border-[var(--line)] py-1 shadow-lg"
        >
          {LEVELS.map((l) => {
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
