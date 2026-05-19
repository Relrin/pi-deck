import { describe, expect, test } from "bun:test";
import {
  CommandSchemas,
  GitCreateBranchRequest,
  GitCreateBranchResponse,
} from "../../src/protocol/commands.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("git.createBranch protocol schema", () => {
  test("accepts a valid uuid + non-empty name", () => {
    const parsed = GitCreateBranchRequest.parse({ projectId: VALID_UUID, name: "feat/x" });
    expect(parsed).toEqual({ projectId: VALID_UUID, name: "feat/x" });
  });

  test("rejects an empty name", () => {
    expect(() => GitCreateBranchRequest.parse({ projectId: VALID_UUID, name: "" })).toThrow();
  });

  test("rejects a non-uuid projectId", () => {
    expect(() => GitCreateBranchRequest.parse({ projectId: "not-a-uuid", name: "x" })).toThrow();
  });

  test("response accepts the canonical ok shape", () => {
    expect(GitCreateBranchResponse.parse({ ok: true })).toEqual({ ok: true });
  });

  test("response rejects ok: false", () => {
    expect(() => GitCreateBranchResponse.parse({ ok: false })).toThrow();
  });

  test("is wired into CommandSchemas under the git.createBranch key", () => {
    expect(CommandSchemas["git.createBranch"].request).toBe(GitCreateBranchRequest);
    expect(CommandSchemas["git.createBranch"].response).toBe(GitCreateBranchResponse);
  });
});
