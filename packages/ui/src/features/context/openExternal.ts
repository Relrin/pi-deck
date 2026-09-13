import { ll } from "../../i18n/t.js";
import { useNotificationStore } from "../_status/useNotificationStore.js";

/**
 * Shell-out helpers for the context pane's row actions.
 *
 * Deliberately a `.ts` module rather than sitting beside the component: they are not React, so
 * they read the catalog imperatively with `ll()` **inside the function body** — a lookup that
 * happens at call time and therefore always reflects the current locale. Biome forbids that import
 * in `.tsx`, and rightly so: a component reading the store creates no subscription and would go
 * stale on a language switch.
 */
export async function openWithDefault(path: string): Promise<void> {
  const bridge = window.bridge;
  if (!bridge?.openPath) {
    useNotificationStore.getState().error(ll().context.errors.openUnsupported());
    return;
  }
  try {
    const err = await bridge.openPath(path);
    if (err) useNotificationStore.getState().error(err);
  } catch (err) {
    useNotificationStore
      .getState()
      .error(err instanceof Error ? err.message : ll().context.errors.openFailed());
  }
}

export async function revealInFolder(path: string): Promise<void> {
  const bridge = window.bridge;
  if (!bridge?.showItemInFolder) {
    useNotificationStore.getState().error(ll().context.errors.revealUnsupported());
    return;
  }
  try {
    await bridge.showItemInFolder(path);
  } catch (err) {
    useNotificationStore
      .getState()
      .error(err instanceof Error ? err.message : ll().context.errors.revealFailed());
  }
}
