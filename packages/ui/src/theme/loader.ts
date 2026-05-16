import { type ThemeSpec, themeSpecSchema, themeTokenKeys } from "@pi-deck/core";

/**
 * Apply a theme spec to `document.documentElement` as inline custom properties. Inline style
 * beats any `:root` / `[data-*]` selector, so the JSON wins over CSS defaults.
 *
 * Lenient by design: a single bad value is logged and skipped, the rest of the theme still
 * applies. A malformed user theme must never blank the UI.
 */
export function applyTheme(spec: unknown): void {
  const root = document.documentElement;
  const parsed = themeSpecSchema.safeParse(spec);
  if (!parsed.success) {
    console.error("[theme] failed to parse theme spec", parsed.error.flatten());
    return;
  }

  const data = parsed.data as Record<string, unknown> & ThemeSpec;
  if (data.meta) {
    root.dataset.themeName = data.meta.name;
    if (data.meta.kind === "light" || data.meta.kind === "dark") {
      if (data.meta.kind === "light") root.setAttribute("data-theme", "light");
      else root.removeAttribute("data-theme");
    }
    if (data.meta.accent === "phosphor" || data.meta.accent === "nightshade") {
      root.setAttribute("data-accent", data.meta.accent);
    } else {
      root.removeAttribute("data-accent");
    }
  }

  for (const key of themeTokenKeys) {
    const value = data[key];
    if (typeof value !== "string" || value.length === 0) continue;
    try {
      root.style.setProperty(`--${key}`, value);
    } catch (err) {
      console.warn(`[theme] failed to apply --${key} = ${JSON.stringify(value)}`, err);
    }
  }
}

/** Strip every inline token from the root element. Useful in tests. */
export function clearTheme(): void {
  const root = document.documentElement;
  for (const key of themeTokenKeys) {
    root.style.removeProperty(`--${key}`);
  }
  delete root.dataset.themeName;
  root.removeAttribute("data-theme");
  root.removeAttribute("data-accent");
}
