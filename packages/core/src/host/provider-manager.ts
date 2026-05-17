import { EventEmitter } from "node:events";
import type { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";
import type { SessionModelRef, ThinkingLevel } from "../domain/session.js";
import {
  EVENT_PROVIDER_CHANGED,
  EVENT_SESSION_MODEL_CHANGED,
  type EventTopic,
} from "../protocol/events.js";
import { AuthBridge } from "../providers/auth-bridge.js";
import { ModelCatalogue } from "../providers/catalogue.js";
import { ModelsJsonWriter } from "../providers/models-json.js";
import { ProviderRegistry } from "../providers/registry.js";
import { ProvidersStore } from "../providers/store.js";
import type { CustomProviderInput, ModelInfo, ProviderSummary } from "../providers/types.js";

export type ProviderManagerEvents = {
  event: [topic: EventTopic, payload: unknown];
};

/**
 * Host-side facade for everything model/provider/auth. Wraps `ProviderRegistry` with
 * EventEmitter plumbing so it can broadcast `provider.changed` and `session.model.changed`
 * over the WS server alongside the existing SessionManager / ThemeManager events.
 *
 * pi-coding-agent is ESM-only and the host bundle is CommonJS, so we cannot use a static
 * `import` of `AuthStorage` / `ModelRegistry` — `create()` loads them via a dynamic
 * `import()` at runtime, which Node handles transparently across the module-format gap.
 */
export class ProviderManager extends EventEmitter<ProviderManagerEvents> {
  readonly registry: ProviderRegistry;
  readonly authStorage: AuthStorage;
  readonly modelRegistry: ModelRegistry;

  private constructor(
    registry: ProviderRegistry,
    authStorage: AuthStorage,
    modelRegistry: ModelRegistry,
  ) {
    super();
    this.registry = registry;
    this.authStorage = authStorage;
    this.modelRegistry = modelRegistry;
  }

  static async create(userDataDir: string): Promise<ProviderManager> {
    const pi = await import("@earendil-works/pi-coding-agent");
    const authStorage = pi.AuthStorage.create();
    const modelRegistry = pi.ModelRegistry.create(authStorage);
    const authBridge = new AuthBridge(authStorage);
    const catalogue = new ModelCatalogue(modelRegistry);
    const modelsJson = new ModelsJsonWriter();
    const store = new ProvidersStore(userDataDir);
    const registry = new ProviderRegistry(store, authBridge, catalogue, modelsJson);
    await registry.init();
    return new ProviderManager(registry, authStorage, modelRegistry);
  }

  listProviders(): { providers: ProviderSummary[]; defaultModel?: SessionModelRef } {
    return {
      providers: this.registry.listProviders(),
      defaultModel: this.registry.getDefaultModel(),
    };
  }

  async listModels(providerId: string): Promise<ModelInfo[]> {
    const models = await this.registry.listModels(providerId);
    // Refresh the in-process ModelRegistry so future spawns see the latest models.json shape.
    this.modelRegistry.refresh();
    return models;
  }

  async addCustom(input: CustomProviderInput): Promise<ProviderSummary> {
    const def = await this.registry.addCustom(input);
    this.modelRegistry.refresh();
    this.emit("event", EVENT_PROVIDER_CHANGED, { providerId: def.id });
    const summary = this.registry.listProviders().find((p) => p.id === def.id);
    if (!summary) throw new Error("Provider missing after add");
    return summary;
  }

  async removeCustom(id: string): Promise<void> {
    await this.registry.removeCustom(id);
    this.modelRegistry.refresh();
    this.emit("event", EVENT_PROVIDER_CHANGED, { providerId: id });
  }

  setApiKey(authJsonKey: string, secret: string): void {
    this.registry.setApiKey(authJsonKey, secret);
    const provider = this.registry.getProviderForAuthKey(authJsonKey);
    this.emit("event", EVENT_PROVIDER_CHANGED, { providerId: provider?.id });
  }

  clearApiKey(authJsonKey: string): void {
    this.registry.clearApiKey(authJsonKey);
    const provider = this.registry.getProviderForAuthKey(authJsonKey);
    this.emit("event", EVENT_PROVIDER_CHANGED, { providerId: provider?.id });
  }

  async setSessionSelection(
    sessionId: string,
    modelRef: SessionModelRef,
    thinkingLevel?: ThinkingLevel,
  ): Promise<void> {
    await this.registry.setSessionSelection(sessionId, { modelRef, thinkingLevel });
    this.emit("event", EVENT_SESSION_MODEL_CHANGED, {
      sessionId,
      modelRef,
      thinkingLevel,
    });
  }

  getSessionSelection(sessionId: string) {
    return this.registry.getSessionSelection(sessionId);
  }

  async clearSessionSelection(sessionId: string): Promise<void> {
    await this.registry.clearSessionSelection(sessionId);
  }
}
