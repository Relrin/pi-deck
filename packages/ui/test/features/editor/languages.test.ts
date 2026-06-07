import { describe, expect, test } from "bun:test";
import { eolLabel } from "../../../src/features/editor/eol";
import { badgeForFile, languageForFile } from "../../../src/features/editor/languages";

describe("languageForFile", () => {
  test("maps .tsx to TypeScript JSX with the TSX badge", () => {
    const info = languageForFile("useMcpServers.tsx");
    expect(info.label).toBe("TypeScript JSX");
    expect(info.badge.text).toBe("TSX");
  });

  test("maps a known extension (.md → Markdown)", () => {
    expect(languageForFile("README.md").label).toBe("Markdown");
  });

  test("falls back to plain text for unknown extensions", () => {
    const info = languageForFile("notes.xyz");
    expect(info.label).toBe("Plain Text");
    expect(info.badge.text).toBe("XYZ");
  });

  test("treats a dotfile with no extension as plain text", () => {
    expect(languageForFile(".gitignore").label).toBe("Plain Text");
  });
});

describe("badgeForFile", () => {
  test("json shows the brace badge", () => {
    expect(badgeForFile("tsconfig.json").text).toBe("{ }");
  });
});

describe("eolLabel", () => {
  test("labels lf / crlf", () => {
    expect(eolLabel("lf")).toBe("LF");
    expect(eolLabel("crlf")).toBe("CRLF");
  });
});
