import { describe, expect, test } from "bun:test";
import type { AskUserQuestion } from "@pi-deck/core/protocol/events.js";
import {
  allowsCustom,
  buildAnswer,
  canSubmit,
  initialDraft,
  isQuestionComplete,
  pickLayout,
} from "../../../../../src/features/chat/tools/ask/askLayout.js";

const single: AskUserQuestion = {
  header: "Theme",
  question: "How to persist?",
  options: [{ label: "localStorage" }, { label: "cookie" }],
  allowCustom: true,
};

const multi: AskUserQuestion = { ...single, multiSelect: true };

const preview: AskUserQuestion = {
  header: "Optimize",
  question: "Which approach?",
  options: [{ label: "Index", preview: "```sql\nCREATE INDEX ...\n```" }, { label: "DataLoader" }],
};

describe("pickLayout", () => {
  test("single question → cards", () => {
    expect(pickLayout([single])).toBe("cards");
  });
  test("multiSelect → multi", () => {
    expect(pickLayout([multi])).toBe("multi");
  });
  test("per-option fenced code preview → preview", () => {
    expect(pickLayout([preview])).toBe("preview");
  });
  test("a prose-only preview does NOT trigger split — stays cards", () => {
    const prose: AskUserQuestion = {
      header: "Theme",
      question: "How?",
      options: [
        { label: "A", preview: "Simplest, no deps but risks a flash." },
        { label: "B", preview: "SSR-safe but adds a cookie round-trip." },
      ],
    };
    expect(pickLayout([prose])).toBe("cards");
  });
  test("multiple questions → tabs", () => {
    expect(pickLayout([single, multi])).toBe("tabs");
  });
});

describe("allowsCustom", () => {
  test("on by default and when explicitly true", () => {
    expect(allowsCustom({ header: "x", question: "q", options: [] })).toBe(true);
    expect(allowsCustom(single)).toBe(true);
  });
  test("only off when explicitly false", () => {
    expect(allowsCustom({ ...single, allowCustom: false })).toBe(false);
  });
});

describe("initialDraft", () => {
  test("cards/preview default to first option selected", () => {
    expect(initialDraft([single], "cards")[0]).toEqual({ optionIndices: [0] });
    expect(initialDraft([preview], "preview")[0]).toEqual({ optionIndices: [0] });
  });
  test("multi/tabs start empty", () => {
    expect(initialDraft([multi], "multi")[0]).toEqual({ optionIndices: [] });
    expect(initialDraft([single, multi], "tabs")[1]).toEqual({ optionIndices: [] });
  });
});

describe("isQuestionComplete", () => {
  test("single needs a selection", () => {
    expect(isQuestionComplete(single, { optionIndices: [] })).toBe(false);
    expect(isQuestionComplete(single, { optionIndices: [1] })).toBe(true);
  });
  test("custom needs text", () => {
    expect(isQuestionComplete(single, { optionIndices: [], customActive: true })).toBe(false);
    expect(isQuestionComplete(single, { optionIndices: [], customActive: true, custom: "x" })).toBe(
      true,
    );
  });
  test("skipped counts as complete", () => {
    expect(isQuestionComplete(single, { optionIndices: [], skipped: true })).toBe(true);
  });
  test("multi respects min/max bounds", () => {
    const bounded: AskUserQuestion = { ...multi, minSelect: 2, maxSelect: 2 };
    expect(isQuestionComplete(bounded, { optionIndices: [0] })).toBe(false);
    expect(isQuestionComplete(bounded, { optionIndices: [0, 1] })).toBe(true);
  });
});

describe("canSubmit", () => {
  test("single layout follows the first question", () => {
    expect(canSubmit([single], [{ optionIndices: [] }], "cards")).toBe(false);
    expect(canSubmit([single], [{ optionIndices: [0] }], "cards")).toBe(true);
  });
  test("tabs require every question answered or skipped", () => {
    const draft = [{ optionIndices: [0] }, { optionIndices: [] }];
    expect(canSubmit([single, multi], draft, "tabs")).toBe(false);
    expect(
      canSubmit([single, multi], [{ optionIndices: [0] }, { optionIndices: [1] }], "tabs"),
    ).toBe(true);
    expect(
      canSubmit(
        [single, multi],
        [{ optionIndices: [0] }, { optionIndices: [], skipped: true }],
        "tabs",
      ),
    ).toBe(true);
  });
});

describe("buildAnswer", () => {
  test("single selection is index-aligned and sorted", () => {
    expect(buildAnswer([single], [{ optionIndices: [1] }])).toEqual({
      answers: [{ optionIndices: [1] }],
    });
  });
  test("custom single answer clears option indices", () => {
    expect(
      buildAnswer([single], [{ optionIndices: [0], customActive: true, custom: " hi " }]),
    ).toEqual({ answers: [{ optionIndices: [], custom: "hi" }] });
  });
  test("multi keeps checked options plus added items as custom", () => {
    expect(buildAnswer([multi], [{ optionIndices: [1, 0], added: ["extra"] }])).toEqual({
      answers: [{ optionIndices: [0, 1], custom: "extra" }],
    });
  });
  test("skipped questions emit a skipped marker", () => {
    expect(buildAnswer([single], [{ optionIndices: [], skipped: true }])).toEqual({
      answers: [{ optionIndices: [], skipped: true }],
    });
  });
});
