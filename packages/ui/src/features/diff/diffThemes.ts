/**
 * Curated list of diff themes exposed by the Settings → Git & GitHub picker.
 *
 * Pierre accepts any Shiki bundled theme name plus its own `pierre-*` themes via
 * `DiffsThemeNames = BundledTheme | 'pierre-dark' | 'pierre-dark-soft' | ... | (string & {})`.
 * We surface a small hand-picked subset per kind so the dropdown doesn't drown the
 * user in 60+ Shiki bundles; users who need an obscure theme can extend this list.
 *
 * Keep separate light/dark catalogues so the picker can't suggest a dark theme for
 * the "light" slot — that mismatch produces unreadable previews.
 */

export interface DiffThemeOption {
  /** Pierre/Shiki theme name. Passed verbatim to `options.theme`. */
  name: string;
  /** Display label for the dropdown row. */
  label: string;
}

export const LIGHT_DIFF_THEMES: readonly DiffThemeOption[] = [
  { name: "pierre-light", label: "Pierre Light" },
  { name: "pierre-light-soft", label: "Pierre Light Soft" },
  { name: "github-light-default", label: "GitHub Light" },
  { name: "vitesse-light", label: "Vitesse Light" },
  { name: "min-light", label: "Min Light" },
  { name: "solarized-light", label: "Solarized Light" },
];

export const DARK_DIFF_THEMES: readonly DiffThemeOption[] = [
  { name: "pierre-dark", label: "Pierre Dark" },
  { name: "pierre-dark-soft", label: "Pierre Dark Soft" },
  { name: "github-dark-default", label: "GitHub Dark" },
  { name: "vitesse-dark", label: "Vitesse Dark" },
  { name: "dracula", label: "Dracula" },
  { name: "monokai", label: "Monokai" },
  { name: "nord", label: "Nord" },
  { name: "solarized-dark", label: "Solarized Dark" },
];

export function labelForDiffTheme(list: readonly DiffThemeOption[], name: string): string {
  return list.find((t) => t.name === name)?.label ?? name;
}
