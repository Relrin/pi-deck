import { describe, expect, test } from "bun:test";
import {
  CommandSchemas,
  GitCreateBranchRequest,
  GitCreateBranchResponse,
  GitDiffHunksRequest,
  GitDiffHunksResponse,
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

describe("git.diffHunks protocol schema", () => {
  test("accepts a valid uuid request and round-trips a hunks map", () => {
    expect(GitDiffHunksRequest.parse({ projectId: VALID_UUID })).toEqual({
      projectId: VALID_UUID,
    });

    const payload = {
      hunksByPath: {
        "src/foo.ts": [{ oldStart: 12, oldLines: 2, newStart: 12, newLines: 3, add: 3, del: 2 }],
        "src/empty.ts": [],
      },
    };
    expect(GitDiffHunksResponse.parse(payload)).toEqual(payload);
  });

  test("rejects negative line counts", () => {
    expect(() =>
      GitDiffHunksResponse.parse({
        hunksByPath: {
          x: [{ oldStart: -1, oldLines: 0, newStart: 0, newLines: 0, add: 0, del: 0 }],
        },
      }),
    ).toThrow();
  });

  test("is wired into CommandSchemas under the git.diffHunks key", () => {
    expect(CommandSchemas["git.diffHunks"].request).toBe(GitDiffHunksRequest);
    expect(CommandSchemas["git.diffHunks"].response).toBe(GitDiffHunksResponse);
  });
});
