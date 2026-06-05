import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { useProvidersStore } from "../models/useProvidersStore";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

/**
 * Regression guard for the StrictMode double-connect race: `initialize()` awaits `bridge()`
 * before it sets `client`, so two concurrent calls (which React StrictMode triggers by invoking
 * the App mount effect twice) must NOT each open a WebSocket — two sockets double every routed
 * event, doubling all terminal output. We stub the global `WebSocket` and count constructions.
 */
describe("useSessionsStore — initialize is StrictMode-safe", () => {
  let wsCount = 0;
  const realWebSocket = globalThis.WebSocket;
  const realHydrate = useProjectsStore.getState().hydrateActive;
  const realRefresh = useProvidersStore.getState().refreshProviders;

  beforeEach(() => {
    wsCount = 0;
    class FakeWebSocket {
      readyState = 0;
      constructor() {
        wsCount += 1;
      }
      addEventListener() {}
      removeEventListener() {}
      send() {}
      close() {}
    }
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;
    useSessionsStore.setState({ client: undefined, initError: undefined });
    // Keep the post-connect hydration inert so the test only exercises the connect race.
    useProjectsStore.setState({ hydrateActive: async () => {} } as never);
    useProvidersStore.setState({ refreshProviders: async () => {} } as never);
    (window as unknown as { bridge: { connect: () => Promise<unknown> } }).bridge = {
      connect: async () => ({ url: "ws://localhost:65535", token: "tkn" }),
    };
  });

  afterEach(() => {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = realWebSocket;
    useProjectsStore.setState({ hydrateActive: realHydrate } as never);
    useProvidersStore.setState({ refreshProviders: realRefresh } as never);
  });

  test("two concurrent initialize() calls open only one WebSocket", async () => {
    const store = useSessionsStore.getState();
    await Promise.allSettled([store.initialize(), store.initialize()]);
    expect(wsCount).toBe(1);
    expect(useSessionsStore.getState().client).toBeDefined();
  });
});
