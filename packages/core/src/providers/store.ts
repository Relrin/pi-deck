import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type CustomProviderDef, type ProvidersFile, ProvidersFileSchema } from "./types.js";

const DEFAULT_STATE: ProvidersFile = {
  version: 1,
  customProviders: [],
  perSessionModel: {},
};

/**
 * Read/write store for `~/.config/pi-deck/providers.json`. Holds:
 *   - the list of custom OpenAI-compatible providers the user has added,
 *   - the default model picked in the picker when no session-specific override exists,
 *   - per-session model selection so a switch survives restart.
 *
 * API key material does NOT live here — pi-ai's `~/.pi/agent/auth.json` is the only on-disk
 * home for secrets (see `auth-bridge.ts`).
 */
export class ProvidersStore {
  private readonly file: string;
  private state: ProvidersFile = structuredClone(DEFAULT_STATE);
  private loaded = false;

  constructor(userDataDir: string) {
    this.file = join(userDataDir, "providers.json");
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = ProvidersFileSchema.safeParse(JSON.parse(raw));
      this.state = parsed.success ? parsed.data : structuredClone(DEFAULT_STATE);
    } catch {
      this.state = structuredClone(DEFAULT_STATE);
    }
    this.loaded = true;
  }

  async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.load();
  }

  listCustom(): CustomProviderDef[] {
    return [...this.state.customProviders];
  }

  getCustom(id: string): CustomProviderDef | undefined {
    return this.state.customProviders.find((p) => p.id === id);
  }

  async addCustom(def: CustomProviderDef): Promise<void> {
    if (this.state.customProviders.some((p) => p.id === def.id)) {
      throw new Error(`Custom provider with id "${def.id}" already exists`);
    }
    this.state = {
      ...this.state,
      customProviders: [...this.state.customProviders, def],
    };
    await this.persist();
  }

  async removeCustom(id: string): Promise<void> {
    this.state = {
      ...this.state,
      customProviders: this.state.customProviders.filter((p) => p.id !== id),
      perSessionModel: Object.fromEntries(
        Object.entries(this.state.perSessionModel).filter(([, v]) => v.modelRef.providerId !== id),
      ),
    };
    await this.persist();
  }

  getSessionSelection(sessionId: string): ProvidersFile["perSessionModel"][string] | undefined {
    return this.state.perSessionModel[sessionId];
  }

  async setSessionSelection(
    sessionId: string,
    selection: ProvidersFile["perSessionModel"][string],
  ): Promise<void> {
    this.state = {
      ...this.state,
      perSessionModel: { ...this.state.perSessionModel, [sessionId]: selection },
    };
    await this.persist();
  }

  async clearSessionSelection(sessionId: string): Promise<void> {
    if (!(sessionId in this.state.perSessionModel)) return;
    const next = { ...this.state.perSessionModel };
    delete next[sessionId];
    this.state = { ...this.state, perSessionModel: next };
    await this.persist();
  }

  getDefaultModel(): ProvidersFile["defaultModel"] {
    return this.state.defaultModel;
  }

  async setDefaultModel(ref: ProvidersFile["defaultModel"]): Promise<void> {
    this.state = { ...this.state, defaultModel: ref };
    await this.persist();
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${Date.now()}.tmp`;
    await writeFile(tmp, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
    await rename(tmp, this.file);
  }
}
