import { describe, expect, test } from "bun:test";
import { isAbsolute, resolve } from "node:path";
import type { ToolCallEvent, ToolCallEventResult } from "@earendil-works/pi-coding-agent";
import {
  createAgentModeExtension,
  type ToolApprovalRequest,
} from "../../../src/extensions/agent-mode/agent-mode.js";
import { createMockExtensionApi } from "../helpers/mock-api.js";

const PROJECT = isAbsolute("/repo") ? "/repo" : resolve("C:\\repo");

function setup(initialMode: "ask" | "accept-edits" | "plan" = "plan") {
  const api = createMockExtensionApi();
  const requests: ToolApprovalRequest[] = [];
  let pendingTimers: Array<{ cb: () => void; ms: number }> = [];
  const timers = {
    setTimeout: (cb: () => void, ms: number) => {
      const entry = { cb, ms };
      pendingTimers.push(entry);
      return entry;
    },
    clearTimeout: (handle: unknown) => {
      pendingTimers = pendingTimers.filter((t) => t !== handle);
    },
  };
  const controller = createAgentModeExtension({
    projectPath: PROJECT,
    initialMode,
    onApprovalRequest: (req) => requests.push(req),
    timers,
  });
  controller.factory(api);
  return {
    controller,
    api,
    requests,
    fireApproval: () => {
      const next = pendingTimers.shift();
      if (!next) throw new Error("No pending timer to fire");
      next.cb();
    },
    pendingTimerCount: () => pendingTimers.length,
  };
}

function makeEvent(toolName: string, input: unknown, toolCallId = "tc-1"): ToolCallEvent {
  return { type: "tool_call", toolCallId, toolName, input } as ToolCallEvent;
}

function firstRequest(requests: ToolApprovalRequest[]): ToolApprovalRequest {
  const req = requests[0];
  if (!req) throw new Error("Expected at least one approval request, got none");
  return req;
}

describe("createAgentModeExtension — tool_call enforcement", () => {
  test("plan mode synchronously blocks bash without asking the user", async () => {
    const { api, requests } = setup("plan");
    const result = await api.fire<ToolCallEventResult>(
      "tool_call",
      makeEvent("bash", { command: "rm -rf /" }),
    );
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("Plan mode");
    expect(requests).toHaveLength(0);
  });

  test("ask mode emits an approval request and resolves to allow when the user accepts", async () => {
    const { controller, api, requests } = setup("ask");
    const promise = api.fire<ToolCallEventResult>(
      "tool_call",
      makeEvent("edit", { path: "/repo/src/foo.ts" }),
    );
    // Approval request is fired synchronously inside the handler.
    expect(requests).toHaveLength(1);
    const { approvalId } = firstRequest(requests);
    controller.resolveApproval(approvalId, "allow");
    const result = await promise;
    // Allow returns an empty object (no block) so pi-ai proceeds.
    expect(result?.block).toBeFalsy();
  });

  test("ask mode resolves to block-with-reason when the user denies", async () => {
    const { controller, api, requests } = setup("ask");
    const promise = api.fire<ToolCallEventResult>("tool_call", makeEvent("write", { path: "x" }));
    const { approvalId } = firstRequest(requests);
    controller.resolveApproval(approvalId, "deny", "User said no");
    const result = await promise;
    expect(result?.block).toBe(true);
    expect(result?.reason).toBe("User said no");
  });

  test("accept-edits auto-approves edits inside the allowlist", async () => {
    const { api, requests } = setup("accept-edits");
    const result = await api.fire<ToolCallEventResult>(
      "tool_call",
      makeEvent("edit", { path: `${PROJECT}/src/foo.ts` }),
    );
    expect(result).toBeUndefined();
    expect(requests).toHaveLength(0);
  });

  test("accept-edits prompts for edits outside the allowlist", async () => {
    const { controller, api, requests } = setup("accept-edits");
    controller.setEditAllowlist([`${PROJECT}/src`]);
    const promise = api.fire<ToolCallEventResult>(
      "tool_call",
      makeEvent("edit", { path: `${PROJECT}/scripts/bad.ts` }),
    );
    expect(requests).toHaveLength(1);
    controller.resolveApproval(firstRequest(requests).approvalId, "allow");
    await promise;
  });

  test("accept-edits prompts for every bash regardless of allowlist", async () => {
    const { controller, api, requests } = setup("accept-edits");
    const promise = api.fire<ToolCallEventResult>(
      "tool_call",
      makeEvent("bash", { command: "ls" }),
    );
    expect(requests).toHaveLength(1);
    controller.resolveApproval(firstRequest(requests).approvalId, "allow");
    await promise;
  });

  test("setMode flips behaviour mid-session", async () => {
    const { controller, api, requests } = setup("plan");
    controller.setMode("ask");
    const promise = api.fire<ToolCallEventResult>(
      "tool_call",
      makeEvent("bash", { command: "ls" }),
    );
    expect(requests).toHaveLength(1);
    controller.resolveApproval(firstRequest(requests).approvalId, "allow");
    await promise;
  });

  test("resolveApproval is idempotent for unknown ids", () => {
    const { controller } = setup("plan");
    // Should not throw.
    controller.resolveApproval("nonexistent", "allow");
    controller.resolveApproval("nonexistent", "deny", "x");
  });

  test("approval times out with a block reason if never resolved", async () => {
    const { api, requests, fireApproval, pendingTimerCount } = setup("ask");
    const promise = api.fire<ToolCallEventResult>(
      "tool_call",
      makeEvent("bash", { command: "ls" }),
    );
    expect(requests).toHaveLength(1);
    expect(pendingTimerCount()).toBe(1);
    fireApproval(); // Manually fire the queued timeout.
    const result = await promise;
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("timed out");
  });

  test("dispose unblocks all pending approvals with a cancel reason", async () => {
    const { controller, api } = setup("ask");
    const p1 = api.fire<ToolCallEventResult>("tool_call", makeEvent("bash", {}, "a"));
    const p2 = api.fire<ToolCallEventResult>("tool_call", makeEvent("edit", { path: "x" }, "b"));
    controller.dispose();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1?.block).toBe(true);
    expect(r2?.block).toBe(true);
    expect(r1?.reason).toContain("Session closed");
    expect(controller.pendingApprovalIds()).toHaveLength(0);
  });
});
