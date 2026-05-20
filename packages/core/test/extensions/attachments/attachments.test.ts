import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InputEventResult } from "@earendil-works/pi-coding-agent";
import {
  ATTACHMENTS_ENTRY_TYPE,
  createAttachmentsExtension,
} from "../../../src/extensions/attachments/attachments.js";
import { createMockExtensionApi } from "../helpers/mock-api.js";

describe("createAttachmentsExtension", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "pideck-attachments-fact-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  test("input event transforms the user text by prepending the attachments block", async () => {
    await writeFile(join(projectPath, "hello.ts"), "export const x = 1;\n");
    const controller = createAttachmentsExtension({ projectPath });
    const api = createMockExtensionApi();
    controller.factory(api);

    controller.setPending([{ kind: "file", path: "hello.ts" }]);
    const result = await api.fire<InputEventResult>("input", {
      type: "input",
      text: "what does this file do?",
      source: "interactive",
    });

    expect(result).toBeDefined();
    expect(result?.action).toBe("transform");
    if (result?.action !== "transform") throw new Error("expected transform");
    expect(result.text.startsWith("<attachments>")).toBe(true);
    expect(result.text).toContain('<file path="hello.ts">');
    expect(result.text.endsWith("what does this file do?")).toBe(true);
    expect(result.text).toMatch(/<\/attachments>\n\nwhat does this file do\?$/);
  });

  test("forwards images through the transform unchanged", async () => {
    await writeFile(join(projectPath, "hello.ts"), "export const x = 1;\n");
    const controller = createAttachmentsExtension({ projectPath });
    const api = createMockExtensionApi();
    controller.factory(api);

    controller.setPending([{ kind: "file", path: "hello.ts" }]);
    const images = [{ type: "image", mimeType: "image/png", data: "abc" } as const];
    const result = await api.fire<InputEventResult>("input", {
      type: "input",
      text: "describe",
      images,
      source: "interactive",
    });

    if (result?.action !== "transform") throw new Error("expected transform");
    expect(result.images).toEqual(images);
  });

  test("records the attachment snapshot via appendEntry", async () => {
    await writeFile(join(projectPath, "hello.ts"), "export const x = 1;\n");
    const controller = createAttachmentsExtension({ projectPath });
    const api = createMockExtensionApi();
    controller.factory(api);

    controller.setPending([{ kind: "file", path: "hello.ts" }]);
    await api.fire<InputEventResult>("input", {
      type: "input",
      text: "hi",
      source: "interactive",
    });

    expect(api.appendedEntries()).toEqual([
      {
        customType: ATTACHMENTS_ENTRY_TYPE,
        data: { attachments: [{ kind: "file", path: "hello.ts" }] },
      },
    ]);
  });

  test("pending queue is consumed after one turn", async () => {
    await writeFile(join(projectPath, "hello.ts"), "export const x = 1;\n");
    const controller = createAttachmentsExtension({ projectPath });
    const api = createMockExtensionApi();
    controller.factory(api);

    controller.setPending([{ kind: "file", path: "hello.ts" }]);
    expect(controller.getPending()).toHaveLength(1);

    await api.fire<InputEventResult>("input", {
      type: "input",
      text: "hi",
      source: "interactive",
    });

    expect(controller.getPending()).toHaveLength(0);

    // Second turn with no setPending in between: handler returns `continue`, no transform,
    // no extra appendEntry call.
    const second = await api.fire<InputEventResult>("input", {
      type: "input",
      text: "next",
      source: "interactive",
    });
    expect(second?.action).toBe("continue");
    expect(api.appendedEntries()).toHaveLength(1);
  });

  test("returns continue when no attachments are pending", async () => {
    const controller = createAttachmentsExtension({ projectPath });
    const api = createMockExtensionApi();
    controller.factory(api);

    const result = await api.fire<InputEventResult>("input", {
      type: "input",
      text: "hi",
      source: "interactive",
    });
    expect(result?.action).toBe("continue");
    expect(api.appendedEntries()).toHaveLength(0);
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

      const result = await api.fire<InputEventResult>("input", {
        type: "input",
        text: "hi",
        source: "interactive",
      });
      if (result?.action !== "transform") throw new Error("expected transform");
      expect(result.text).toContain("// from other");
    } finally {
      await rm(otherProject, { recursive: true, force: true });
    }
  });
});
