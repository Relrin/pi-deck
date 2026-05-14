import { beforeEach, describe, expect, test } from "bun:test";
import { useToastStore } from "../_status/useToastStore";
import { useMessagesStore } from "../chat/useMessagesStore";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

function makeMockClient(handlers: Record<string, (input: unknown) => unknown>) {
  return {
    call: async (method: string, input: unknown) => {
      const fn = handlers[method];
      if (!fn) throw new Error(`Unmocked method: ${method}`);
      return fn(input);
    },
  } as unknown as Parameters<typeof useSessionsStore.setState>[0] extends infer _ ? never : never;
}

// Loosely-typed mock for the bits of ProtocolClient we exercise here.
function mockClient(handlers: Record<string, (input: unknown) => unknown>) {
  return {
    call: async (method: string, input: unknown) => {
      const fn = handlers[method];
      if (!fn) throw new Error(`Unmocked method: ${method}`);
      return fn(input);
    },
  };
}
void makeMockClient; // silence unused

beforeEach(() => {
  useSessionsStore.setState({
    sessions: [],
    activeSessionId: undefined,
    isRefreshing: false,
    client: undefined,
  });
  useProjectsStore.setState({
    projects: [],
    activeProjectId: undefined,
    lastActiveSessionByProject: {},
  });
  useToastStore.setState({ toasts: [] });
  useMessagesStore.setState({ bySession: {} });
});

describe("useSessionsStore — refresh", () => {
  test("isRefreshing flips around the call and lands true→false", async () => {
    const client = mockClient({ "session.list": () => ({ sessions: [] }) });
    useSessionsStore.setState({ client: client as never });

    const refreshPromise = useSessionsStore.getState().refreshSessions("proj-1");
    expect(useSessionsStore.getState().isRefreshing).toBe(true);
    await refreshPromise;
    expect(useSessionsStore.getState().isRefreshing).toBe(false);
  });

  test("error pushes a toast and still resolves isRefreshing", async () => {
    const client = mockClient({
      "session.list": () => {
        throw new Error("boom");
      },
    });
    useSessionsStore.setState({ client: client as never });
    await useSessionsStore.getState().refreshSessions("proj-1");
    expect(useSessionsStore.getState().isRefreshing).toBe(false);
    expect(useToastStore.getState().toasts.length).toBe(1);
    expect(useToastStore.getState().toasts[0]?.kind).toBe("error");
  });
});

describe("useSessionsStore — createSession", () => {
  test("appends, activates, and remembers the new session", async () => {
    const session = {
      id: "sess-new",
      projectId: "proj-1",
      title: "New",
      lastActivityAt: new Date().toISOString(),
    };
    const client = mockClient({ "session.create": () => ({ session }) });
    useSessionsStore.setState({ client: client as never });
    useProjectsStore.setState({ activeProjectId: "proj-1" });

    await useSessionsStore.getState().createSession("proj-1");

    expect(useSessionsStore.getState().sessions).toHaveLength(1);
    expect(useSessionsStore.getState().activeSessionId).toBe("sess-new");
    expect(useProjectsStore.getState().lastActiveSessionByProject["proj-1"]).toBe("sess-new");
  });

  test("backend error surfaces a toast and re-throws", async () => {
    const client = mockClient({
      "session.create": () => {
        throw new Error("nope");
      },
    });
    useSessionsStore.setState({ client: client as never });

    await expect(useSessionsStore.getState().createSession("proj-1")).rejects.toThrow();
    expect(useToastStore.getState().toasts.length).toBe(1);
  });
});

describe("useSessionsStore — activateSession", () => {
  test("sets activeSessionId and writes the memory", async () => {
    const client = mockClient({ "session.activate": () => ({}) });
    useSessionsStore.setState({ client: client as never });
    useProjectsStore.setState({ activeProjectId: "proj-1" });

    await useSessionsStore.getState().activateSession("sess-1");
    expect(useSessionsStore.getState().activeSessionId).toBe("sess-1");
    expect(useProjectsStore.getState().lastActiveSessionByProject["proj-1"]).toBe("sess-1");
  });
});

describe("useSessionsStore — setActiveSessionId", () => {
  test("writes both the local active id and the per-project memory", () => {
    useProjectsStore.setState({ activeProjectId: "proj-1" });
    useSessionsStore.getState().setActiveSessionId("sess-x");
    expect(useSessionsStore.getState().activeSessionId).toBe("sess-x");
    expect(useProjectsStore.getState().lastActiveSessionByProject["proj-1"]).toBe("sess-x");
  });

  test("setting undefined clears the per-project memory", () => {
    useProjectsStore.setState({
      activeProjectId: "proj-1",
      lastActiveSessionByProject: { "proj-1": "sess-x" },
    });
    useSessionsStore.getState().setActiveSessionId(undefined);
    expect(useProjectsStore.getState().lastActiveSessionByProject["proj-1"]).toBeUndefined();
  });
});

describe("useSessionsStore — updateSessionMetadata", () => {
  test("merges fields into the matching session", () => {
    const session = {
      id: "sess-1",
      projectId: "proj-1",
      title: "old",
      lastActivityAt: new Date().toISOString(),
    };
    useSessionsStore.setState({ sessions: [session] });
    useSessionsStore.getState().updateSessionMetadata("sess-1", { title: "new" });
    expect(useSessionsStore.getState().sessions[0]?.title).toBe("new");
  });

  test("unknown ids are silently ignored", () => {
    useSessionsStore.getState().updateSessionMetadata("missing", { title: "new" });
    expect(useSessionsStore.getState().sessions).toEqual([]);
  });
});

describe("useSessionsStore — sendPrompt", () => {
  test("marks turn in flight, appends optimistic user message on ack", async () => {
    const client = mockClient({ "session.prompt": () => ({}) });
    useSessionsStore.setState({ client: client as never, activeSessionId: "sess-1" });

    await useSessionsStore.getState().sendPrompt("hello");

    expect(useMessagesStore.getState().bySession["sess-1"]?.isTurnInFlight).toBe(true);
    const msgs = useMessagesStore.getState().bySession["sess-1"]?.messages ?? [];
    expect(msgs.some((m) => m.kind === "user" && m.text === "hello")).toBe(true);
  });

  test("error resets isTurnInFlight, surfaces a toast and re-throws", async () => {
    const client = mockClient({
      "session.prompt": () => {
        throw new Error("rate-limited");
      },
    });
    useSessionsStore.setState({ client: client as never, activeSessionId: "sess-1" });

    await expect(useSessionsStore.getState().sendPrompt("hi")).rejects.toThrow();
    expect(useMessagesStore.getState().bySession["sess-1"]?.isTurnInFlight).toBe(false);
    expect(useToastStore.getState().toasts.length).toBe(1);
  });
});
