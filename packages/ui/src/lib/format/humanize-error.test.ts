import { describe, expect, test } from "bun:test";
import { humanizeError } from "./humanize-error";

describe("humanizeError", () => {
  test("strings pass through", () => {
    expect(humanizeError("oh no")).toBe("oh no");
  });

  test("Error instances surface the message and strip the prefix", () => {
    expect(humanizeError(new Error("Error: file not found"))).toBe("file not found");
    expect(humanizeError(new TypeError("TypeError: bad arg"))).toBe("bad arg");
  });

  test("RPC-style objects pull message", () => {
    expect(humanizeError({ code: "E_TIMEOUT", message: "Request timed out" })).toBe(
      "Request timed out",
    );
  });

  test("falls back to `reason` when message is missing", () => {
    expect(humanizeError({ reason: "stale token" })).toBe("stale token");
  });

  test("falls back to `code` when message and reason are missing", () => {
    expect(humanizeError({ code: "ECONNREFUSED" })).toBe("ECONNREFUSED");
  });

  test("returns fallback for inscrutable values", () => {
    expect(humanizeError(undefined, "boom")).toBe("boom");
    expect(humanizeError(null, "boom")).toBe("boom");
    expect(humanizeError(42, "boom")).toBe("boom");
  });

  test("truncates very long messages", () => {
    const long = "x".repeat(500);
    expect(humanizeError(new Error(long)).length).toBeLessThanOrEqual(200);
    expect(humanizeError(new Error(long)).endsWith("…")).toBe(true);
  });

  test("strips Node's exec `Command failed:` preamble", () => {
    // Single-line failure (no stderr captured) — preamble is the entire message, so the
    // cleaned message goes empty and we fall back to the supplied default rather than
    // showing nothing.
    expect(
      humanizeError(
        new Error("Command failed: git -c core.fsmonitor=false commit"),
        "Commit failed",
      ),
    ).toBe("Commit failed");
    // Multi-line failure — preamble line goes, real stderr stays.
    expect(
      humanizeError(
        new Error("Command failed: git push origin master\nremote: pre-receive hook failed"),
      ),
    ).toBe("remote: pre-receive hook failed");
  });
});
