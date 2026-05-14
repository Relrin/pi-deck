import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { Check, Sliders } from "../../../components/icons/index.js";
import { cn } from "../../../lib/cn.js";
import { type ExecutionMode, useComposerStore } from "./useComposerStore.js";

const CONTENT_CLASSES =
  "z-50 min-w-[16rem] rounded-[var(--radius-md)] bg-[var(--color-panel-2)] border border-[var(--color-border)] py-1 shadow-lg";

const ITEM_CLASSES =
  "flex items-start gap-2 px-3 py-1.5 text-sm text-[var(--color-text)] cursor-pointer outline-none data-[highlighted]:bg-[var(--color-panel-hover)]";

interface ModeEntry {
  id: ExecutionMode;
  label: string;
  description: string;
}

const MODES: readonly ModeEntry[] = [
  { id: "ask", label: "Ask permissions", description: "Confirm each edit and command." },
  {
    id: "accept-edits",
    label: "Accept edits",
    description: "Auto-apply file edits, ask on shell.",
  },
  { id: "plan", label: "Plan mode", description: "Read-only — produce a plan, no changes." },
];

const LABELS: Record<ExecutionMode, string> = {
  ask: "Ask",
  "accept-edits": "Accept edits",
  plan: "Plan",
};

/**
 * Bottom-bar selector for the agent's execution / permission posture.
 *
 * TODO(protocol): wire to pi when the SDK exposes a setter; today this only updates
 * `useComposerStore`.
 */
export function ExecutionModeMenu() {
  const mode = useComposerStore((s) => s.executionMode);
  const setMode = useComposerStore((s) => s.setMode);

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          aria-label={`Execution mode: ${LABELS[mode]}`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-panel-hover)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <Sliders size={14} aria-hidden />
          <span>{LABELS[mode]}</span>
          {/*<ChevronDown size={12} aria-hidden />*/}
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content align="start" sideOffset={6} className={CONTENT_CLASSES}>
          {MODES.map((entry) => {
            const active = entry.id === mode;
            return (
              <RadixDropdown.Item
                key={entry.id}
                onSelect={() => setMode(entry.id)}
                className={cn(ITEM_CLASSES)}
              >
                <span className="mt-0.5 w-3 shrink-0 text-[var(--color-accent)]">
                  {active ? <Check size={12} aria-hidden /> : null}
                </span>
                <span className="flex flex-col">
                  <span>{entry.label}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {entry.description}
                  </span>
                </span>
              </RadixDropdown.Item>
            );
          })}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
