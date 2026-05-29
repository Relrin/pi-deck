import { EventEmitter } from "node:events";
import { copyFile, readFile, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { EVENT_THEME_CHANGED } from "../../protocol/events.js";
import type { ThemeListing, ThemeSpec } from "../../protocol/theme.js";
import { BUNDLED_THEMES } from "./bundled.js";
import { readUserThemes, type UserThemeRead } from "./loader.js";
import { ThemeStorage } from "./storage.js";
import { ThemeWatcher } from "./watcher.js";

const DEFAULT_THEME_NAME = "default-dark";

interface RegistryEntry {
  name: string;
  spec: ThemeSpec;
  source: "bundled" | "user";
  vscodeRaw?: unknown;
  filePath?: string;
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

  /**
   * Return the raw VS Code JSON for a theme imported from a VS Code colour-theme file, or
   * `undefined` for bundled / pi-deck-format themes. The renderer forwards this to Shiki so
   * syntax highlighting matches the imported palette key-for-key.
   */
  getVSCodeRaw(name: string): unknown {
    return this.registry.get(name)?.vscodeRaw;
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
    // Bundled theme names are reserved. A user file whose basename collides with a bundled name
    // is ignored — to fork a bundled theme the user saves it with a different name. This avoids
    // the chip ambiguity and lets us serve the bundled in-memory spec authoritatively.
    const existing = this.registry.get(read.name);
    if (existing?.source === "bundled") return;
    this.registry.set(read.name, {
      name: read.name,
      spec: read.spec,
      source: "user",
      vscodeRaw: read.vscodeRaw,
      filePath: read.filePath,
    });
  }

  /**
   * Delete a user-imported theme. Bundled themes are refused — the in-memory registry is the
   * authoritative source for them. If the deleted theme is the active one we fall back to
   * `default-dark` so the UI never lands on a dangling reference. The chokidar watcher will
   * also fire on the unlink, but we drop the entry eagerly so the next `theme.changed` event
   * already reflects the deletion and the renderer doesn't briefly re-render a card we are
   * about to remove.
   */
  async deleteUserTheme(name: string): Promise<void> {
    const entry = this.registry.get(name);
    if (!entry) {
      throw new Error(`Unknown theme: ${name}`);
    }
    if (entry.source !== "user") {
      throw new Error(`Cannot delete bundled theme: ${name}`);
    }
    if (entry.filePath) {
      await unlink(entry.filePath).catch((err) => {
        // The file may have already been removed externally — that's fine.
        if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
          throw err;
        }
      });
    }
    this.registry.delete(name);

    if (this.activeName === name) {
      const fallback = this.registry.has(DEFAULT_THEME_NAME)
        ? DEFAULT_THEME_NAME
        : (this.registry.keys().next().value ?? DEFAULT_THEME_NAME);
      this.activeName = fallback;
      await this.storage.writeActive(this.activeName).catch(() => undefined);
      this.emitChange(this.get(this.activeName));
    } else {
      this.emitChange();
    }
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
