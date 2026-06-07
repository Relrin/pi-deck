import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { GitChange, GitStatus } from "@pi-deck/core/git/types.js";
import { ChangesToolbar } from "../../../src/features/git/ChangesToolbar";
import { useGitStore } from "../../../src/features/git/useGitStore";
import { useStagingStore } from "../../../src/features/git/useStagingStore";
import { fireEvent, render, screen } from "../../utils";

const PROJECT_ID = "proj-1";

function makeChange(path: string, overrides: Partial<GitChange> = {}): GitChange {
  return {
    path,
    status: "M",
    staged: false,
    untracked: false,
    add: 1,
    del: 0,
    ...overrides,
  };
}

function seedStatus(changes: GitChange[]): void {
  const status: GitStatus = {
    isRepo: true,
    root: "/tmp/repo",
    branch: "main",
    remotes: ["origin"],
    changes,
    totals: { add: 1, del: 0 },
  };
  useGitStore.setState({ statusByProject: { [PROJECT_ID]: status } });
}

beforeEach(() => {
  // Reset both stores to a known baseline before each test so dispatches don't leak
  // across cases. The toolbar reads selected paths from useStagingStore and routes its
  // four actions through stubbed useGitStore methods, so spying on those is enough.
  useStagingStore.setState({ selectedByProject: {} });
  useGitStore.setState({
    statusByProject: {},
    refreshAll: mock(async () => {}),
    rollback: mock(async () => true),
    stash: mock(async () => true),
    stashPop: mock(async () => true),
  });
});

describe("ChangesToolbar", () => {
  test("refresh button is always enabled and calls refreshAll", () => {
    seedStatus([]);
    render(<ChangesToolbar projectId={PROJECT_ID} />);
    const button = screen.getByRole("button", { name: "refresh" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(useGitStore.getState().refreshAll).toHaveBeenCalledWith(PROJECT_ID);
  });

  test("rollback is disabled when nothing is selected", () => {
    seedStatus([makeChange("a.ts")]);
    render(<ChangesToolbar projectId={PROJECT_ID} />);
    expect(screen.getByRole("button", { name: "rollback" })).toBeDisabled();
  });

  test("rollback dispatches with tracked + untracked classification", () => {
    seedStatus([
      makeChange("tracked.ts"),
      makeChange("untracked.ts", { status: "?", untracked: true }),
    ]);
    useStagingStore.setState({
      selectedByProject: { [PROJECT_ID]: new Set(["tracked.ts", "untracked.ts"]) },
    });
    render(<ChangesToolbar projectId={PROJECT_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "rollback" }));
    expect(useGitStore.getState().rollback).toHaveBeenCalledWith(PROJECT_ID, {
      tracked: ["tracked.ts"],
      untracked: ["untracked.ts"],
    });
  });

  test("stash with no selection dispatches without paths (full-tree stash)", () => {
    seedStatus([makeChange("a.ts"), makeChange("b.ts")]);
    render(<ChangesToolbar projectId={PROJECT_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "stash" }));
    expect(useGitStore.getState().stash).toHaveBeenCalledWith(PROJECT_ID, undefined);
  });

  test("stash with a selection dispatches the selected paths only", () => {
    seedStatus([makeChange("a.ts"), makeChange("b.ts")]);
    useStagingStore.setState({
      selectedByProject: { [PROJECT_ID]: new Set(["a.ts"]) },
    });
    render(<ChangesToolbar projectId={PROJECT_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "stash" }));
    expect(useGitStore.getState().stash).toHaveBeenCalledWith(PROJECT_ID, ["a.ts"]);
  });

  test("apply (stash pop) is always enabled and calls stashPop", () => {
    seedStatus([]);
    render(<ChangesToolbar projectId={PROJECT_ID} />);
    const button = screen.getByRole("button", { name: "apply" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(useGitStore.getState().stashPop).toHaveBeenCalledWith(PROJECT_ID);
  });

  test("renders four toolbar buttons in the documented order", () => {
    seedStatus([]);
    render(<ChangesToolbar projectId={PROJECT_ID} />);
    const labels = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual(["refresh", "rollback", "stash", "apply"]);
  });
});
