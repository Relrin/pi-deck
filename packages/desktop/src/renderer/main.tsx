import "@pi-deck/ui/styles/fonts";
import { isLocale, type Locale } from "@pi-deck/core";
import { App } from "@pi-deck/ui";
import { LOCALE_STORAGE_KEY, loadLocaleAsync, useLocaleStore } from "@pi-deck/ui/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@pi-deck/ui/styles/globals.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found");
}

/**
 * Read the persisted locale the same way `index.html`'s pre-mount script does, before zustand has
 * rehydrated. We only need it to pick which catalog chunk to fetch; the store re-reads and
 * validates the same value a moment later.
 */
function persistedLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (!raw) return "en";
    const candidate = (JSON.parse(raw) as { state?: { uiLocale?: unknown } }).state?.uiLocale;
    return isLocale(candidate) ? candidate : "en";
  } catch {
    // localStorage can be unavailable in some Electron profiles — same guard as useThemeStore.
    return "en";
  }
}

/**
 * Load the catalog before the first render so a non-English user never sees a frame of English.
 * Deliberately an async bootstrap rather than top-level await: the renderer build sets no explicit
 * `build.target`, so relying on TLA here would couple first paint to a Vite default we do not pin.
 */
/**
 * Keep the Electron menu bar in the UI's language.
 *
 * Lives here rather than in `packages/ui` on purpose: `useLocaleStore` is a platform-agnostic
 * dependency leaf and `App` must not learn about Electron. A plain zustand `subscribe` with a
 * manual compare is enough — no `subscribeWithSelector` middleware, and the store stays untouched.
 * `?.` because the web target has no preload bridge.
 */
function syncMenuLocale(initial: Locale): void {
  void window.appLocale?.set?.(initial);
  useLocaleStore.subscribe((state, previous) => {
    if (state.uiLocale !== previous.uiLocale) void window.appLocale?.set?.(state.uiLocale);
  });
}

async function bootstrap(): Promise<void> {
  const locale = persistedLocale();
  await loadLocaleAsync(locale);
  syncMenuLocale(locale);

  createRoot(container as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
