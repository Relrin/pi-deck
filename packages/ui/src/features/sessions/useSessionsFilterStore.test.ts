import { beforeEach, describe, expect, test } from "bun:test";
import {
  ALL_STATUSES,
  DEFAULTS,
  dirtyCount,
  isSectionDirty,
  useSessionsFilterStore,
} from "./useSessionsFilterStore";

beforeEach(() => {
  useSessionsFilterStore.getState().reset();
});

describe("useSessionsFilterStore", () => {
  test("starts at defaults", () => {
    const s = useSessionsFilterStore.getState();
    expect(s.status).toEqual([...DEFAULTS.status]);
    expect(s.project).toEqual({ kind: "all" });
    expect(s.since).toBe(DEFAULTS.since);
    expect(s.sort).toBe(DEFAULTS.sort);
    expect(s.group).toBe(DEFAULTS.group);
    expect(dirtyCount(s)).toBe(0);
  });

  test("changing each section is reflected in dirtyCount and isSectionDirty", () => {
    const store = useSessionsFilterStore;

    store.getState().setSince("1d");
    expect(isSectionDirty(store.getState(), "since")).toBe(true);
    expect(dirtyCount(store.getState())).toBe(1);

    store.getState().setSort("created");
    expect(isSectionDirty(store.getState(), "sort")).toBe(true);
    expect(dirtyCount(store.getState())).toBe(2);

    store.getState().setGroup("branch");
    expect(dirtyCount(store.getState())).toBe(3);

    store.getState().toggleStatus("running");
    expect(isSectionDirty(store.getState(), "status")).toBe(true);
    expect(dirtyCount(store.getState())).toBe(4);

    store.getState().setProject({ kind: "subset", ids: ["a"] });
    expect(isSectionDirty(store.getState(), "project")).toBe(true);
    expect(dirtyCount(store.getState())).toBe(5);
  });

  test("reset returns every section to its default", () => {
    const s = useSessionsFilterStore;
    s.getState().setSince("30d");
    s.getState().setSort("branch");
    s.getState().setGroup("flat");
    s.getState().setProject({ kind: "subset", ids: ["a", "b"] });
    expect(dirtyCount(s.getState())).toBe(4);

    s.getState().reset();
    expect(dirtyCount(s.getState())).toBe(0);
    expect(s.getState().since).toBe(DEFAULTS.since);
    expect(s.getState().project).toEqual({ kind: "all" });
  });

  test("toggleProject collapses to the 'all' sentinel when every project is re-checked", () => {
    const s = useSessionsFilterStore;
    const ids = ["a", "b", "c"];

    // First toggle: drop "b" from the implicit "all" set.
    s.getState().toggleProject("b", ids);
    expect(s.getState().project).toEqual({ kind: "subset", ids: ["a", "c"] });
    expect(isSectionDirty(s.getState(), "project")).toBe(true);

    // Re-check "b": every project is selected again — the store collapses back to "all".
    s.getState().toggleProject("b", ids);
    expect(s.getState().project).toEqual({ kind: "all" });
    expect(isSectionDirty(s.getState(), "project")).toBe(false);
  });

  test("toggleStatus removes an enabled status and re-adds it", () => {
    const s = useSessionsFilterStore;
    s.getState().toggleStatus("review");
    expect(s.getState().status.includes("review")).toBe(false);
    expect(s.getState().status.length).toBe(ALL_STATUSES.length - 1);

    s.getState().toggleStatus("review");
    expect(s.getState().status.includes("review")).toBe(true);
    // Order may differ after a remove+add, but every default status must be back.
    for (const st of ALL_STATUSES) {
      expect(s.getState().status.includes(st)).toBe(true);
    }
    expect(isSectionDirty(s.getState(), "status")).toBe(false);
  });
});
