import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { applyLocale, LOCALE_STORAGE_KEY, useLocaleStore } from "../../src/i18n/useLocaleStore";

const DEFAULTS = { uiLocale: "en", agentLanguage: "match-ui" } as const;

function resetStore(): void {
  useLocaleStore.setState({ ...DEFAULTS });
  localStorage.removeItem(LOCALE_STORAGE_KEY);
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("data-lang-script");
  document.documentElement.setAttribute("lang", "en");
}

beforeEach(resetStore);
afterEach(resetStore);

describe("useLocaleStore", () => {
  test("defaults to English with the agent following the interface", () => {
    const state = useLocaleStore.getState();
    expect(state.uiLocale).toBe("en");
    expect(state.agentLanguage).toBe("match-ui");
  });

  test("setUiLocale loads the catalog, stamps the document and persists", async () => {
    await useLocaleStore.getState().setUiLocale("ru");

    expect(useLocaleStore.getState().uiLocale).toBe("ru");
    expect(document.documentElement.getAttribute("lang")).toBe("ru");
    expect(document.documentElement.getAttribute("data-lang-script")).toBe("cyrillic");

    const persisted = JSON.parse(localStorage.getItem(LOCALE_STORAGE_KEY) ?? "{}");
    expect(persisted.state.uiLocale).toBe("ru");
  });

  test("setAgentLanguage persists independently of the interface language", () => {
    useLocaleStore.getState().setAgentLanguage("en");

    expect(useLocaleStore.getState().agentLanguage).toBe("en");
    // The two settings are deliberately orthogonal: a Russian UI with an English agent is valid.
    expect(useLocaleStore.getState().uiLocale).toBe("en");

    const persisted = JSON.parse(localStorage.getItem(LOCALE_STORAGE_KEY) ?? "{}");
    expect(persisted.state.agentLanguage).toBe("en");
  });

  test("applyLocale stamps lang, dir and script together", () => {
    applyLocale("ru");
    const root = document.documentElement;
    expect(root.getAttribute("lang")).toBe("ru");
    expect(root.getAttribute("dir")).toBe("ltr");
    expect(root.getAttribute("data-lang-script")).toBe("cyrillic");

    applyLocale("en");
    expect(root.getAttribute("lang")).toBe("en");
    expect(root.getAttribute("data-lang-script")).toBe("latin");
  });
});
