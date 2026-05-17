import { randomUUID } from "node:crypto";
import type { AuthBridge } from "./auth-bridge.js";
import { BUILT_IN_PROVIDERS, getBuiltInProvider, isBuiltInProvider } from "./built-ins.js";
import type { ModelCatalogue } from "./catalogue.js";
import type { ModelsJsonWriter } from "./models-json.js";
import type { ProvidersStore } from "./store.js";
import {
  type CustomProviderDef,
  type CustomProviderInput,
  CustomProviderInputSchema,
  type ModelInfo,
  type ProviderSummary,
} from "./types.js";

/**
 * Top-level orchestrator over the provider store + auth bridge + catalogue + models.json
 * writer. The host's `ProviderManager` wraps this with WS-event plumbing.
 */
export class ProviderRegistry {
  constructor(
    private readonly store: ProvidersStore,
    private readonly auth: AuthBridge,
    private readonly catalogue: ModelCatalogue,
    private readonly modelsJson: ModelsJsonWriter,
  ) {}

  async init(): Promise<void> {
    await this.store.ensureLoaded();
    // Make sure pi sees our custom providers on first run (e.g. after a manual edit of
    // providers.json before the host started). Catalogues will be empty until the renderer
    // hits `provider.models`, but the base/key/api entries are enough for pi to spawn.
    await this.rewriteModelsJson();
  }

  listProviders(): ProviderSummary[] {
    const builtIns = BUILT_IN_PROVIDERS.map<ProviderSummary>((p) => ({
      id: p.id,
      name: p.name,
      kind: "built-in",
      iconKey: p.iconKey,
      envVar: p.envVar,
      authJsonKey: p.authJsonKey,
      oauthSupported: p.oauthSupported,
      authState: this.auth.getAuthState(p.authJsonKey),
    }));
    const customs = this.store.listCustom().map<ProviderSummary>((c) => ({
      id: c.id,
      name: c.name,
      kind: "custom-openai-compatible",
      iconKey: "custom",
      authJsonKey: c.id,
      oauthSupported: false,
      // Custom OpenAI-compatible endpoints (LM Studio, Ollama …) usually don't require auth,
      // so a missing key isn't an error. We show "authenticated" by default and only flip
      // when the catalogue probe fails.
      authState: this.auth.getAuthState(c.id),
      baseUrl: c.baseUrl,
      api: c.api,
    }));
    return [...builtIns, ...customs];
  }

  async listModels(providerId: string): Promise<ModelInfo[]> {
    if (isBuiltInProvider(providerId)) {
      return this.catalogue.list(providerId);
    }
    const custom = this.store.getCustom(providerId);
    if (!custom) return [];
    const models = await this.catalogue.list(providerId, custom);
    // Re-materialise models.json with the freshly fetched list so pi can route prompts.
    await this.rewriteModelsJson();
    return models;
  }

  async addCustom(input: CustomProviderInput): Promise<CustomProviderDef> {
    const parsed = CustomProviderInputSchema.parse(input);
    const id = sanitiseCustomId(parsed.name);
    const def: CustomProviderDef = {
      id,
      name: parsed.name,
      baseUrl: parsed.baseUrl,
      api: parsed.api,
      defaultModelId: parsed.defaultModelId,
      createdAt: new Date().toISOString(),
    };
    await this.store.addCustom(def);
    if (parsed.apiKey?.trim()) {
      // Persist the literal key into pi's auth.json under this provider id. pi-ai's
      // resolver picks it up at request time without needing an env var dance.
      this.auth.setApiKey(def.id, parsed.apiKey);
    }
    this.catalogue.invalidate(id);
    await this.rewriteModelsJson();
    return def;
  }

  async removeCustom(id: string): Promise<void> {
    const def = this.store.getCustom(id);
    if (!def) return;
    this.auth.clearApiKey(id);
    await this.store.removeCustom(id);
    this.catalogue.invalidate(id);
    await this.rewriteModelsJson();
  }

  setApiKey(authJsonKey: string, secret: string): void {
    this.auth.setApiKey(authJsonKey, secret);
    // Forget any cached unreachable state.
    this.catalogue.invalidate();
  }

  clearApiKey(authJsonKey: string): void {
    this.auth.clearApiKey(authJsonKey);
    this.catalogue.invalidate();
  }

  getProviderForAuthKey(authJsonKey: string): ProviderSummary | undefined {
    return this.listProviders().find((p) => p.authJsonKey === authJsonKey);
  }

  getSessionSelection(sessionId: string) {
    return this.store.getSessionSelection(sessionId);
  }

  async setSessionSelection(
    sessionId: string,
    selection: NonNullable<ReturnType<ProvidersStore["getSessionSelection"]>>,
  ): Promise<void> {
    await this.store.setSessionSelection(sessionId, selection);
    // Update the default so a fresh session in this app instance inherits the choice.
    await this.store.setDefaultModel(selection.modelRef);
  }

  async clearSessionSelection(sessionId: string): Promise<void> {
    await this.store.clearSessionSelection(sessionId);
  }

  getDefaultModel() {
    return this.store.getDefaultModel();
  }

  /** Re-emit models.json from current store + catalogue caches. */
  async rewriteModelsJson(): Promise<void> {
    const customs = this.store.listCustom();
    const catalogues: Record<string, ModelInfo[]> = {};
    for (const c of customs) {
      try {
        const cached = await this.catalogue.list(c.id, c);
        catalogues[c.id] = cached;
      } catch {
        catalogues[c.id] = [];
      }
    }
    await this.modelsJson.sync(customs, catalogues);
  }

  builtInDef(id: string) {
    return getBuiltInProvider(id);
  }
}

function sanitiseCustomId(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return `custom-${randomUUID().slice(0, 8)}`;
  return `${base}-${randomUUID().slice(0, 4)}`;
}
