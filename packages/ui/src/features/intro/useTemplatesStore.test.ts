import { beforeEach, describe, expect, test } from "bun:test";
import type { IntroTemplate } from "./templates";
import { resolveTemplate, type TemplateOverride, useTemplatesStore } from "./useTemplatesStore";

const BASE: IntroTemplate = {
  id: "fix-failing-test",
  num: "01",
  title: "Fix a failing test",
  blurb: "Paste a stack trace, get a patched test + fix.",
  body: "default body",
};

const OVERRIDE: TemplateOverride = {
  title: "My title",
  blurb: "My blurb",
  body: "My body",
};

beforeEach(() => {
  useTemplatesStore.setState({ overrides: {} });
});

describe("useTemplatesStore", () => {
  test("setOverride stores the override keyed by id", () => {
    useTemplatesStore.getState().setOverride(BASE.id, OVERRIDE);
    expect(useTemplatesStore.getState().overrides[BASE.id]).toEqual(OVERRIDE);
  });

  test("resetOverride removes the key, falling back to the default", () => {
    useTemplatesStore.getState().setOverride(BASE.id, OVERRIDE);
    useTemplatesStore.getState().resetOverride(BASE.id);
    expect(useTemplatesStore.getState().overrides[BASE.id]).toBeUndefined();
  });

  test("resetOverride on a missing id is a no-op", () => {
    const before = useTemplatesStore.getState().overrides;
    useTemplatesStore.getState().resetOverride("nope");
    expect(useTemplatesStore.getState().overrides).toBe(before);
  });
});

describe("resolveTemplate", () => {
  test("returns the base untouched when there is no override", () => {
    expect(resolveTemplate(BASE, undefined)).toBe(BASE);
  });

  test("merges title/blurb/body while preserving id and num", () => {
    const merged = resolveTemplate(BASE, OVERRIDE);
    expect(merged).toEqual({
      id: "fix-failing-test",
      num: "01",
      title: "My title",
      blurb: "My blurb",
      body: "My body",
    });
  });
});
