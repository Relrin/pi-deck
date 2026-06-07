import { beforeEach, describe, expect, mock, test } from "bun:test";
import { DiffTab } from "../../../src/features/diff/DiffTab";
import { useProjectsStore } from "../../../src/features/sessions/useProjectsStore";
import { useSessionsStore } from "../../../src/features/sessions/useSessionsStore";
import { useNavStore } from "../../../src/lib/useNavStore";
import { render, screen } from "../../utils";

const PROJ_A = "11111111-1111-4111-8111-111111111111";
const PROJ_B = "22222222-2222-4222-8222-222222222222";
const PLACEHOLDER = "Pick a file in the git sidebar to view its diff.";

/** Install a client whose `diff.get` never resolves, so the body stays on "Loading…" and the
 *  Pierre-backed `DiffView` never mounts — keeps these tests off the worker pool / Shadow DOM. */
function installClient() {
  const call = mock((_method: string, _input: unknown) => new Promise<never>(() => {}));
  useSessionsStore.setState((prev) => ({ ...prev, client: { call } as never }));
  return call;
}

beforeEach(() => {
  useNavStore.setState({ screen: "git-diff", diffTarget: null });
  useProjectsStore.setState({ activeProjectId: undefined });
  useSessionsStore.setState((prev) => ({
    ...prev,
    // activeSessionId stays undefined so DiffChangesetHeader renders nothing in the match case.
    activeSessionId: undefined,
    sessions: [],
  }));
});

describe("DiffTab — cross-project diff target guard", () => {
  test("ignores a diff target from a different project than the active one", () => {
    const call = installClient();
    useProjectsStore.setState({ activeProjectId: PROJ_B });
    useNavStore.setState({
      screen: "git-diff",
      diffTarget: { projectId: PROJ_A, path: "src/a.ts" },
    });

    render(<DiffTab />);

    // Stale cross-project target is treated as "no selection" — placeholder, no fetch.
    expect(screen.getByText(PLACEHOLDER)).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });

  test("shows the placeholder and fetches nothing when there is no target", () => {
    const call = installClient();
    useProjectsStore.setState({ activeProjectId: PROJ_A });
    useNavStore.setState({ screen: "git-diff", diffTarget: null });

    render(<DiffTab />);

    expect(screen.getByText(PLACEHOLDER)).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });

  test("fetches the diff when the target's project matches the active project", () => {
    const call = installClient();
    useProjectsStore.setState({ activeProjectId: PROJ_A });
    useNavStore.setState({
      screen: "git-diff",
      diffTarget: { projectId: PROJ_A, path: "src/a.ts" },
    });

    render(<DiffTab />);

    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0]?.[0]).toBe("diff.get");
    expect(call.mock.calls[0]?.[1]).toMatchObject({ projectId: PROJ_A, path: "src/a.ts" });
    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
  });
});
