import { beforeEach, describe, expect, test } from "bun:test";
import { useMessagesStore } from "../../../src/features/chat/useMessagesStore";
import { selectPlanSession, usePlanStore } from "../../../src/features/plan-panel/usePlanStore";

const SID = "session-1";

function reset() {
  usePlanStore.setState({ bySession: {} });
  useMessagesStore.setState({ bySession: {} });
}

describe("usePlanStore — plan-file lifecycle", () => {
  beforeEach(reset);

  test("applyPlanFileChanged seeds path + content for a fresh session", () => {
    usePlanStore
      .getState()
      .applyPlanFileChanged(SID, "/repo/.pi-deck/plans/session-1.md", "# Plan\n- [ ] go");
    const s = usePlanStore.getState().bySession[SID];
    expect(s?.filePath).toBe("/repo/.pi-deck/plans/session-1.md");
    expect(s?.fileContent).toContain("Plan");
  });

  test("auto-opens the panel the first time a non-empty plan arrives", () => {
    usePlanStore.getState().applyPlanFileChanged(SID, "/p.md", "- [ ] write tests");
    const s = usePlanStore.getState().bySession[SID];
    expect(s?.panelOpen).toBe(true);
  });

  test("does not auto-open when the file is missing (content === null)", () => {
    usePlanStore.getState().applyPlanFileChanged(SID, "/p.md", null);
    expect(usePlanStore.getState().bySession[SID]?.panelOpen).toBe(false);
  });

  test("respects an explicit close: subsequent plan-file updates do NOT re-open", () => {
    usePlanStore.getState().applyPlanFileChanged(SID, "/p.md", "- [ ] step");
    expect(usePlanStore.getState().bySession[SID]?.panelOpen).toBe(true);
    usePlanStore.getState().setPanelOpen(SID, false);
    expect(usePlanStore.getState().bySession[SID]?.panelClosedByUser).toBe(true);
    usePlanStore.getState().applyPlanFileChanged(SID, "/p.md", "- [x] step\n- [ ] step 2");
    expect(usePlanStore.getState().bySession[SID]?.panelOpen).toBe(false);
  });

  test("setLastApproval remembers the picked target mode per session", () => {
    usePlanStore.getState().setLastApproval(SID, "accept-edits");
    expect(usePlanStore.getState().bySession[SID]?.lastApproval).toEqual({
      targetMode: "accept-edits",
    });
  });

  test("clearSession drops the entry", () => {
    usePlanStore.getState().applyPlanFileChanged(SID, "/p.md", "x");
    usePlanStore.getState().clearSession(SID);
    expect(usePlanStore.getState().bySession[SID]).toBeUndefined();
  });

  test("idempotent on duplicate plan-file events with identical payload", () => {
    usePlanStore.getState().applyPlanFileChanged(SID, "/p.md", "x");
    const ref1 = usePlanStore.getState().bySession;
    usePlanStore.getState().applyPlanFileChanged(SID, "/p.md", "x");
    const ref2 = usePlanStore.getState().bySession;
    expect(ref1).toBe(ref2);
  });

  test("selectPlanSession returns a stable empty for unknown sessions", () => {
    const get1 = selectPlanSession(undefined)(usePlanStore.getState());
    const get2 = selectPlanSession("never")(usePlanStore.getState());
    // Both fall through to the frozen EMPTY_STATE singleton, so any infinite-loop
    // detection in React (e.g. useSyncExternalStore) sees a stable reference.
    expect(get1).toBe(get2);
  });
});

describe("usePlanStore — progress timings + snapshots", () => {
  const PATH = "/repo/.pi-deck/plans/session-1.md";

  beforeEach(reset);

  function setAssistantCount(n: number) {
    const messages = Array.from({ length: n }, (_, i) => ({
      kind: "assistant" as const,
      id: `a-${i}`,
      text: "",
      isComplete: true,
      toolCallIds: [] as string[],
      createdAt: i,
    }));
    useMessagesStore.setState({
      bySession: { [SID]: { messages, toolCalls: {}, isTurnInFlight: false } },
    });
  }

  const snaps = () => usePlanStore.getState().bySession[SID]?.snapshots ?? [];

  test("tracks step timings: startedAt on [ ]→[~], endedAt on [~]→[x]", () => {
    const store = usePlanStore.getState();
    store.applyPlanFileChanged(SID, PATH, "- [ ] **WRITE** — build it");
    store.applyPlanFileChanged(SID, PATH, "- [~] **WRITE** — build it");
    const stepId = usePlanStore.getState().bySession[SID]?.steps[0]?.id as string;
    const started = usePlanStore.getState().bySession[SID]?.stepTimings[stepId]?.startedAt;
    expect(started).toBeGreaterThan(0);

    store.applyPlanFileChanged(SID, PATH, "- [x] **WRITE** — build it");
    const t = usePlanStore.getState().bySession[SID]?.stepTimings[stepId];
    expect(t?.endedAt).toBeGreaterThanOrEqual(t?.startedAt as number);
  });

  test("does not snapshot on first observation (reopen / restart mid-run)", () => {
    setAssistantCount(20);
    usePlanStore
      .getState()
      .applyPlanFileChanged(SID, PATH, "- [x] done\n- [~] working\n- [ ] next");
    expect(snaps()).toEqual([]);
  });

  test("captures a frozen snapshot once progress starts, anchored to the latest turn", () => {
    setAssistantCount(1); // latest assistant id === "a-0"
    const store = usePlanStore.getState();
    store.applyPlanFileChanged(SID, PATH, "# Build it\n- [ ] **WRITE** — build it"); // all pending → none
    expect(snaps()).toHaveLength(0);
    store.applyPlanFileChanged(SID, PATH, "# Build it\n- [~] **WRITE** — build it"); // progress → #1
    const all = snaps();
    expect(all).toHaveLength(1);
    expect(all[0]?.anchorMessageId).toBe("a-0");
    expect(all[0]?.title).toBe("Build it");
    expect(all[0]?.steps[0]?.status).toBe("in-progress");
  });

  test("respects the message cadence between snapshots", () => {
    setAssistantCount(1);
    const store = usePlanStore.getState();
    store.applyPlanFileChanged(SID, PATH, "- [ ] a\n- [ ] b"); // first obs, no progress
    store.applyPlanFileChanged(SID, PATH, "- [~] a\n- [ ] b"); // progress → #1 (count 1)
    expect(snaps()).toHaveLength(1);
    store.applyPlanFileChanged(SID, PATH, "- [x] a\n- [~] b"); // count still 1 → no new
    expect(snaps()).toHaveLength(1);
    setAssistantCount(13); // +12 messages
    store.applyPlanFileChanged(SID, PATH, "- [x] a\n- [x] b"); // count 13 → #2
    expect(snaps()).toHaveLength(2);
    const last = snaps()[1];
    expect(last?.steps.map((s) => s.status)).toEqual(["done", "done"]);
    expect(last?.steps[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("tolerates a session entry rehydrated from an older shape (no derived fields)", () => {
    // Simulate a plan-store entry persisted before snapshots/steps/stepTimings existed — the
    // shape that black-screened the app when a consumer called `undefined.map`/`.find`.
    usePlanStore.setState({
      bySession: {
        [SID]: {
          filePath: "/p.md",
          fileContent: "- [ ] a",
          panelOpen: true,
          panelClosedByUser: false,
          lastApproval: null,
        } as unknown as ReturnType<typeof usePlanStore.getState>["bySession"][string],
      },
    });
    expect(() =>
      usePlanStore.getState().applyPlanFileChanged(SID, "/p.md", "- [~] a"),
    ).not.toThrow();
    const s = usePlanStore.getState().bySession[SID];
    expect(Array.isArray(s?.steps)).toBe(true);
    expect(Array.isArray(s?.snapshots)).toBe(true);
  });
});
