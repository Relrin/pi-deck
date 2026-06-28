import { describe, expect, test } from "bun:test";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { decideToolCall } from "../../../src/extensions/agent-mode/decision.js";
import {
  type AskUserController,
  createAskUserExtension,
  formatAnswers,
} from "../../../src/extensions/ask-user/ask-user.js";
import { createDeferredFrontend } from "../../../src/extensions/ask-user/frontend.js";
import type { AskUserQuestion } from "../../../src/protocol/events.js";

const THEME_Q: AskUserQuestion = {
  header: "Theme strategy",
  question: "How should the toggle persist the theme?",
  options: [
    { label: "localStorage" },
    { label: "prefers-color-scheme" },
    { label: "Cookie + SSR" },
  ],
  allowCustom: true,
};

const Q: AskUserQuestion[] = [THEME_Q];

describe("createDeferredFrontend", () => {
  test("present resolves with the answer passed to resolveAsk", async () => {
    let seen: { askId: string } | undefined;
    const fe = createDeferredFrontend({
      onAskRequest: (r) => {
        seen = r;
      },
    });
    const p = fe.present({ askId: "a1", toolCallId: "t1", questions: Q });
    expect(seen?.askId).toBe("a1");
    expect(fe.pendingAskIds()).toEqual(["a1"]);
    fe.resolveAsk("a1", { answers: [{ optionIndices: [1] }] });
    expect(await p).toEqual({ answers: [{ optionIndices: [1] }] });
    expect(fe.pendingAskIds()).toEqual([]);
  });

  test("timeout resolves cancelled", async () => {
    let fire: (() => void) | undefined;
    const fe = createDeferredFrontend({
      onAskRequest: () => {},
      timers: {
        setTimeout: (cb) => {
          fire = cb;
          return 1;
        },
        clearTimeout: () => {},
      },
    });
    const p = fe.present({ askId: "a1", toolCallId: "t1", questions: Q });
    fire?.();
    expect((await p).cancelled).toBe(true);
  });

  test("aborting the turn resolves cancelled", async () => {
    const ctrl = new AbortController();
    const fe = createDeferredFrontend({ onAskRequest: () => {} });
    const p = fe.present({ askId: "a1", toolCallId: "t1", questions: Q }, ctrl.signal);
    ctrl.abort();
    expect((await p).cancelled).toBe(true);
  });

  test("a pre-aborted signal resolves cancelled immediately", async () => {
    const fe = createDeferredFrontend({ onAskRequest: () => {} });
    const p = fe.present({ askId: "a1", toolCallId: "t1", questions: Q }, AbortSignal.abort());
    expect((await p).cancelled).toBe(true);
  });

  test("dispose cancels everything in flight", async () => {
    const fe = createDeferredFrontend({ onAskRequest: () => {} });
    const p = fe.present({ askId: "a1", toolCallId: "t1", questions: Q });
    fe.dispose();
    expect((await p).cancelled).toBe(true);
  });

  test("resolving an unknown askId is a no-op", () => {
    const fe = createDeferredFrontend({ onAskRequest: () => {} });
    expect(() => fe.resolveAsk("nope", { answers: [] })).not.toThrow();
  });
});

describe("createAskUserExtension", () => {
  function register(controller: AskUserController): ToolDefinition {
    let tool: ToolDefinition | undefined;
    const pi = {
      registerTool: (t: ToolDefinition) => {
        tool = t;
      },
    } as unknown as ExtensionAPI;
    controller.factory(pi);
    if (!tool) throw new Error("tool was not registered");
    return tool;
  }

  test("registers the ask_user_question tool", () => {
    const fe = createDeferredFrontend({ onAskRequest: () => {} });
    const tool = register(createAskUserExtension({ frontend: fe }));
    expect(tool.name).toBe("ask_user_question");
    expect(tool.parameters).toBeDefined();
  });

  test("execute presents the question and returns the formatted answer", async () => {
    const fe = createDeferredFrontend({ onAskRequest: () => {} });
    const tool = register(createAskUserExtension({ frontend: fe }));
    const result = tool.execute(
      "call-1",
      { questions: Q },
      undefined,
      undefined,
      undefined as never,
    );
    // The pending question is now suspended; resolve it as the renderer would.
    fe.resolveAsk(fe.pendingAskIds()[0] as string, { answers: [{ optionIndices: [0] }] });
    const out = await result;
    expect(out.content[0]).toMatchObject({ type: "text" });
    expect((out.content[0] as { text: string }).text).toContain("localStorage");
  });

  test("dispose delegates to the frontend", async () => {
    const fe = createDeferredFrontend({ onAskRequest: () => {} });
    const controller = createAskUserExtension({ frontend: fe });
    const p = fe.present({ askId: "a1", toolCallId: "t1", questions: Q });
    controller.dispose();
    expect((await p).cancelled).toBe(true);
  });
});

describe("formatAnswers", () => {
  test("single selection uses Q/A structure", () => {
    const out = formatAnswers(Q, { answers: [{ optionIndices: [0] }] });
    expect(out).toContain("Q1: How should the toggle persist the theme?");
    expect(out).toContain("A1: localStorage");
    // No header bracket, no arrow.
    expect(out).not.toContain("[Theme strategy]");
    expect(out).not.toContain("→");
  });

  test("custom answer", () => {
    const out = formatAnswers(Q, { answers: [{ optionIndices: [], custom: "use a store" }] });
    expect(out).toContain("A1: use a store");
  });

  test("multi-select lists each pick", () => {
    const multi: AskUserQuestion[] = [{ ...THEME_Q, multiSelect: true }];
    const out = formatAnswers(multi, { answers: [{ optionIndices: [0, 2] }] });
    expect(out).toContain("localStorage, Cookie + SSR");
  });

  test("skipped + cancelled", () => {
    expect(formatAnswers(Q, { answers: [{ optionIndices: [], skipped: true }] })).toContain(
      "(skipped)",
    );
    expect(formatAnswers(Q, { answers: [], cancelled: true })).toContain("dismissed");
  });

  test("multiple questions are numbered", () => {
    const two: AskUserQuestion[] = [
      {
        header: "Bundler",
        question: "Which bundler?",
        options: [{ label: "tsup" }, { label: "Vite" }],
      },
      {
        header: "Tests",
        question: "Which runner?",
        options: [{ label: "Vitest" }, { label: "Jest" }],
      },
    ];
    const out = formatAnswers(two, {
      answers: [{ optionIndices: [0] }, { optionIndices: [1] }],
    });
    expect(out).toContain("Q1: Which bundler?");
    expect(out).toContain("A1: tsup");
    expect(out).toContain("Q2: Which runner?");
    expect(out).toContain("A2: Jest");
  });
});

describe("ask_user_question gating", () => {
  test("flows through (allow) in every mode", () => {
    for (const mode of ["plan", "ask", "accept-edits", "auto"] as const) {
      const d = decideToolCall({
        mode,
        toolName: "ask_user_question",
        input: { questions: Q },
        editAllowlist: [],
        projectPath: "/repo",
      });
      expect(d.kind).toBe("allow");
    }
  });
});
