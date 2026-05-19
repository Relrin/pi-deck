import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BeforeAgentStartEventResult } from "@earendil-works/pi-coding-agent";
import { createAttachmentsExtension } from "../../../src/extensions/attachments/attachments.js";
import { createMockExtensionApi } from "../helpers/mock-api.js";

describe("createAttachmentsExtension", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "pideck-attachments-fact-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  test("before_agent_start emits a customMessage when pending attachments exist", async () => {
    await writeFile(join(projectPath, "hello.ts"), "export const x = 1;\n");
    const controller = createAttachmentsExtension({ projectPath });
    const api = createMockExtensionApi();
    controller.factory(api);

    controller.setPending([{ kind: "file", path: "hello.ts" }]);
    const result = await api.fire<BeforeAgentStartEventResult>("before_agent_start", {
      type: "before_agent_start",
      prompt: "hi",
      systemPrompt: "",
      systemPromptOptions: {} as never,
    });

    expect(result).toBeDefined();
    expect(result?.message?.customType).toBe("pideck.attachments");
    expect(typeof result?.message?.content).toBe("string");
    expect(result?.message?.content).toContain('<file path="hello.ts">');
    expect(result?.message?.details).toEqual({
      attachments: [{ kind: "file", path: "hello.ts" }],
    });
  });

  test("pending queue is consumed after one turn", async () => {
    await writeFile(join(projectPath, "hello.ts"), "export const x = 1;\n");
    const controller = createAttachmentsExtension({ projectPath });
    const api = createMockExtensionApi();
    controller.factory(api);

    controller.setPending([{ kind: "file", path: "hello.ts" }]);
    expect(controller.getPending()).toHaveLength(1);

    await api.fire("before_agent_start", {
      type: "before_agent_start",
      prompt: "hi",
      systemPrompt: "",
      systemPromptOptions: {} as never,
    });

    expect(controller.getPending()).toHaveLength(0);

    // Second turn with no setPending in between: handler returns undefined, no message.
    const second = await api.fire("before_agent_start", {
      type: "before_agent_start",
      prompt: "next",
      systemPrompt: "",
      systemPromptOptions: {} as never,
    });
    expect(second).toBeUndefined();
  });

  test("setProjectPath retargets path resolution", async () => {
    const otherProject = await mkdtemp(join(tmpdir(), "pideck-other-"));
    try {
      await writeFile(join(otherProject, "n.ts"), "// from other\n");
      const controller = createAttachmentsExtension({ projectPath });
      const api = createMockExtensionApi();
      controller.factory(api);

      controller.setProjectPath(otherProject);
      controller.setPending([{ kind: "file", path: "n.ts" }]);

      const result = await api.fire<BeforeAgentStartEventResult>("before_agent_start", {
        type: "before_agent_start",
        prompt: "hi",
        systemPrompt: "",
        systemPromptOptions: {} as never,
      });
      expect(result?.message?.content).toContain("// from other");
    } finally {
      await rm(otherProject, { recursive: true, force: true });
    }
  });

  test("returns undefined (no message) when only unresolvable entries were queued", async () => {
    const controller = createAttachmentsExtension({ projectPath });
    const api = createMockExtensionApi();
    controller.factory(api);
    controller.setPending([]);
    const result = await api.fire<BeforeAgentStartEventResult>("before_agent_start", {
      type: "before_agent_start",
      prompt: "hi",
      systemPrompt: "",
      systemPromptOptions: {} as never,
    });
    expect(result).toBeUndefined();
  });
});
