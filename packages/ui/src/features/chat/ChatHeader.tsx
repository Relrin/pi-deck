import type { SessionSummary } from "@pi-deck/core/domain/session.js";
import { useMemo, useState } from "react";
import { ModelPicker } from "../models/ModelPicker.js";
import { useProvidersStore } from "../models/useProvidersStore.js";
import { ModelBadge } from "./ModelBadge.js";
import { ThinkingLevelPicker } from "./ThinkingLevelPicker.js";

interface ChatHeaderProps {
  session: SessionSummary;
}

export function ChatHeader({ session }: ChatHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const providers = useProvidersStore((s) => s.providers);
  const modelsByProvider = useProvidersStore((s) => s.modelsByProvider);
  const storeSelection = useProvidersStore((s) => s.sessionSelection[session.id]);

  const modelRef = storeSelection?.modelRef ?? session.modelRef;
  const thinkingLevel = storeSelection?.thinkingLevel ?? session.thinkingLevel;

  const provider = useMemo(
    () => providers.find((p) => p.id === modelRef?.providerId),
    [providers, modelRef?.providerId],
  );
  const model = useMemo(() => {
    if (!modelRef) return undefined;
    return modelsByProvider[modelRef.providerId]?.find((m) => m.id === modelRef.modelId);
  }, [modelsByProvider, modelRef]);

  return (
    <header className="flex h-10 items-center justify-between px-4 border-b border-[var(--line)] bg-[var(--bg-1)]">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-medium text-[var(--ink-0)] truncate">{session.title}</h2>
      </div>
      <div className="ml-3 flex items-center gap-2">
        <ModelBadge
          modelRef={modelRef}
          provider={provider}
          modelLabel={model?.label}
          thinkingLevel={thinkingLevel}
          onOpenPicker={() => setPickerOpen(true)}
        />
        <ThinkingLevelPicker sessionId={session.id} model={model} level={thinkingLevel} />
      </div>
      <ModelPicker open={pickerOpen} onOpenChange={setPickerOpen} sessionId={session.id} />
    </header>
  );
}
