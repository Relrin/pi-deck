import { beforeEach, describe, expect, mock, test } from "bun:test";
import { useNotificationStore } from "../_status/useNotificationStore";
import { useSessionsStore } from "../sessions/useSessionsStore";
import { useGitStore } from "./useGitStore";

function mockClient(handlers: Record<string, (input: unknown) => unknown>) {
  return {
    call: mock(async (method: string, input: unknown) => {
      const fn = handlers[method];
      if (!fn) throw new Error(`Unmocked method: ${method}`);
      return fn(input);
    }),
  };
}

beforeEach(() => {
  useGitStore.setState({
    branchesByProject: {},
    currentBranchByProject: {},
    loadingByProject: {},
    errorByProject: {},
    statusByProject: {},
    commitsByProject: {},
    statusLoadingByProject: {},
    commitsLoadingByProject: {},
    touchesBySession: {},
  });
  useSessionsStore.setState({
    sessions: [],
    activeSessionId: undefined,
    isRefreshing: false,
    client: undefined,
  });
  useNotificationStore.setState({ notifications: [] });
});

describe("useGitStore.createBranch", () => {
  test("calls git.createBranch with the projectId+name and sets the new branch as current", async () => {
    const client = mockClient({
      "git.createBranch": () => ({ ok: true }),
      // refresh fires next — stub both git reads with empty payloads so it resolves cleanly.
      "git.listBranches": () => ({ branches: [] }),
      "git.currentBranch": () => ({ name: "feat/x" }),
    });
    useSessionsStore.setState({ client: client as never });

    await useGitStore.getState().createBranch("proj-1", "feat/x");

    const createCall = client.call.mock.calls.find((c) => c[0] === "git.createBranch");
    expect(createCall).toBeDefined();
    expect(createCall?.[1]).toEqual({ projectId: "proj-1", name: "feat/x" });
    expect(useGitStore.getState().currentBranchByProject["proj-1"]).toBe("feat/x");
  });

  test("schedules a refresh after a successful create", async () => {
    const client = mockClient({
      "git.createBranch": () => ({ ok: true }),
      "git.listBranches": () => ({
        branches: [{ name: "feat/x", isCurrent: true }],
      }),
      "git.currentBranch": () => ({ name: "feat/x" }),
    });
    useSessionsStore.setState({ client: client as never });

    await useGitStore.getState().createBranch("proj-1", "feat/x");
    // refresh runs as a fire-and-forget microtask chain; yield a tick so it lands.
    await new Promise<void>((r) => setTimeout(r, 0));

    expect(useGitStore.getState().branchesByProject["proj-1"]).toEqual([
      { name: "feat/x", isCurrent: true },
    ]);
  });

  test("on failure pushes a notification and re-throws", async () => {
    const client = mockClient({
      "git.createBranch": () => {
        throw new Error("fatal: a branch named 'feat/x' already exists");
      },
    });
    useSessionsStore.setState({ client: client as never });

    await expect(useGitStore.getState().createBranch("proj-1", "feat/x")).rejects.toThrow(
      "fatal: a branch named 'feat/x' already exists",
    );
    const notifications = useNotificationStore.getState().notifications;
    expect(notifications.length).toBe(1);
    expect(notifications[0]?.kind).toBe("error");
    expect(useGitStore.getState().currentBranchByProject["proj-1"]).toBeUndefined();
  });

  test("no-op when there is no protocol client", async () => {
    // client is already undefined from beforeEach.
    await useGitStore.getState().createBranch("proj-1", "feat/x");
    expect(useGitStore.getState().currentBranchByProject["proj-1"]).toBeUndefined();
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });
});
