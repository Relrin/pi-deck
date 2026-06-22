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

  function setLatestAssistant(id: string) {
    useMessagesStore.setState({
      bySession: {
        [SID]: {
          messages: [
            { kind: "assistant", id, text: "", isComplete: true, toolCallIds: [], createdAt: 1 },
          ],
          toolCalls: {},
          isTurnInFlight: false,
        },
      },
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

  test("parses the plan title and steps", () => {
    usePlanStore.getState().applyPlanFileChanged(SID, PATH, "# Build it\n- [ ] **WRITE** — go");
    const s = usePlanStore.getState().bySession[SID];
    expect(s?.title).toBe("Build it");
    expect(s?.steps).toHaveLength(1);
    expect(s?.steps[0]?.label).toBe("WRITE");
  });

  test("captures a snapshot on a transition, anchored to the latest turn", () => {
    setLatestAssistant("a-0");
    const store = usePlanStore.getState();
    store.applyPlanFileChanged(SID, PATH, "# Build it\n- [ ] **WRITE** — go"); // all pending → none
    expect(snaps()).toHaveLength(0);
    store.applyPlanFileChanged(SID, PATH, "# Build it\n- [~] **WRITE** — go"); // started → snapshot
    const all = snaps();
    expect(all).toHaveLength(1);
    expect(all[0]?.anchorMessageId).toBe("a-0");
    expect(all[0]?.title).toBe("Build it");
    expect(all[0]?.steps[0]?.status).toBe("in-progress");
  });

  test("does not snapshot on first observation (reopen / restart mid-run)", () => {
    setLatestAssistant("a-0");
    usePlanStore.getState().applyPlanFileChanged(SID, PATH, "- [x] done\n- [~] now\n- [ ] next");
    expect(snaps()).toEqual([]);
  });

  test("coalesces consecutive transitions in the same turn into one card", () => {
    setLatestAssistant("a-0");
    const store = usePlanStore.getState();
    store.applyPlanFileChanged(SID, PATH, "- [ ] a\n- [ ] b");
    store.applyPlanFileChanged(SID, PATH, "- [~] a\n- [ ] b"); // start a → snapshot #1
    store.applyPlanFileChanged(SID, PATH, "- [x] a\n- [~] b"); // finish a + start b, same turn → replace
    expect(snaps()).toHaveLength(1);
    expect(snaps()[0]?.steps.map((s) => s.status)).toEqual(["done", "in-progress"]);
  });

  test("a new turn gets its own snapshot", () => {
    const store = usePlanStore.getState();
    setLatestAssistant("a-0");
    store.applyPlanFileChanged(SID, PATH, "- [ ] a\n- [ ] b");
    store.applyPlanFileChanged(SID, PATH, "- [~] a\n- [ ] b"); // turn a-0 → snapshot
    setLatestAssistant("a-1");
    store.applyPlanFileChanged(SID, PATH, "- [x] a\n- [~] b"); // turn a-1 → new snapshot
    const all = snaps();
    expect(all).toHaveLength(2);
    expect(all[0]?.anchorMessageId).toBe("a-0");
    expect(all[1]?.anchorMessageId).toBe("a-1");
  });

  test("tolerates a session entry rehydrated from an older shape (no derived fields)", () => {
    // Simulate a plan-store entry persisted before steps/stepTimings existed — the shape that
    // black-screened the app when a consumer called `undefined.map`/`.find`.
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
    expect(typeof s?.stepTimings).toBe("object");
    expect(Array.isArray(s?.snapshots)).toBe(true);
  });
});
