import { beforeEach, describe, expect, test } from "bun:test";
import { selectPlanSession, usePlanStore } from "../../../src/features/plan-panel/usePlanStore";

const SID = "session-1";

function reset() {
  usePlanStore.setState({ bySession: {} });
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
