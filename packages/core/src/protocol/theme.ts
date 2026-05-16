import { z } from "zod";

/**
 * The pi-deck theme JSON format.
 *
 * A theme is a flat map of CSS custom-property values (without the `--` prefix). Every field is
 * optional — missing keys fall back to whatever is defined in `tokens.css`. Density and font-pair
 * preferences are renderer prefs, not theme keys, and live in `usePreferencesStore` instead.
 *
 * The schema is lenient: bad values are reported by the loader per-property and the rest of the
 * theme still applies. The full list of well-known keys is exported as `themeTokenKeys` so the
 * loader can iterate deterministically.
 */

const tokenString = z.string().min(1);

const tokens = {
  "bg-0": tokenString.optional(),
  "bg-1": tokenString.optional(),
  "bg-2": tokenString.optional(),
  "bg-3": tokenString.optional(),
  "bg-inset": tokenString.optional(),
  line: tokenString.optional(),
  "line-strong": tokenString.optional(),

  "ink-0": tokenString.optional(),
  "ink-1": tokenString.optional(),
  "ink-2": tokenString.optional(),
  "ink-3": tokenString.optional(),

  accent: tokenString.optional(),
  "accent-soft": tokenString.optional(),
  "accent-line": tokenString.optional(),
  "accent-ink": tokenString.optional(),

  add: tokenString.optional(),
  "add-soft": tokenString.optional(),
  del: tokenString.optional(),
  "del-soft": tokenString.optional(),
  mod: tokenString.optional(),
  "mod-soft": tokenString.optional(),
  info: tokenString.optional(),
  warn: tokenString.optional(),

  "diff-add-bg": tokenString.optional(),
  "diff-add-fg": tokenString.optional(),
  "diff-add-marker": tokenString.optional(),
  "diff-del-bg": tokenString.optional(),
  "diff-del-fg": tokenString.optional(),
  "diff-del-marker": tokenString.optional(),
  "diff-context-fg": tokenString.optional(),
  "diff-line-number": tokenString.optional(),
  "code-bg": tokenString.optional(),

  "font-display": tokenString.optional(),
  "font-ui": tokenString.optional(),
  "font-mono": tokenString.optional(),

  "shadow-pop": tokenString.optional(),
  grain: tokenString.optional(),
};

export const themeAccentSchema = z.enum(["plasma", "phosphor", "nightshade", "custom"]);
export type ThemeAccent = z.infer<typeof themeAccentSchema>;

export const themeKindSchema = z.enum(["dark", "light"]);
export type ThemeKind = z.infer<typeof themeKindSchema>;

export const themeMetaSchema = z.object({
  name: z.string().min(1),
  kind: themeKindSchema,
  accent: themeAccentSchema,
});

export type ThemeMeta = z.infer<typeof themeMetaSchema>;

export const themeSpecSchema = z
  .object({
    meta: themeMetaSchema.optional(),
    ...tokens,
  })
  .passthrough();

export type ThemeSpec = z.infer<typeof themeSpecSchema>;

/** Deterministic iteration order for the loader. */
export const themeTokenKeys = Object.keys(tokens) as ReadonlyArray<keyof typeof tokens>;
export type ThemeTokenKey = (typeof themeTokenKeys)[number];

/** Lightweight listing payload returned by `theme.list`. */
export const themeListingSchema = z.object({
  name: z.string(),
  kind: themeKindSchema,
  accent: themeAccentSchema.optional(),
  source: z.enum(["bundled", "user"]).optional(),
});

export type ThemeListing = z.infer<typeof themeListingSchema>;
