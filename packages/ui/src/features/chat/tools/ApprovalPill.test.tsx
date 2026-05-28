import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../../../test/utils";
import type { ProtocolClient } from "../../../lib/transport/protocol-client";
import { useNotificationStore } from "../../_status/useNotificationStore";
import { useSessionsStore } from "../../sessions/useSessionsStore";
import { ApprovalPill } from "./ApprovalPill";

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
});

describe("ApprovalPill", () => {
  test("renders allow/deny buttons and the optional reason", () => {
    setupClient();
    render(
      <ApprovalPill
        sessionId="s-1"
        callId="t-1"
        approvalId="a-1"
        reason="Outside auto-approve allowlist"
      />,
    );
    expect(screen.getByText("Outside auto-approve allowlist")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Allow once/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deny/i })).toBeInTheDocument();
  });

  test("clicking Allow sends an 'allow' decision through the client", async () => {
    const { calls } = setupClient();
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-1" />);
    fireEvent.click(screen.getByRole("button", { name: /Allow once/i }));
    // Microtask flush — the click handler is async and resolves on next tick.
    await Promise.resolve();
    expect(calls).toEqual([{ sessionId: "s-1", approvalId: "a-1", decision: "allow" }]);
  });

  test("clicking Deny sends a 'deny' decision", async () => {
    const { calls } = setupClient();
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-1" />);
    fireEvent.click(screen.getByRole("button", { name: /Deny/i }));
    await Promise.resolve();
    expect(calls).toEqual([{ sessionId: "s-1", approvalId: "a-1", decision: "deny" }]);
  });

  test("a transport error surfaces a toast and leaves both buttons clickable", async () => {
    const failingClient = {
      toolApproval: async () => {
        throw new Error("ws disconnected");
      },
    } as unknown as ProtocolClient;
    useSessionsStore.setState({ client: failingClient });
    render(<ApprovalPill sessionId="s-1" callId="t-1" approvalId="a-1" />);
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
