import { describe, expect, test } from "bun:test";
import { createLanguageExtension } from "../../../src/extensions/language/language.js";
import { createMockExtensionApi } from "../helpers/mock-api.js";

type PromptResult = { systemPrompt: string } | undefined;

function setup(initialLocale?: "en" | "ru") {
  const api = createMockExtensionApi();
  const controller = createLanguageExtension(initialLocale ? { initialLocale } : {});
  controller.factory(api);
  const turn = () => api.fire<PromptResult>("before_agent_start", { systemPrompt: "BASE PROMPT" });
  return { controller, turn };
}

describe("createLanguageExtension", () => {
  test("adds nothing for English — pi's own prompt is already English", async () => {
    const { turn } = setup("en");
    // Saying "answer in English" to a prompt written in English is pure token cost.
    expect(await turn()).toBeUndefined();
  });

  test("defaults to English", async () => {
    const { controller, turn } = setup();
    expect(controller.getLanguage()).toBe("en");
    expect(await turn()).toBeUndefined();
  });

  test("appends the output-language directive, preserving the original prompt", async () => {
    const { turn } = setup("ru");
    const result = await turn();

    expect(result?.systemPrompt).toContain("BASE PROMPT");
    expect(result?.systemPrompt).toContain("Russian");
    // The directive itself is written in English: models follow English instructions about
    // behaviour more reliably than instructions written in the language being requested.
    expect(result?.systemPrompt).toContain("Respond in");
  });

  test("stays one sentence — the model does not need the rest spelled out", async () => {
    const { turn } = setup("ru");
    const appended = ((await turn())?.systemPrompt ?? "").replace("BASE PROMPT", "").trim();

    // Guards against the directive creeping back into a paragraph of don't-translate-identifiers
    // boilerplate. It rides on every turn, so its length is a standing cost.
    expect(appended.split("\n").filter((line) => line.trim().length > 0)).toHaveLength(1);
    expect(appended.length).toBeLessThan(60);
  });

  test("a mid-session switch applies on the next turn, with no respawn", async () => {
    const { controller, turn } = setup("en");
    expect(await turn()).toBeUndefined();

    controller.setLanguage("ru");
    expect(controller.getLanguage()).toBe("ru");
    // Same extension instance, same worker — only the next turn's prompt differs. This is the
    // whole reason the directive rides on `before_agent_start` rather than the spawn-time
    // resource loader.
    expect((await turn())?.systemPrompt).toContain("Russian");

    controller.setLanguage("en");
    expect(await turn()).toBeUndefined();
  });

  test("fires per turn, not once", async () => {
    const { turn } = setup("ru");
    expect((await turn())?.systemPrompt).toContain("Respond in Russian");
    expect((await turn())?.systemPrompt).toContain("Respond in Russian");
  });
});
