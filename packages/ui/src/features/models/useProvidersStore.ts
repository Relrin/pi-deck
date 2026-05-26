import type { SessionModelRef, ThinkingLevel } from "@pi-deck/core/domain/session.js";
import type {
  CustomProviderInput,
  ModelInfo,
  ProviderSummary,
} from "@pi-deck/core/providers/types.js";
import { create } from "zustand";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useNotificationStore } from "../_status/useNotificationStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";

export interface ProvidersStoreState {
  providers: ProviderSummary[];
  defaultModel?: SessionModelRef;
  modelsByProvider: Record<string, ModelInfo[]>;
  loadingProviders: boolean;
  loadingModelsByProvider: Record<string, boolean>;
  /** Per-session model selection mirror (sourced from session metadata + setSessionModel). */
  sessionSelection: Record<string, { modelRef: SessionModelRef; thinkingLevel?: ThinkingLevel }>;

  refreshProviders: () => Promise<void>;
  refreshModels: (providerId: string) => Promise<void>;
  setApiKey: (authJsonKey: string, secret: string) => Promise<void>;
  clearApiKey: (authJsonKey: string) => Promise<void>;
  addCustomProvider: (input: CustomProviderInput) => Promise<ProviderSummary>;
  removeCustomProvider: (id: string) => Promise<void>;
  setSessionModel: (
    sessionId: string,
    modelRef: SessionModelRef,
    thinkingLevel?: ThinkingLevel,
  ) => Promise<void>;
  setSessionThinkingLevel: (sessionId: string, level: ThinkingLevel) => Promise<void>;
  /** Pulled out of the event router when `provider.changed` fires. */
  applyProviderChanged: (providerId?: string) => Promise<void>;
  /** Pulled out of the event router when `session.model.changed` fires. */
  applySessionModelChanged: (
    sessionId: string,
    modelRef: SessionModelRef,
    thinkingLevel?: ThinkingLevel,
  ) => void;
}

function getClient() {
  return useSessionsStore.getState().client;
}

export const useProvidersStore = create<ProvidersStoreState>((set, get) => ({
  providers: [],
  defaultModel: undefined,
  modelsByProvider: {},
  loadingProviders: false,
  loadingModelsByProvider: {},
  sessionSelection: {},

  refreshProviders: async () => {
    const client = getClient();
    if (!client) return;
    set({ loadingProviders: true });
    try {
      const res = await client.call("provider.list", {});
      set({ providers: res.providers, defaultModel: res.defaultModel });
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to load providers"));
    } finally {
      set({ loadingProviders: false });
    }
  },

  refreshModels: async (providerId) => {
    const client = getClient();
    if (!client) return;
    set((s) => ({
      loadingModelsByProvider: { ...s.loadingModelsByProvider, [providerId]: true },
    }));
    try {
      const res = await client.call("provider.models", { providerId });
      set((s) => ({
        modelsByProvider: { ...s.modelsByProvider, [providerId]: res.models },
      }));
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to load models"));
    } finally {
      set((s) => ({
        loadingModelsByProvider: { ...s.loadingModelsByProvider, [providerId]: false },
      }));
    }
  },

  setApiKey: async (authJsonKey, secret) => {
    const client = getClient();
    if (!client) throw new Error("Client not initialized");
    await client.call("provider.setApiKey", { authJsonKey, secret });
    // Refresh provider list to flip the auth-state badge; server will also emit
    // `provider.changed`, which is a no-op idempotent refresh.
    await get().refreshProviders();
  },

  clearApiKey: async (authJsonKey) => {
    const client = getClient();
    if (!client) throw new Error("Client not initialized");
    await client.call("provider.clearApiKey", { authJsonKey });
    await get().refreshProviders();
  },

  addCustomProvider: async (input) => {
    const client = getClient();
    if (!client) throw new Error("Client not initialized");
    const res = await client.call("provider.addCustom", { def: input });
    await get().refreshProviders();
    return res.provider;
  },

  removeCustomProvider: async (id) => {
    const client = getClient();
    if (!client) throw new Error("Client not initialized");
    await client.call("provider.removeCustom", { id });
    set((s) => {
      const next = { ...s.modelsByProvider };
      delete next[id];
      return { modelsByProvider: next };
    });
    await get().refreshProviders();
  },

  setSessionModel: async (sessionId, modelRef, thinkingLevel) => {
    const client = getClient();
    if (!client) throw new Error("Client not initialized");
    // Optimistic update so the UI reacts instantly; server event will reconcile.
    set((s) => ({
      sessionSelection: {
        ...s.sessionSelection,
        [sessionId]: { modelRef, thinkingLevel },
      },
    }));
    useSessionsStore.getState().updateSessionMetadata(sessionId, {
      modelRef,
      thinkingLevel,
      model: `${modelRef.providerId}/${modelRef.modelId}`,
    });
    try {
      await client.call("session.setModel", { sessionId, modelRef, thinkingLevel });
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to switch model"));
      throw err;
    }
  },

  setSessionThinkingLevel: async (sessionId, level) => {
    const client = getClient();
    if (!client) throw new Error("Client not initialized");
    set((s) => {
      const prev = s.sessionSelection[sessionId];
      if (!prev) return s;
      return {
        sessionSelection: {
          ...s.sessionSelection,
          [sessionId]: { ...prev, thinkingLevel: level },
        },
      };
    });
    useSessionsStore.getState().updateSessionMetadata(sessionId, { thinkingLevel: level });
    try {
      await client.call("session.setThinkingLevel", { sessionId, level });
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to set thinking level"));
      throw err;
    }
  },

  applyProviderChanged: async (providerId) => {
    await get().refreshProviders();
    if (providerId) {
      // Drop cached models for the changed provider so the next picker open re-fetches.
      set((s) => {
        const next = { ...s.modelsByProvider };
        delete next[providerId];
        return { modelsByProvider: next };
      });
    }
  },

  applySessionModelChanged: (sessionId, modelRef, thinkingLevel) => {
    set((s) => ({
      sessionSelection: {
        ...s.sessionSelection,
        [sessionId]: { modelRef, thinkingLevel },
      },
    }));
    useSessionsStore.getState().updateSessionMetadata(sessionId, {
      modelRef,
      thinkingLevel,
      model: `${modelRef.providerId}/${modelRef.modelId}`,
    });
  },
}));
