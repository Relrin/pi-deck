import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { type ThemeSpec, themeSpecSchema } from "../../protocol/theme.js";
import { adaptVSCodeTheme } from "./vscode-adapter.js";

export interface UserThemeRead {
  name: string;
  spec: ThemeSpec;
  /** Present when the JSON looked like a VS Code theme so the renderer can pass it to Shiki directly. */
  vscodeRaw?: unknown;
  filePath: string;
}

/** Read every `*.json` in `themesDir`, parse each, return what survives. */
export async function readUserThemes(themesDir: string): Promise<UserThemeRead[]> {
  let entries: string[];
  try {
    entries = await readdir(themesDir);
  } catch {
    return [];
  }

  const out: UserThemeRead[] = [];
  for (const entry of entries) {
    if (extname(entry).toLowerCase() !== ".json") continue;
    const filePath = join(themesDir, entry);
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const read = adaptUserTheme(parsed, basename(entry, extname(entry)), filePath);
      if (read) out.push(read);
    } catch (err) {
      console.warn(`[themes] failed to read ${filePath}`, err);
    }
  }
  return out;
}

/**
 * Detect VS Code vs pi-deck format and produce a `UserThemeRead`. A VS Code theme has either a
 * `tokenColors` array or a `colors` map; we translate it into a full pi-deck `ThemeSpec` via
 * `adaptVSCodeTheme` so the appearance preview and the live UI actually pick up the imported
 * palette (light/dark + accent + surfaces). The raw JSON is kept around so Shiki can render
 * syntax highlighting with the same VS Code theme via `setShikiThemeFromVSCode`.
 */
function adaptUserTheme(
  raw: unknown,
  fallbackName: string,
  filePath: string,
): UserThemeRead | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const isVSCode =
    Array.isArray(obj.tokenColors) ||
    (typeof obj.colors === "object" && obj.colors !== null) ||
    typeof obj.semanticTokenColors === "object";

  if (isVSCode) {
    const { spec } = adaptVSCodeTheme(raw, fallbackName);
    const name = spec.meta?.name ?? fallbackName;
    return { name, spec, vscodeRaw: raw, filePath };
  }

  const parsed = themeSpecSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`[themes] ${filePath} is not a valid pi-deck theme`, parsed.error.flatten());
    return null;
  }
  const spec = parsed.data;
  const name = spec.meta?.name ?? fallbackName;
  if (!spec.meta) spec.meta = { name, kind: "dark", accent: "custom" };
  return { name, spec, filePath };
}
