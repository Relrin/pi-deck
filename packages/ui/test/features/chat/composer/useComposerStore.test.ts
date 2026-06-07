import { beforeEach, describe, expect, test } from "bun:test";
import { useComposerStore } from "../../../../src/features/chat/composer/useComposerStore";
import { useSessionsStore } from "../../../../src/features/sessions/useSessionsStore.js";

beforeEach(() => {
  useComposerStore.setState({ bySession: {} });
  // The setMode path forwards to `useSessionsStore.client.call(...)`; clearing the client
  // makes setMode short-circuit so we can test the optimistic write in isolation.
  useSessionsStore.setState({ client: undefined, sessions: [] });
});

describe("useComposerStore", () => {
  test("getMode falls back to ask when nothing is seeded", () => {
    expect(useComposerStore.getState().getMode("s1")).toBe("ask");
  });

  test("seed sets the per-session mode without triggering an RPC", () => {
    useComposerStore.getState().seed("s1", "plan");
    expect(useComposerStore.getState().getMode("s1")).toBe("plan");
    // A different session keeps its own slot.
    expect(useComposerStore.getState().getMode("s2")).toBe("ask");
  });

  test("setMode optimistically writes the per-session mode", async () => {
    await useComposerStore.getState().setMode("s1", "accept-edits");
    expect(useComposerStore.getState().getMode("s1")).toBe("accept-edits");
  });
});
