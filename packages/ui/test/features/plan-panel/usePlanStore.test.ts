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

describe("usePlanStore — progress timings", () => {
  const PATH = "/repo/.pi-deck/plans/session-1.md";

  beforeEach(reset);

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
  });
});
