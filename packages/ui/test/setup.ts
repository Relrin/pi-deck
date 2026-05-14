import "./happy-dom-setup";
import { afterEach, expect } from "bun:test";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";

// React 19's `act()` checks this global to decide whether to engage React Testing Library's
// auto-wrapping. Without it, state updates from `userEvent` interactions log noisy
// "not wrapped in act(...)" warnings. RTL sets this automatically in jest, but under Bun's
// preload it needs to be set explicitly before any React render.
// biome-ignore lint/suspicious/noExplicitAny: global typed by React internals only
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// biome-ignore lint/suspicious/noExplicitAny: bun's expect.extend signature is jest-compatible but typed differently
expect.extend(matchers as any);

afterEach(() => {
  cleanup();
});
