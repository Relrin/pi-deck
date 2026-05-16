import { useThemeStore } from "./useThemeStore.js";

/** Hook returning the active theme name and the list of available themes. */
export function useTheme() {
  const activeName = useThemeStore((s) => s.activeName);
  const available = useThemeStore((s) => s.available);
  return { activeName, available };
}
