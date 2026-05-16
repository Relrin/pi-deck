import { EventEmitter } from "node:events";
import { copyFile, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { EVENT_THEME_CHANGED } from "../../protocol/events.js";
import type { ThemeListing, ThemeSpec } from "../../protocol/theme.js";
import { BUNDLED_THEMES } from "./bundled.js";
import { readUserThemes, type UserThemeRead, writeBundledExample } from "./loader.js";
import { ThemeStorage } from "./storage.js";
import { ThemeWatcher } from "./watcher.js";

const DEFAULT_THEME_NAME = "default-dark";

interface RegistryEntry {
  name: string;
  spec: ThemeSpec;
  source: "bundled" | "user";
  vscodeRaw?: unknown;
}

export interface ThemeManagerEvents {
  event: (
    topic: typeof EVENT_THEME_CHANGED,
    payload: { activeName: string; themes: ThemeListing[]; spec?: unknown },
  ) => void;
}

/**
 * Single source of truth for available themes, the active selection, and disk hot-reload.
 *
 * - Bundled themes are always present and authoritative — they cannot be removed by deleting the
 *   forkable example written to disk on first launch.
 * - User themes (pi-deck-format or VS Code-format) override a bundled name if they share it.
 * - Watcher fires `theme.changed` whenever the user themes dir is touched; if the active theme's
 *   spec changed, the new spec ships in the event payload so the renderer can re-apply without an
 *   extra round-trip.
 */
export class ThemeManager extends EventEmitter {
  private readonly storage: ThemeStorage;
  private watcher: ThemeWatcher | undefined;
  private registry = new Map<string, RegistryEntry>();
  private activeName = DEFAULT_THEME_NAME;

  constructor(userDataDir: string) {
    super();
    this.storage = new ThemeStorage(userDataDir);
  }

  async init(): Promise<void> {
    await this.storage.ensure();
    for (const spec of BUNDLED_THEMES) {
      const name = spec.meta?.name;
      if (!name) continue;
      this.registry.set(name, { name, spec, source: "bundled" });
      // Best-effort: ship a forkable copy to disk if the user has nothing there yet.
      await writeBundledExample(this.storage.themesDir, spec).catch((err) => {
        console.warn("[themes] failed to seed bundled example", err);
      });
    }
    await this.refreshUserThemes();

    const stored = await this.storage.readActive();
    if (stored && this.registry.has(stored)) {
      this.activeName = stored;
    } else if (!this.registry.has(this.activeName)) {
      const first = this.registry.keys().next().value;
      if (typeof first === "string") this.activeName = first;
    }

    this.watcher = new ThemeWatcher({
      themesDir: this.storage.themesDir,
      onChange: () => {
        void this.handleDiskChange();
      },
    });
    this.watcher.start();
  }

  async shutdown(): Promise<void> {
    await this.watcher?.stop();
    this.watcher = undefined;
  }

  list(): ThemeListing[] {
    const out: ThemeListing[] = [];
    for (const entry of this.registry.values()) {
      out.push({
        name: entry.name,
        kind: entry.spec.meta?.kind ?? "dark",
        accent: entry.spec.meta?.accent,
        source: entry.source,
      });
    }
    return out;
  }

  get(name: string): ThemeSpec | undefined {
    return this.registry.get(name)?.spec;
  }

  getActiveName(): string {
    return this.activeName;
  }

  async setActive(name: string): Promise<void> {
    if (!this.registry.has(name)) {
      throw new Error(`Unknown theme: ${name}`);
    }
    this.activeName = name;
    await this.storage.writeActive(name).catch((err) => {
      console.warn("[themes] failed to persist active theme", err);
    });
    this.emitChange();
  }

  /**
   * Copy `sourcePath` into the user themes dir. The watcher will re-list and emit
   * `theme.changed` automatically; the renderer reacts to that event. Returns the
   * derived theme name (basename without extension) so the caller can toast or focus.
   */
  async importFromPath(sourcePath: string): Promise<{ name: string }> {
    const raw = await readFile(sourcePath, "utf8");
    try {
      JSON.parse(raw);
    } catch {
      throw new Error("Selected file is not valid JSON");
    }
    const ext = extname(sourcePath).toLowerCase();
    if (ext !== ".json") {
      throw new Error("Theme files must have a .json extension");
    }
    const fileName = basename(sourcePath);
    const target = join(this.storage.themesDir, fileName);
    await copyFile(sourcePath, target);
    return { name: basename(fileName, extname(fileName)) };
  }

  private async refreshUserThemes(): Promise<void> {
    const reads = await readUserThemes(this.storage.themesDir);
    // Drop previous user entries so deletions take effect.
    for (const [key, entry] of this.registry) {
      if (entry.source === "user") this.registry.delete(key);
    }
    for (const read of reads) {
      this.upsertUserEntry(read);
    }
  }

  private upsertUserEntry(read: UserThemeRead): void {
    this.registry.set(read.name, {
      name: read.name,
      spec: read.spec,
      source: "user",
      vscodeRaw: read.vscodeRaw,
    });
  }

  private async handleDiskChange(): Promise<void> {
    const previousActiveSpec = this.get(this.activeName);
    await this.refreshUserThemes();
    if (!this.registry.has(this.activeName)) {
      const fallback = this.registry.keys().next().value;
      if (typeof fallback === "string") {
        this.activeName = fallback;
        await this.storage.writeActive(this.activeName).catch(() => undefined);
      }
    }
    const currentActiveSpec = this.get(this.activeName);
    const specChanged = JSON.stringify(previousActiveSpec) !== JSON.stringify(currentActiveSpec);
    this.emitChange(specChanged ? currentActiveSpec : undefined);
  }

  private emitChange(spec?: ThemeSpec): void {
    const payload = {
      activeName: this.activeName,
      themes: this.list(),
      ...(spec !== undefined ? { spec } : {}),
    };
    this.emit("event", EVENT_THEME_CHANGED, payload);
  }
}
