import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, userEvent, waitFor } from "../../../test/utils";
import { useProjectsStore } from "../sessions/useProjectsStore";
import { useSessionsStore } from "../sessions/useSessionsStore";
import { PidRepoFileSearchDialog } from "./PidRepoFileSearchDialog";

const SAMPLE_PATHS = [
  "src/app.ts",
  "src/lib/foo.ts",
  "src/lib/bar.ts",
  "src/lib/baz.ts",
  "src/components/Header.tsx",
  "src/components/Footer.tsx",
  "src/utils/format.ts",
  "src/utils/date.ts",
  "src/index.ts",
  "README.md",
];

function p(i: number): string {
  const v = SAMPLE_PATHS[i];
  if (v === undefined) throw new Error(`No sample path at index ${i}`);
  return v;
}

function makeClient(handler?: (input: unknown) => unknown) {
  return {
    call: mock(async (method: string, input: unknown) => {
      if (method !== "project.listFiles") throw new Error(`Unmocked method: ${method}`);
      if (handler) return handler(input);
      return { entries: SAMPLE_PATHS.map((path) => ({ path })) };
    }),
  };
}

function row(path: string) {
  return screen.getByRole("button", {
    name: new RegExp(path.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")),
  });
}

beforeEach(() => {
  useProjectsStore.setState({
    projects: [
      {
        id: "proj-1",
        path: "/p/1",
        displayName: "Proj 1",
        lastOpenedAt: "2026-05-16T12:00:00Z",
      },
    ],
    activeProjectId: "proj-1",
    lastActiveSessionByProject: {},
  });
  useSessionsStore.setState({
    sessions: [],
    activeSessionId: undefined,
    isRefreshing: false,
    // biome-ignore lint/suspicious/noExplicitAny: minimal mock satisfies the typed `call` site
    client: makeClient() as any,
  });
});

async function renderDialog(onSelect = mock((_paths: string[]) => {}), onClose = mock(() => {})) {
  render(<PidRepoFileSearchDialog open onClose={onClose} onSelect={onSelect} />);
  await waitFor(() => expect(screen.getByText(p(0))).toBeInTheDocument());
  return { onSelect, onClose };
}

describe("PidRepoFileSearchDialog", () => {
  test("renders the project files once loaded", async () => {
    await renderDialog();
    for (const path of SAMPLE_PATHS.slice(0, 5)) {
      expect(screen.getByText(path)).toBeInTheDocument();
    }
  });

  test("first row is the active highlight on open", async () => {
    await renderDialog();
    expect(row(p(0))).toHaveAttribute("data-active", "true");
    expect(row(p(1))).not.toHaveAttribute("data-active");
  });

  test("ArrowDown advances the active row, Enter toggles it as picked", async () => {
    const user = userEvent.setup();
    await renderDialog();

    await user.keyboard("{ArrowDown}");
    expect(row(p(1))).toHaveAttribute("data-active", "true");
    expect(row(p(0))).not.toHaveAttribute("data-active");

    await user.keyboard("{Enter}");
    expect(row(p(1))).toHaveAttribute("data-picked", "true");
    expect(row(p(0))).not.toHaveAttribute("data-picked");
  });

  test("ArrowUp at index 0 is clamped (no negative index)", async () => {
    const user = userEvent.setup();
    await renderDialog();

    await user.keyboard("{ArrowUp}");
    expect(row(p(0))).toHaveAttribute("data-active", "true");
  });

  test("Enter on the input (focused) still toggles the active row", async () => {
    const user = userEvent.setup();
    await renderDialog();
    // Input is auto-focused on open; Enter should bubble to Dialog.Content's handler.
    const input = screen.getByLabelText(/search project files/i);
    expect(document.activeElement).toBe(input);
    await user.keyboard("{Enter}");
    expect(row(p(0))).toHaveAttribute("data-picked", "true");
  });

  test("input is not disabled on first render (regression guard for the focus bug)", async () => {
    // Render with a deferred client so entries are briefly undefined.
    let resolveCall: ((v: unknown) => void) | undefined;
    const deferred = new Promise((r) => {
      resolveCall = r;
    });
    useSessionsStore.setState({
      // biome-ignore lint/suspicious/noExplicitAny: minimal mock
      client: { call: mock(() => deferred) } as any,
    });
    render(<PidRepoFileSearchDialog open onClose={() => {}} onSelect={() => {}} />);
    const input = screen.getByLabelText(/search project files/i);
    expect(input).not.toBeDisabled();
    resolveCall?.({ entries: SAMPLE_PATHS.map((path) => ({ path })) });
    await waitFor(() => expect(screen.getByText(p(0))).toBeInTheDocument());
  });

  test("caps picks at 5 — sixth selection via Enter is a no-op", async () => {
    const user = userEvent.setup();
    await renderDialog();

    // Pick 5 rows by Enter+ArrowDown.
    for (let i = 0; i < 5; i++) {
      await user.keyboard("{Enter}{ArrowDown}");
    }
    // The 6th row is now active (index 5). Try to pick it.
    expect(row(p(5))).toHaveAttribute("data-active", "true");
    await user.keyboard("{Enter}");

    // Still only the first 5 picked.
    for (let i = 0; i < 5; i++) {
      expect(row(p(i))).toHaveAttribute("data-picked", "true");
    }
    expect(row(p(5))).not.toHaveAttribute("data-picked");
  });

  test("caps picks at 5 — unpicked rows are rendered disabled at cap", async () => {
    const user = userEvent.setup();
    await renderDialog();
    for (let i = 0; i < 5; i++) {
      await user.keyboard("{Enter}{ArrowDown}");
    }
    expect(row(p(5))).toBeDisabled();
    expect(row(p(6))).toBeDisabled();
    // Picked rows stay clickable so the user can deselect.
    expect(row(p(0))).not.toBeDisabled();
  });

  test("deselecting at the cap re-enables the disabled rows", async () => {
    const user = userEvent.setup();
    await renderDialog();
    for (let i = 0; i < 5; i++) {
      await user.keyboard("{Enter}{ArrowDown}");
    }
    expect(row(p(5))).toBeDisabled();

    // Click the first picked row to deselect.
    await user.click(row(p(0)));
    expect(row(p(0))).not.toHaveAttribute("data-picked");
    expect(row(p(5))).not.toBeDisabled();
  });

  test("footer hint: empty state and selected count", async () => {
    const user = userEvent.setup();
    await renderDialog();
    expect(screen.getByText(/↑↓ navigate · ↵ toggle/)).toBeInTheDocument();

    await user.keyboard("{Enter}{ArrowDown}{Enter}{ArrowDown}{Enter}");
    expect(screen.getByText("3/5 selected")).toBeInTheDocument();
  });

  test("Add button calls onSelect with picked paths and resets state", async () => {
    const user = userEvent.setup();
    const { onSelect } = await renderDialog();

    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    await user.click(screen.getByRole("button", { name: /^Add \(2\)$/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith([p(0), p(1)]);
  });
});
