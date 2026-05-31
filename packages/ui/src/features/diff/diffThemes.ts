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

/**
 * Ordering convention inside each list:
 *   1. Pierre's native themes first — they're guaranteed loaded with the package.
 *   2. GitHub second — the de-facto neutral default most users recognise.
 *   3. Everything else alphabetical.
 */
export const LIGHT_DIFF_THEMES: readonly DiffThemeOption[] = [
  { name: "pierre-light", label: "Pierre Light" },
  { name: "pierre-light-soft", label: "Pierre Light Soft" },
  { name: "github-light-default", label: "GitHub Light" },
  { name: "catppuccin-latte", label: "Catppuccin Latte" },
  { name: "material-theme-lighter", label: "Material Lighter" },
  { name: "min-light", label: "Min Light" },
  { name: "one-light", label: "One Light" },
  { name: "rose-pine-dawn", label: "Rosé Pine Dawn" },
  { name: "solarized-light", label: "Solarized Light" },
  { name: "vitesse-light", label: "Vitesse Light" },
];

export const DARK_DIFF_THEMES: readonly DiffThemeOption[] = [
  { name: "pierre-dark", label: "Pierre Dark" },
  { name: "pierre-dark-soft", label: "Pierre Dark Soft" },
  { name: "github-dark-default", label: "GitHub Dark" },
  { name: "catppuccin-frappe", label: "Catppuccin Frappé" },
  { name: "catppuccin-mocha", label: "Catppuccin Mocha" },
  { name: "dracula", label: "Dracula" },
  { name: "material-theme-darker", label: "Material Darker" },
  { name: "monokai", label: "Monokai" },
  { name: "night-owl", label: "Night Owl" },
  { name: "nord", label: "Nord" },
  { name: "one-dark-pro", label: "One Dark Pro" },
  { name: "rose-pine", label: "Rosé Pine" },
  { name: "solarized-dark", label: "Solarized Dark" },
  { name: "tokyo-night", label: "Tokyo Night" },
  { name: "vitesse-dark", label: "Vitesse Dark" },
];

export function labelForDiffTheme(list: readonly DiffThemeOption[], name: string): string {
  return list.find((t) => t.name === name)?.label ?? name;
}
