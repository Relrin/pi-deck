import { afterEach, describe, expect, test } from "bun:test";
import { APPROVAL_REASON_CODES } from "@pi-deck/core";
import { localizeApprovalReason } from "../../src/i18n/approval-reasons";
import { loadLocale } from "../../src/i18n/i18n-util.sync";
import { llFor } from "../../src/i18n/t";
import { useLocaleStore } from "../../src/i18n/useLocaleStore";

loadLocale("ru");

afterEach(() => {
  useLocaleStore.setState({ uiLocale: "en" });
});

describe("approval reason localization", () => {
  test("every code core can emit has a translation", () => {
    // This is the test that catches the real failure mode: someone adds a rule to `auto-safety.ts`
    // with a new code and the pill silently falls back to English forever.
    const missing = APPROVAL_REASON_CODES.filter(
      (code) => localizeApprovalReason(llFor("en"), code, { tool: "`x`" }) === undefined,
    );
    expect(missing).toEqual([]);
  });

  test("every code is translated in Russian, not just present in English", () => {
    const untranslated = APPROVAL_REASON_CODES.filter((code) => {
      const en = localizeApprovalReason(llFor("en"), code, { tool: "`x`" });
      const ru = localizeApprovalReason(llFor("ru"), code, { tool: "`x`" });
      return en === ru;
    });
    expect(untranslated).toEqual([]);
  });

  test("interpolates the tool name into the MCP reason", () => {
    const text = localizeApprovalReason(llFor("en"), "auto.mcpTool", {
      tool: "`linear_create_issue`",
    });
    expect(text).toContain("linear_create_issue");

    const ru = localizeApprovalReason(llFor("ru"), "auto.mcpTool", {
      tool: "`linear_create_issue`",
    });
    // The tool name is an identifier and must survive translation untouched.
    expect(ru).toContain("linear_create_issue");
  });

  test("an unknown code resolves to nothing so the caller keeps the host's English text", () => {
    expect(localizeApprovalReason(llFor("en"), "auto.somethingNew", undefined)).toBeUndefined();
    expect(localizeApprovalReason(llFor("en"), undefined, undefined)).toBeUndefined();
  });
});
