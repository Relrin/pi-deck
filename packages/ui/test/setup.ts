import "./happy-dom-setup";
import { afterEach, expect } from "bun:test";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { loadLocale } from "../src/i18n/i18n-util.sync";
import { useLocaleStore } from "../src/i18n/useLocaleStore";

// React 19's `act()` checks this global to decide whether to engage React Testing Library's
// auto-wrapping. Without it, state updates from `userEvent` interactions log noisy
// "not wrapped in act(...)" warnings. RTL sets this automatically in jest, but under Bun's
// preload it needs to be set explicitly before any React render.
// biome-ignore lint/suspicious/noExplicitAny: global typed by React internals only
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Silence "not wrapped in act(...)" warnings emitted by Radix popovers/menus during their own
// internal state transitions. We can't `act()`-wrap library-owned timers from the outside, and
// the warnings bury real failures in a wall of red text. Any other console.error still surfaces.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === "string" && first.includes("not wrapped in act(")) return;
  originalConsoleError(...args);
};

// biome-ignore lint/suspicious/noExplicitAny: bun's expect.extend signature is jest-compatible but typed differently
expect.extend(matchers as any);

// Load the English catalog synchronously, before any test file is evaluated. `loadLocale` is the
// sync variant on purpose: it makes translation lookups a plain function call with no promise and
// no Suspense boundary, which is what lets the hundreds of existing assertions that select elements
// by their English copy keep passing unchanged.
//
// Never `mock.module` the i18n modules. Per AGENTS.md, `mock.module` is process-global and
// unrevertable, and `bun test`'s file order differs by OS (sorted on Windows, readdir on
// Linux/CI) — a leak here would pass locally and fail only in CI. Locale-specific tests use
// `useLocaleStore.setState()` and rely on the reset below.
loadLocale("en");
useLocaleStore.setState({ uiLocale: "en", agentLanguage: "match-ui", pseudo: false });

afterEach(() => {
  cleanup();
  // Pin the locale back after every test so one that switches to Russian cannot silently
  // invalidate every English assertion in whatever file happens to run next.
  useLocaleStore.setState({ uiLocale: "en", agentLanguage: "match-ui", pseudo: false });
});
