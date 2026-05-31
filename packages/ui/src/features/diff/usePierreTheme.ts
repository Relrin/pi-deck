import { registerCustomTheme } from "@pierre/diffs";
import type { ThemesType } from "@pierre/diffs/react";
import { useEffect, useMemo } from "react";
import type { ThemeRegistration } from "shiki";
import { getShikiThemeForActive } from "../../theme/shiki-bridge.js";
import { useThemeStore } from "../../theme/useThemeStore.js";

/**
 * What Pierre's `options.theme` accepts: a Shiki bundled theme name, a previously
 * registered custom theme name, or a `{ dark, light }` pair.
 */
export type PierreThemeValue = string | ThemesType;

/**
 * Resolve the active pi-deck theme to the Pierre/Shiki theme value Pierre expects.
 *
 * VS Code themes imported via `theme.import` ship their raw JSON through
 * `shiki-bridge`; we register that JSON as a custom Pierre theme on first use and
 * forward the name. Bundled pi-deck themes don't ship a Shiki payload, so we fall
 * back to Shiki's `github-light-default` / `github-dark-default` — same payload used
 * by the chat code-highlighter via `setShikiThemeByKind`.
 *
 * Registered names are cached in-module so re-renders don't re-register the same
 * theme; switching themes during a session triggers a fresh registration for the new
 * name only.
 */
const registeredThemeNames = new Set<string>();

export function usePierreTheme(): PierreThemeValue {
  // Re-derive whenever the active theme changes. Both `activeName` and `activeSpec`
  // participate so a VS Code theme swap that keeps the same name still re-runs the
  // effect; the bridge state is set synchronously alongside `applySpec`.
  const activeName = useThemeStore((s) => s.activeName);
  const activeSpec = useThemeStore((s) => s.activeSpec);

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

  return payload.name;
}
