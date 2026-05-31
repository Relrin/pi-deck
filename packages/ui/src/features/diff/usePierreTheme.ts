import type { ThemesType } from "@pierre/diffs/react";
import { useMemo } from "react";
import { usePreferencesStore } from "../../theme/usePreferencesStore.js";

/**
 * Resolve the active pi-deck theme to the Pierre themes the diff viewer
 * should use.
 *
 * Returns a `{ light, dark }` pair sourced from Settings → Git & GitHub. Pierre's
 * own `light-dark()` CSS switches between the two halves based on the host's
 * `color-scheme`, which `diff.css` ties to the active pi-deck theme's kind. The
 * picks always win — including over imported VS Code themes — so the diff theme
 * is an independent control, not a derived value of the editor palette.
 */
export function usePierreTheme(): ThemesType {
  const diffThemeLight = usePreferencesStore((s) => s.diffThemeLight);
  const diffThemeDark = usePreferencesStore((s) => s.diffThemeDark);
  return useMemo(
    () => ({ light: diffThemeLight, dark: diffThemeDark }),
    [diffThemeLight, diffThemeDark],
  );
}
