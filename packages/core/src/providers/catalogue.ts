import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type { ThinkingLevel } from "../domain/session.js";
import { isBuiltInProvider } from "./built-ins.js";
import type { CustomProviderDef, ModelInfo } from "./types.js";

interface CacheEntry {
  fetchedAt: number;
  models: ModelInfo[];
}

const TTL_MS = 5 * 60 * 1000;
const ALL_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];

/** Subset of `Model<Api>` from pi-ai that we read. Avoids a direct pi-ai dep. */
interface PiModel {
  id: string;
  name: string;
  provider: string;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  thinkingLevelMap?: Partial<Record<ThinkingLevel, string | null>>;
}

/**
 * Per-provider model catalogue. Built-in providers come from pi-ai via the shared
 * `ModelRegistry` — `getAll()` returns every model pi knows about, filtered by `provider`.
 * Custom OpenAI-compatible providers (LM Studio, Ollama, vLLM) are fetched live from
 * `${baseUrl}/models` with a 5-minute in-memory TTL. Errors fall back to the user's
 * declared `defaultModelId` so the picker is never empty after authentication.
 */
export class ModelCatalogue {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly modelRegistry: ModelRegistry) {}

  invalidate(providerId?: string): void {
    if (providerId) this.cache.delete(providerId);
    else this.cache.clear();
  }

  async list(providerId: string, custom?: CustomProviderDef): Promise<ModelInfo[]> {
    const hit = this.cache.get(providerId);
    if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.models;

    const models = custom
      ? await this.fetchCustom(custom)
      : isBuiltInProvider(providerId)
        ? this.fetchBuiltIn(providerId)
        : [];

    this.cache.set(providerId, { fetchedAt: Date.now(), models });
    return models;
  }

  private fetchBuiltIn(providerId: string): ModelInfo[] {
    try {
      // ModelRegistry.getAll() returns built-in + custom models. Filter by provider id.
      const all = this.modelRegistry.getAll() as readonly PiModel[];
      return all
        .filter((m) => m.provider === providerId)
        .map<ModelInfo>((m) => piModelToInfo(providerId, m));
    } catch {
      return [];
    }
  }

  private async fetchCustom(def: CustomProviderDef): Promise<ModelInfo[]> {
    try {
      const url = `${def.baseUrl.replace(/\/$/, "")}/models`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6_000),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return defaultModelOf(def);
      const payload = (await res.json()) as { data?: Array<{ id?: unknown; name?: unknown }> };
      const rows = Array.isArray(payload.data) ? payload.data : [];
      const models = rows
        .map((row) => (typeof row.id === "string" ? row.id : undefined))
        .filter((id): id is string => Boolean(id))
        .map<ModelInfo>((id) => ({
          providerId: def.id,
          id,
          label: id,
          supportsThinking: false,
          modalities: ["text"],
        }));
      if (models.length === 0) return defaultModelOf(def);
      return models;
    } catch {
      return defaultModelOf(def);
    }
  }
}

function defaultModelOf(def: CustomProviderDef): ModelInfo[] {
  if (!def.defaultModelId) return [];
  return [
    {
      providerId: def.id,
      id: def.defaultModelId,
      label: def.defaultModelId,
      supportsThinking: false,
      modalities: ["text"],
    },
  ];
}

function piModelToInfo(providerId: string, model: PiModel): ModelInfo {
  const allowed = thinkingLevelsFor(model);
  return {
    providerId,
    id: model.id,
    label: model.name || model.id,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    supportsThinking: Boolean(model.reasoning) && allowed.some((l) => l !== "off"),
    modalities: model.input,
    cost: {
      input: model.cost.input,
      output: model.cost.output,
      cacheRead: model.cost.cacheRead,
      cacheWrite: model.cost.cacheWrite,
    },
    thinkingLevels: allowed.length > 0 ? allowed : undefined,
  };
}

function thinkingLevelsFor(model: PiModel): ThinkingLevel[] {
  if (!model.reasoning) return [];
  const map = model.thinkingLevelMap;
  if (!map) return ALL_LEVELS;
  return ALL_LEVELS.filter((level) => map[level] !== null);
}
