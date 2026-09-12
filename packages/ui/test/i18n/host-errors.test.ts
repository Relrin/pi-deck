import { describe, expect, test } from "bun:test";
import { localizeHostErrorCode, MAPPED_HOST_ERROR_CODES } from "../../src/i18n/host-errors";
import { humanizeError } from "../../src/lib/format/humanize-error";
import { HostError } from "../../src/lib/transport/ws-client";

describe("host error localization", () => {
  test("a mapped code resolves to catalog copy", () => {
    expect(localizeHostErrorCode("not_a_repo")).toBe("This folder is not a git repository.");
  });

  test("an unmapped code resolves to nothing so the caller keeps the host message", () => {
    expect(localizeHostErrorCode("something_new")).toBeUndefined();
    expect(localizeHostErrorCode(undefined)).toBeUndefined();
  });

  test("every mapped code produces a non-empty string", () => {
    for (const code of MAPPED_HOST_ERROR_CODES) {
      expect(localizeHostErrorCode(code)?.length ?? 0).toBeGreaterThan(0);
    }
  });

  test("humanizeError prefers the translated code over the host's English message", () => {
    // The host says "Project abc123 not found"; we deliberately trade that specificity for a
    // sentence the user can actually read in their own language.
    const err = new HostError("not_found", "Project abc123 not found");
    expect(humanizeError(err)).toBe("That item no longer exists.");
  });

  test("humanizeError falls through to the host message for an unknown code", () => {
    const err = new HostError("brand_new_code", "Something specific went wrong");
    expect(humanizeError(err)).toBe("Something specific went wrong");
  });

  test("HostError carries the code, not just a message", () => {
    const err = new HostError("path_escape", "outside the workspace");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("path_escape");
  });
});
