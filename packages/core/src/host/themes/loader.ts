import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { type ThemeSpec, themeSpecSchema } from "../../protocol/theme.js";

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
 * `tokenColors` array or a `colors` map; the import adapter does the actual translation in the
 * renderer (`packages/ui/src/theme/vscode-adapter.ts`). For the host we just wrap the raw payload
 * so it round-trips on the wire, plus a minimal `meta` derived from `type` and `name`.
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
    const name = (typeof obj.name === "string" && obj.name.trim()) || fallbackName;
    const kind: "dark" | "light" = obj.type === "light" ? "light" : "dark";
    const spec: ThemeSpec = { meta: { name, kind, accent: "custom" } };
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

/** Write a pi-deck theme JSON to disk, creating the file if missing. */
export async function writeBundledExample(themesDir: string, spec: ThemeSpec): Promise<void> {
  const name = spec.meta?.name ?? "unnamed";
  const target = join(themesDir, `${name}.json`);
  try {
    // Don't clobber user edits to an example that has the same filename.
    await readFile(target, "utf8");
  } catch {
    await writeFile(target, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  }
}
