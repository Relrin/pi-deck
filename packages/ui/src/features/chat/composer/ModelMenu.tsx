import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { useEffect, useMemo, useState } from "react";
import { Check } from "../../../components/icons/index.js";
import { cn } from "../../../lib/cn.js";
import { ModelPicker } from "../../models/ModelPicker.js";
import { useProvidersStore } from "../../models/useProvidersStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";

const CONTENT_CLASSES =
  "z-50 min-w-[20rem] rounded-[var(--radius)] bg-[var(--bg-1)] border border-[var(--line)] py-1 shadow-lg";

const ITEM_CLASSES =
  "flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer outline-none data-[highlighted]:bg-[var(--bg-2)] data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed";

const LABEL_CLASSES =
  "px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)]";

/**
 * Bottom-bar selector for the active model + (when supported) the thinking effort. As of
 * plan 006 this is a thin shortcut over the per-session selection in `useProvidersStore`.
 *
 * Built-in providers' models for the active provider are listed inline for fast switches;
 * an "Open model picker…" entry reveals the full two-column picker (same as the header).
 */
export function ModelMenu() {
  const sessionId = useSessionsStore((s) => s.activeSessionId);
  const session = useSessionsStore((s) =>
    sessionId ? s.sessions.find((x) => x.id === sessionId) : undefined,
  );
  const providers = useProvidersStore((s) => s.providers);
  const modelsByProvider = useProvidersStore((s) => s.modelsByProvider);
  const sessionSelection = useProvidersStore((s) =>
    sessionId ? s.sessionSelection[sessionId] : undefined,
  );
  const refreshModels = useProvidersStore((s) => s.refreshModels);
  const setSessionModel = useProvidersStore((s) => s.setSessionModel);
  const [pickerOpen, setPickerOpen] = useState(false);

  const modelRef = sessionSelection?.modelRef ?? session?.modelRef;
  const provider = useMemo(
    () => providers.find((p) => p.id === modelRef?.providerId),
    [providers, modelRef?.providerId],
  );
  const models = provider ? modelsByProvider[provider.id] : undefined;
  const activeModel = useMemo(
    () => (modelRef ? models?.find((m) => m.id === modelRef.modelId) : undefined),
    [models, modelRef],
  );

  // Make sure the dropdown has something to show even on first open.
  useEffect(() => {
    if (provider && !models && provider.authState === "authenticated") {
      void refreshModels(provider.id);
    }
  }, [provider, models, refreshModels]);

  const triggerLabel = activeModel?.label ?? modelRef?.modelId ?? "Select model";
  const supportsThinking = activeModel?.supportsThinking ?? false;
  const thinkingLevel = sessionSelection?.thinkingLevel ?? session?.thinkingLevel;
  const triggerSuffix =
    supportsThinking && thinkingLevel && thinkingLevel !== "off" ? ` · ${thinkingLevel}` : "";

  return (
    <>
      <RadixDropdown.Root>
        <RadixDropdown.Trigger asChild>
          <button
            type="button"
            aria-label={`Model: ${triggerLabel}`}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-2 py-1 text-xs text-[var(--ink-2)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-line)]"
          >
            <span>
              {triggerLabel}
              {triggerSuffix}
            </span>
          </button>
        </RadixDropdown.Trigger>
        <RadixDropdown.Portal>
          <RadixDropdown.Content align="end" sideOffset={6} className={CONTENT_CLASSES}>
            {provider && (
              <RadixDropdown.Label className={LABEL_CLASSES}>{provider.name}</RadixDropdown.Label>
            )}
            {models && models.length > 0 ? (
              models.map((m) => {
                const active = m.id === modelRef?.modelId;
                return (
                  <RadixDropdown.Item
                    key={m.id}
                    onSelect={() => {
                      if (!sessionId) return;
                      void setSessionModel(sessionId, { providerId: m.providerId, modelId: m.id });
                    }}
                    className={cn(ITEM_CLASSES)}
                  >
                    <span className="w-3 shrink-0" style={{ color: "var(--accent)" }}>
                      {active ? <Check size={12} aria-hidden /> : null}
                    </span>
                    <span className="flex-1" style={{ color: "var(--ink-0)" }}>
                      {m.label}
                    </span>
                    {m.supportsThinking && (
                      <span className="text-[10px]" style={{ color: "var(--ink-3)" }}>
                        thinking
                      </span>
                    )}
                  </RadixDropdown.Item>
                );
              })
            ) : (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--ink-3)" }}>
                {provider
                  ? provider.authState === "authenticated"
                    ? "Loading models…"
                    : "Provider needs an API key."
                  : "No model selected — open the picker."}
              </div>
            )}
            <RadixDropdown.Separator className="my-1 h-px" style={{ background: "var(--line)" }} />
            <RadixDropdown.Item className={cn(ITEM_CLASSES)} onSelect={() => setPickerOpen(true)}>
              <span className="w-3 shrink-0" />
              <span className="flex-1" style={{ color: "var(--ink-0)" }}>
                Open model picker…
              </span>
            </RadixDropdown.Item>
          </RadixDropdown.Content>
        </RadixDropdown.Portal>
      </RadixDropdown.Root>
      <ModelPicker open={pickerOpen} onOpenChange={setPickerOpen} sessionId={sessionId} />
    </>
  );
}
