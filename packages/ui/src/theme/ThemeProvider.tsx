import { type ReactNode, useEffect } from "react";
import { useSessionsStore } from "../features/sessions/useSessionsStore.js";
import { useThemeStore } from "./useThemeStore.js";

export type ThemeProviderProps = {
  children: ReactNode;
};

/**
 * Bootstraps the theme system whenever the WS reaches a connected state, then defers updates to
 * the `theme.changed` event handler in `event-router.ts`. Renders children unchanged.
 *
 * The pre-mount hydration script in `packages/desktop/index.html` already sets `data-theme`,
 * `data-accent`, `data-density`, and `data-fonts` from `localStorage` so the first paint matches
 * the stored preference; this component just brings the full per-token JSON in.
 *
 * Subscribing to the sessions store via `subscribe` (rather than reading via `useStore` and
 * depending on it in `useEffect`) avoids a render-closure race: between React reading
 * `status === "connected"` and the effect actually executing, the underlying socket can flap, so
 * `ws.request` sees `readyState !== OPEN` even though the captured status said otherwise.
 * `subscribe` runs the listener on every store change against fresh state.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    let hydrated = false;
    const tryHydrate = (): void => {
      if (hydrated) return;
      const { client, status } = useSessionsStore.getState();
      if (!client || status !== "connected") return;
      hydrated = true;
      void useThemeStore
        .getState()
        .hydrate(client)
        .catch((err) => {
          hydrated = false;
          console.error("[theme] hydrate failed; will retry on next connect", err);
        });
    };
    tryHydrate();
    return useSessionsStore.subscribe(tryHydrate);
  }, []);

  return <>{children}</>;
}
