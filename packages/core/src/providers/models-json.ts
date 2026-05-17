import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { CustomProviderDef, ModelInfo } from "./types.js";

/**
 * Default models.json location — pi-ai's `~/.pi/agent/models.json`. We can't import
 * `getAgentDir` from pi-coding-agent here because the host is CommonJS and pi is ESM-only.
 * Replicating pi's resolution (env var → `~/.pi/agent`) keeps the host import-free.
 */
function defaultModelsPath(): string {
  const override = process.env.PI_AGENT_DIR ?? process.env.PI_HOME;
  const base = override ?? join(homedir(), ".pi", "agent");
  return join(base, "models.json");
}

/**
 * pi-ai reads `~/.pi/agent/models.json` via `ModelRegistry.create(authStorage)`. The shape is
 * `{ providers: { [providerId]: ProviderConfig } }` per pi's `docs/custom-provider.md`.
 *
 * pi-deck owns this file. On every add/remove of a custom provider — and whenever the live
 * model catalogue refreshes — we rewrite the entire `pi-deck.*` slice in-place. We keep any
 * other top-level providers the user has put there by hand untouched: the file we materialise
 * uses a `_managedBy: "pi-deck"` marker on each entry we own, and we only delete entries
 * carrying that marker.
 */
interface ModelsJsonShape {
  providers?: Record<string, ProviderEntry>;
  // pi may grow other top-level fields; preserve verbatim.
  [key: string]: unknown;
}

interface ProviderEntry {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  api?: string;
  models?: Array<{
    id: string;
    name: string;
    reasoning: boolean;
    input: ("text" | "image")[];
    cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
    contextWindow: number;
    maxTokens: number;
  }>;
  // pi-deck-only marker so we don't trample user-managed entries.
  _managedBy?: string;
}

const PI_DECK_MARKER = "pi-deck";

function synthesisedEnvVarName(id: string): string {
  return `${id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
}

export class ModelsJsonWriter {
  private readonly file: string;

  constructor(file?: string) {
    this.file = file ?? defaultModelsPath();
  }

  /**
   * Rewrite the pi-deck-managed providers in `models.json` to reflect the current set of
   * custom providers + their catalogues. Idempotent.
   */
  async sync(
    customs: readonly CustomProviderDef[],
    cataloguesByProvider: Record<string, readonly ModelInfo[]>,
  ): Promise<void> {
    const existing = await this.readSafe();
    const nextProviders: Record<string, ProviderEntry> = {};

    // Carry forward any non-pi-deck entries the user maintains by hand.
    for (const [key, entry] of Object.entries(existing.providers ?? {})) {
      if (entry?._managedBy !== PI_DECK_MARKER) {
        nextProviders[key] = entry;
      }
    }

    // Write our managed entries.
    for (const custom of customs) {
      const models = cataloguesByProvider[custom.id] ?? [];
      nextProviders[custom.id] = {
        _managedBy: PI_DECK_MARKER,
        name: custom.name,
        baseUrl: custom.baseUrl,
        api: custom.api,
        // pi-ai needs *some* apiKey hint to know which env-var to read as a fallback. The
        // resolver still finds an auth.json entry under the provider id first, so this is
        // just a hint for users who prefer env-var overrides.
        apiKey: synthesisedEnvVarName(custom.id),
        models: models.length
          ? models.map((m) => ({
              id: m.id,
              name: m.label,
              reasoning: m.supportsThinking,
              input: m.modalities,
              cost: m.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: m.contextWindow ?? 128_000,
              maxTokens: m.maxTokens ?? 4096,
            }))
          : custom.defaultModelId
            ? [
                {
                  id: custom.defaultModelId,
                  name: custom.defaultModelId,
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128_000,
                  maxTokens: 4096,
                },
              ]
            : [],
      };
    }

    const next: ModelsJsonShape = { ...existing, providers: nextProviders };
    await this.persist(next);
  }

  private async readSafe(): Promise<ModelsJsonShape> {
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as ModelsJsonShape;
      return {};
    } catch {
      return {};
    }
  }

  private async persist(data: ModelsJsonShape): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${Date.now()}.tmp`;
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(tmp, this.file);
  }
}
