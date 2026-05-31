import { registerCustomTheme } from "@pierre/diffs";
import type { ThemesType } from "@pierre/diffs/react";
import { useEffect, useMemo } from "react";
import type { ThemeRegistration } from "shiki";
import { getShikiThemeForActive } from "../../theme/shiki-bridge.js";
import { usePreferencesStore } from "../../theme/usePreferencesStore.js";
import { useThemeStore } from "../../theme/useThemeStore.js";

/**
 * What Pierre's `options.theme` accepts: a Shiki bundled theme name, a previously
 * registered custom theme name, or a `{ dark, light }` pair.
 */
export type PierreThemeValue = string | ThemesType;

/**
 * Resolve the active pi-deck theme to the Pierre/Shiki theme value Pierre expects.
 *
 * Two paths:
 *   1. The active pi-deck theme is an imported VS Code theme — register its raw JSON
 *      as a Pierre custom theme on first use and forward the name. This keeps Pierre's
 *      syntax highlighting token-for-token aligned with the editor's theme.
 *   2. The active pi-deck theme is bundled — Pierre's input falls back to the user's
 *      preference for the matching kind (`diffThemeLight` / `diffThemeDark` in
 *      `usePreferencesStore`).
 */
const registeredThemeNames = new Set<string>();

export function usePierreTheme(): PierreThemeValue {
  // Re-derive whenever the active theme changes. Both `activeName` and `activeSpec`
  // participate so a VS Code theme swap that keeps the same name still re-runs the
  // effect; the bridge state is set synchronously alongside `applySpec`.
  const activeName = useThemeStore((s) => s.activeName);
  const activeSpec = useThemeStore((s) => s.activeSpec);
  const diffThemeLight = usePreferencesStore((s) => s.diffThemeLight);
  const diffThemeDark = usePreferencesStore((s) => s.diffThemeDark);

  // The bridge is a stateful singleton; `activeName`/`activeSpec` are the observable
  // signal that it has a new payload, which Biome can't see through.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-derive when the active theme changes (signal travels through the shiki bridge).
  const payload = useMemo(() => getShikiThemeForActive(), [activeName, activeSpec]);

  useEffect(() => {
    if (!payload.raw) return;
    if (registeredThemeNames.has(payload.name)) return;
    const raw = payload.raw as ThemeRegistration;
    // Pierre takes a loader so it can defer the parse to first render. The raw VS Code
    // JSON is already in memory — resolve immediately.
    registerCustomTheme(payload.name, async () => raw);
    registeredThemeNames.add(payload.name);
  }, [payload]);

  if (payload.raw) return payload.name;
  const kind = activeSpec?.meta?.kind ?? "dark";
  return kind === "light" ? diffThemeLight : diffThemeDark;
}
