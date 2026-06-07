import { beforeEach, describe, expect, test } from "bun:test";
import { useNotificationStore } from "../../../../src/features/_status/useNotificationStore";
import { ApprovalPill } from "../../../../src/features/chat/tools/ApprovalPill";
import { useAutoAllowStore } from "../../../../src/features/chat/tools/useAutoAllowStore";
import { useSessionsStore } from "../../../../src/features/sessions/useSessionsStore";
import type { ProtocolClient } from "../../../../src/lib/transport/protocol-client";
import { fireEvent, render, screen } from "../../../utils";

interface ApprovalCall {
  sessionId: string;
  approvalId: string;
  decision: "allow" | "deny";
}

function setupClient(): { calls: ApprovalCall[] } {
  const calls: ApprovalCall[] = [];
  const fakeClient = {
    toolApproval: async (sessionId: string, approvalId: string, decision: "allow" | "deny") => {
      calls.push({ sessionId, approvalId, decision });
      return { ok: true as const };
    },
  } as unknown as ProtocolClient;
  useSessionsStore.setState({ client: fakeClient });
  return { calls };
}

beforeEach(() => {
  useSessionsStore.setState({ client: undefined });
  useNotificationStore.setState({ notifications: [] });
  useAutoAllowStore.setState({ bySession: {} });
});

describe("ApprovalPill", () => {
  test("renders allow/deny buttons, the optional reason, and the always-allow checkbox", () => {
    setupClient();
    render(
      <ApprovalPill
        sessionId="s-1"
        callId="t-1"
        approvalId="a-1"
        reason="Outside auto-approve allowlist"
        allowKey="mkdir"
      />,
    );
    expect(screen.getByText("Outside auto-approve allowlist")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Allow once/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deny/i })).toBeInTheDocument();
    // The checkbox label embeds the allowKey verbatim so users see what scope they're opting in to.
    expect(screen.getByText("mkdir")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  test("clicking Allow sends an 'allow' decision through the client", async () => {
    const { calls } = setupClient();
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-1" allowKey="mkdir" />);
    fireEvent.click(screen.getByRole("button", { name: /Allow once/i }));
    // Microtask flush — the click handler is async and resolves on next tick.
    await Promise.resolve();
    expect(calls).toEqual([{ sessionId: "s-1", approvalId: "a-1", decision: "allow" }]);
  });

  test("clicking Deny sends a 'deny' decision", async () => {
    const { calls } = setupClient();
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-1" allowKey="mkdir" />);
    fireEvent.click(screen.getByRole("button", { name: /Deny/i }));
    await Promise.resolve();
    expect(calls).toEqual([{ sessionId: "s-1", approvalId: "a-1", decision: "deny" }]);
  });

  test("checking 'always allow' + Allow persists the key to the session's auto-allow store", async () => {
    const { calls } = setupClient();
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-1" allowKey="mkdir" />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Allow once/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([{ sessionId: "s-1", approvalId: "a-1", decision: "allow" }]);
    expect(useAutoAllowStore.getState().has("s-1", "mkdir")).toBe(true);
  });

  test("checking 'always allow' + Deny does NOT persist the key — denied calls are treated as misclicks", async () => {
    setupClient();
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-1" allowKey="mkdir" />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Deny/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(useAutoAllowStore.getState().has("s-1", "mkdir")).toBe(false);
  });

  test("a session-allowed key auto-resolves on mount without user interaction", async () => {
    const { calls } = setupClient();
    useAutoAllowStore.setState({ bySession: { "s-1": new Set(["mkdir"]) } });
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-2" allowKey="mkdir" />);
    // Effect fires on mount and dispatches a single decide("allow").
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([{ sessionId: "s-1", approvalId: "a-2", decision: "allow" }]);
  });

  test("Esc key triggers Deny via the global keydown listener", async () => {
    const { calls } = setupClient();
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-1" allowKey="mkdir" />);
    fireEvent.keyDown(document, { key: "Escape" });
    await Promise.resolve();
    expect(calls).toEqual([{ sessionId: "s-1", approvalId: "a-1", decision: "deny" }]);
  });

  test("Enter key triggers Allow via the global keydown listener", async () => {
    const { calls } = setupClient();
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-1" allowKey="mkdir" />);
    fireEvent.keyDown(document, { key: "Enter" });
    await Promise.resolve();
    expect(calls).toEqual([{ sessionId: "s-1", approvalId: "a-1", decision: "allow" }]);
  });

  test("Esc / Enter are ignored when the keydown originated from an editable surface", async () => {
    const { calls } = setupClient();
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-1" allowKey="mkdir" />);
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    fireEvent.keyDown(textarea, { key: "Enter" });
    fireEvent.keyDown(textarea, { key: "Escape" });
    await Promise.resolve();
    expect(calls).toEqual([]);
    textarea.remove();
  });

  test("a transport error surfaces a toast and leaves both buttons clickable", async () => {
    const failingClient = {
      toolApproval: async () => {
        throw new Error("ws disconnected");
      },
    } as unknown as ProtocolClient;
    useSessionsStore.setState({ client: failingClient });
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-1" allowKey="mkdir" />);
    fireEvent.click(screen.getByRole("button", { name: /Allow once/i }));
    // Flush pending microtasks + a macro tick so React commits the setState that re-enables
    // the buttons after the rejected promise resolves through the catch block.
    await new Promise((r) => setTimeout(r, 0));
    const notifications = useNotificationStore.getState().notifications;
    expect(notifications.length).toBeGreaterThan(0);
    // Buttons re-enable after the failure so the user can retry.
    expect(
      (screen.getByRole("button", { name: /Allow once/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
