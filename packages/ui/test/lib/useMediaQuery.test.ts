import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { useMediaQuery } from "../../src/lib/useMediaQuery";
import { renderHook } from "../utils";

type Listener = (ev: MediaQueryListEvent) => void;

interface MockMql {
  matches: boolean;
  media: string;
  onchange: Listener | null;
  addEventListener: (type: string, listener: Listener) => void;
  removeEventListener: (type: string, listener: Listener) => void;
  dispatchEvent: (ev: MediaQueryListEvent) => boolean;
}

function createMql(matches: boolean, query: string, listeners: Listener[]): MockMql {
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => {
      listeners.push(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => {
      const i = listeners.indexOf(listener);
      if (i >= 0) listeners.splice(i, 1);
    },
    dispatchEvent: () => true,
  };
}

let originalMatchMedia: typeof window.matchMedia;
let activeListeners: Listener[];
let currentMatches: boolean;

beforeEach(() => {
  originalMatchMedia = window.matchMedia;
  activeListeners = [];
  currentMatches = false;
  // biome-ignore lint/suspicious/noExplicitAny: stubbing the global for tests
  (window as any).matchMedia = (query: string) => createMql(currentMatches, query, activeListeners);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("useMediaQuery", () => {
  test("returns the initial match state", () => {
    currentMatches = true;
    const { result } = renderHook(() => useMediaQuery("(max-width: 600px)"));
    expect(result.current).toBe(true);
  });

  test("returns the fallback when matchMedia is unavailable", () => {
    // biome-ignore lint/suspicious/noExplicitAny: simulating non-DOM environment
    (window as any).matchMedia = undefined;
    const { result } = renderHook(() => useMediaQuery("(max-width: 600px)", true));
    expect(result.current).toBe(true);
  });
});
