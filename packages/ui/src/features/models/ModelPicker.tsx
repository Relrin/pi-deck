import type { SessionModelRef } from "@pi-deck/core/domain/session.js";
import type { ModelInfo, ProviderSummary } from "@pi-deck/core/providers/types.js";
import * as RadixDialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { PidIconButton } from "../../components/buttons/PidIconButton";
import { X } from "../../components/icons/index.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { AddCustomProviderDialog } from "./AddCustomProviderDialog.js";
import { AuthenticateProviderDialog } from "./AuthenticateProviderDialog.js";
import { ModelList } from "./ModelList.js";
import { ProviderList } from "./ProviderList.js";
import { useProvidersStore } from "./useProvidersStore.js";

interface ModelPickerProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Active session — selecting a model issues `session.setModel` for this id. */
  sessionId?: string;
  /** Optional override of the currently-active selection (for the empty-state intro screen). */
  activeModel?: SessionModelRef;
}

/**
 * Main provider/model picker. Opens as a portaled modal with two columns: providers on the
 * left, models on the right. Selecting a model calls `setSessionModel` and closes.
 */
export function ModelPicker({
  open,
  onOpenChange,
  sessionId,
  activeModel: activeOverride,
}: ModelPickerProps) {
  const providers = useProvidersStore((s) => s.providers);
  const modelsByProvider = useProvidersStore((s) => s.modelsByProvider);
  const loadingByProvider = useProvidersStore((s) => s.loadingModelsByProvider);
  const refreshModels = useProvidersStore((s) => s.refreshModels);
  const setSessionModel = useProvidersStore((s) => s.setSessionModel);
  const sessionSelection = useProvidersStore((s) =>
    sessionId ? s.sessionSelection[sessionId] : undefined,
  );
  const session = useSessionsStore((s) =>
    sessionId ? s.sessions.find((x) => x.id === sessionId) : undefined,
  );

  const activeModel = useMemo<SessionModelRef | undefined>(() => {
    if (activeOverride) return activeOverride;
    if (sessionSelection?.modelRef) return sessionSelection.modelRef;
    if (session?.modelRef) return session.modelRef;
    return undefined;
  }, [activeOverride, sessionSelection, session?.modelRef]);

  const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>(undefined);
  const [authForProvider, setAuthForProvider] = useState<ProviderSummary | undefined>(undefined);
  const [addCustomOpen, setAddCustomOpen] = useState(false);

  // Default-select the active session's provider (or the first authenticated one).
  useEffect(() => {
    if (!open) return;
    if (selectedProviderId && providers.some((p) => p.id === selectedProviderId)) return;
    const fallback =
      providers.find((p) => p.id === activeModel?.providerId) ??
      providers.find((p) => p.authState === "authenticated") ??
      providers[0];
    if (fallback) setSelectedProviderId(fallback.id);
  }, [open, providers, selectedProviderId, activeModel?.providerId]);

  // Lazy-fetch models when the user lands on a provider for the first time.
  useEffect(() => {
    if (!open || !selectedProviderId) return;
    const provider = providers.find((p) => p.id === selectedProviderId);
    if (!provider) return;
    if (provider.kind === "built-in" && provider.authState !== "authenticated") return;
    if (modelsByProvider[selectedProviderId]) return;
    void refreshModels(selectedProviderId);
  }, [open, selectedProviderId, providers, modelsByProvider, refreshModels]);

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  const onSelectModel = async (m: ModelInfo) => {
    if (!sessionId) {
      onOpenChange(false);
      return;
    }
    try {
      await setSessionModel(
        sessionId,
        { providerId: m.providerId, modelId: m.id },
        sessionSelection?.thinkingLevel ?? session?.thinkingLevel,
      );
    } finally {
      onOpenChange(false);
    }
  };

  return (
    <>
      <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="pid-modal-backdrop" />
          <RadixDialog.Content className="pid-modal" aria-describedby={undefined}>
            <div className="pid-modal-header">
              <RadixDialog.Title className="pid-modal-title">Select model</RadixDialog.Title>
              <PidIconButton
                icon={<X size={14} />}
                label="Close model picker"
                onClick={() => onOpenChange(false)}
              />
            </div>
            <div className="pid-modal-body">
              <div className="pid-models-grid">
                <ProviderList
                  providers={providers}
                  selectedId={selectedProviderId}
                  onSelect={setSelectedProviderId}
                  onAddCustom={() => setAddCustomOpen(true)}
                />
                <ModelList
                  provider={selectedProvider}
                  models={selectedProviderId ? modelsByProvider[selectedProviderId] : undefined}
                  loading={
                    selectedProviderId ? Boolean(loadingByProvider[selectedProviderId]) : false
                  }
                  activeModel={activeModel}
                  onAuthenticate={() => setAuthForProvider(selectedProvider)}
                  onSelectModel={onSelectModel}
                />
              </div>
            </div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
      <AuthenticateProviderDialog
        provider={authForProvider}
        open={Boolean(authForProvider)}
        onOpenChange={(next) => {
          if (!next) setAuthForProvider(undefined);
        }}
      />
      <AddCustomProviderDialog
        open={addCustomOpen}
        onOpenChange={setAddCustomOpen}
        onAdded={(id) => setSelectedProviderId(id)}
      />
    </>
  );
}
