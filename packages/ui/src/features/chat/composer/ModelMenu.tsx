import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { Check } from "../../../components/icons/index.js";
import { cn } from "../../../lib/cn.js";
import {
  findModel,
  MODEL_OPTIONS,
  type ThinkingEffort,
  useComposerStore,
} from "./useComposerStore.js";

const CONTENT_CLASSES =
  "z-50 min-w-[16rem] rounded-[var(--radius-md)] bg-[var(--color-panel-2)] border border-[var(--color-border)] py-1 shadow-lg";

const ITEM_CLASSES =
  "flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text)] cursor-pointer outline-none data-[highlighted]:bg-[var(--color-panel-hover)] data-[disabled]:text-[var(--color-text-subtle)] data-[disabled]:cursor-not-allowed";

const LABEL_CLASSES =
  "px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]";

const EFFORTS: readonly { id: ThinkingEffort; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

/**
 * Bottom-bar selector for the active model + (when supported) the thinking effort.
 *
 * TODO(protocol): wire to pi when the SDK exposes a setter; today this only updates
 * `useComposerStore`.
 */
export function ModelMenu() {
  const model = useComposerStore((s) => s.model);
  const effort = useComposerStore((s) => s.thinkingEffort);
  const setModel = useComposerStore((s) => s.setModel);
  const setEffort = useComposerStore((s) => s.setEffort);

  const current = findModel(model);
  const supportsThinking = current?.supportsThinking ?? false;
  const triggerLabel =
    supportsThinking && effort !== "off"
      ? `${current?.label ?? model} · ${effort}`
      : (current?.label ?? model);

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          aria-label={`Model: ${triggerLabel}`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-panel-hover)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <span>{triggerLabel}</span>
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content align="end" sideOffset={6} className={CONTENT_CLASSES}>
          <RadixDropdown.Label className={LABEL_CLASSES}>Model</RadixDropdown.Label>
          {MODEL_OPTIONS.map((option) => {
            const active = option.id === model;
            return (
              <RadixDropdown.Item
                key={option.id}
                onSelect={() => setModel(option.id)}
                className={cn(ITEM_CLASSES)}
              >
                <span className="w-3 shrink-0 text-[var(--color-accent)]">
                  {active ? <Check size={12} aria-hidden /> : null}
                </span>
                <span className="flex-1">{option.label}</span>
                {option.supportsThinking && (
                  <span className="text-[10px] text-[var(--color-text-subtle)]">thinking</span>
                )}
              </RadixDropdown.Item>
            );
          })}
          <RadixDropdown.Separator className="my-1 h-px bg-[var(--color-border)]" />
          <RadixDropdown.Label className={LABEL_CLASSES}>Thinking effort</RadixDropdown.Label>
          {EFFORTS.map((e) => {
            const active = e.id === effort;
            return (
              <RadixDropdown.Item
                key={e.id}
                disabled={!supportsThinking}
                onSelect={() => setEffort(e.id)}
                className={cn(ITEM_CLASSES)}
              >
                <span className="w-3 shrink-0 text-[var(--color-accent)]">
                  {active ? <Check size={12} aria-hidden /> : null}
                </span>
                {e.label}
              </RadixDropdown.Item>
            );
          })}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
