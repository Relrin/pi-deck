import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, userEvent } from "../../../test/utils";
import { useToastStore } from "../_status/useToastStore";
import { useGitStore } from "../git/useGitStore";
import { useSessionsStore } from "../sessions/useSessionsStore";
import { PidBranchPicker } from "./PidBranchPicker";

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
    branchesByProject: {
      "proj-1": [
        { name: "main", isCurrent: true },
        { name: "feat/auth", isCurrent: false },
        { name: "feat/billing", isCurrent: false },
      ],
    },
    currentBranchByProject: { "proj-1": "main" },
    loadingByProject: {},
    errorByProject: {},
  });
  useSessionsStore.setState({
    sessions: [],
    activeSessionId: undefined,
    isRefreshing: false,
    client: undefined,
  });
  useToastStore.setState({ toasts: [] });
});

describe("PidBranchPicker", () => {
  test("trigger shows the current branch", () => {
    render(<PidBranchPicker projectId="proj-1" />);
    expect(screen.getByRole("button", { name: /select branch/i })).toHaveTextContent("main");
  });

  test("trigger shows 'none' and is disabled when no project is active", () => {
    render(<PidBranchPicker projectId={undefined} />);
    const trigger = screen.getByRole("button", { name: /select branch/i });
    expect(trigger).toHaveTextContent("none");
    expect(trigger).toBeDisabled();
  });

  test("typing a query fuzzy-filters the menu items", async () => {
    const user = userEvent.setup();
    render(<PidBranchPicker projectId="proj-1" />);
    await user.click(screen.getByRole("button", { name: /select branch/i }));

    const input = await screen.findByLabelText(/search or type new branch/i);
    await user.type(input, "auth");

    // Scope to menuitems so we don't match the trigger button's "main" label.
    expect(screen.getByRole("menuitem", { name: /feat\/auth/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /feat\/billing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^main$/i })).not.toBeInTheDocument();
  });

  test("typing a name that no branch matches reveals the Create CTA with the typed name", async () => {
    const user = userEvent.setup();
    render(<PidBranchPicker projectId="proj-1" />);
    await user.click(screen.getByRole("button", { name: /select branch/i }));

    const input = await screen.findByLabelText(/search or type new branch/i);
    await user.type(input, "new-branch");

    const createCta = screen.getByRole("menuitem", { name: /create branch.*new-branch/i });
    expect(createCta).toBeInTheDocument();
  });

  test("pressing Enter on the Create CTA dispatches git.createBranch with the typed name", async () => {
    const user = userEvent.setup();
    const client = mockClient({
      "git.createBranch": () => ({ ok: true }),
      "git.listBranches": () => ({ branches: [] }),
      "git.currentBranch": () => ({ name: "new-branch" }),
    });
    useSessionsStore.setState({ client: client as never });

    render(<PidBranchPicker projectId="proj-1" />);
    await user.click(screen.getByRole("button", { name: /select branch/i }));

    const input = await screen.findByLabelText(/search or type new branch/i);
    await user.type(input, "new-branch{Enter}");

    const createCall = client.call.mock.calls.find((c) => c[0] === "git.createBranch");
    expect(createCall).toBeDefined();
    expect(createCall?.[1]).toEqual({ projectId: "proj-1", name: "new-branch" });
  });

  test("clicking a branch row dispatches git.checkoutBranch", async () => {
    const user = userEvent.setup();
    const client = mockClient({
      "git.checkoutBranch": () => ({ ok: true }),
      "git.listBranches": () => ({
        branches: [
          { name: "main", isCurrent: false },
          { name: "feat/auth", isCurrent: true },
          { name: "feat/billing", isCurrent: false },
        ],
      }),
      "git.currentBranch": () => ({ name: "feat/auth" }),
    });
    useSessionsStore.setState({ client: client as never });

    render(<PidBranchPicker projectId="proj-1" />);
    await user.click(screen.getByRole("button", { name: /select branch/i }));
    await user.click(await screen.findByRole("menuitem", { name: /feat\/auth/i }));

    const checkoutCall = client.call.mock.calls.find((c) => c[0] === "git.checkoutBranch");
    expect(checkoutCall).toBeDefined();
    expect(checkoutCall?.[1]).toEqual({ projectId: "proj-1", name: "feat/auth" });
  });
});
