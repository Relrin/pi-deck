import { describe, expect, test } from "bun:test";
import type { FsNode } from "@pi-deck/core/fs/types.js";
import type { GitChange } from "@pi-deck/core/git/types.js";
import {
  buildTreeThemeInput,
  flattenFsNodes,
  gitChangesToEntries,
  gitStatusToPierre,
  treePathBasename,
  treePathParent,
  treeRelToAbs,
} from "../../../src/features/files/pierreTreeAdapters.js";

function dir(relPath: string, children: FsNode[]): FsNode {
  return {
    path: `/repo/${relPath}`,
    name: relPath.split("/").pop() ?? relPath,
    type: "dir",
    relPath,
    children,
  };
}
function file(relPath: string): FsNode {
  return {
    path: `/repo/${relPath}`,
    name: relPath.split("/").pop() ?? relPath,
    type: "file",
    relPath,
  };
}

function change(path: string, status: GitChange["status"]): GitChange {
  return { path, status, staged: false, untracked: status === "?", add: 0, del: 0 };
}

describe("flattenFsNodes", () => {
  test("emits files bare and directories with a trailing slash, depth-first", () => {
    const nodes: FsNode[] = [
      dir("src", [file("src/index.ts"), dir("src/empty", [])]),
      file("README.md"),
    ];
    expect(flattenFsNodes(nodes)).toEqual(["src/", "src/index.ts", "src/empty/", "README.md"]);
  });

  test("preserves empty directories (so they survive Pierre's path inference)", () => {
    expect(flattenFsNodes([dir("logs", [])])).toEqual(["logs/"]);
  });
});

describe("gitStatusToPierre", () => {
  test("maps porcelain letters, collapsing M/C/U to modified", () => {
    expect(gitStatusToPierre("A")).toBe("added");
    expect(gitStatusToPierre("D")).toBe("deleted");
    expect(gitStatusToPierre("?")).toBe("untracked");
    expect(gitStatusToPierre("R")).toBe("renamed");
    expect(gitStatusToPierre("M")).toBe("modified");
    expect(gitStatusToPierre("C")).toBe("modified");
    expect(gitStatusToPierre("U")).toBe("modified");
  });
});

describe("gitChangesToEntries", () => {
  test("passes paths through unchanged when project root === git root", () => {
    const changes = [change("src/a.ts", "M"), change("b.txt", "?")];
    expect(gitChangesToEntries(changes, "/repo", "/repo")).toEqual([
      { path: "src/a.ts", status: "modified" },
      { path: "b.txt", status: "untracked" },
    ]);
  });

  test("re-bases onto the opened subtree when project root is a repo subdir", () => {
    const changes = [
      change("packages/ui/x.ts", "A"),
      change("packages/core/y.ts", "M"), // outside the opened subtree → dropped
    ];
    expect(gitChangesToEntries(changes, "/repo", "/repo/packages/ui")).toEqual([
      { path: "x.ts", status: "added" },
    ]);
  });

  test("normalizes backslashes and trailing slashes on the roots", () => {
    const changes = [change("sub\\a.ts", "D")];
    expect(gitChangesToEntries(changes, "C:/repo/", "C:/repo")).toEqual([
      { path: "sub/a.ts", status: "deleted" },
    ]);
  });

  test("falls back to treating change paths as project-relative when no git root", () => {
    expect(gitChangesToEntries([change("a.ts", "M")], undefined, "/repo")).toEqual([
      { path: "a.ts", status: "modified" },
    ]);
  });
});

describe("buildTreeThemeInput", () => {
  test("maps tokens onto the keys themeToTreeStyles consumes", () => {
    const input = buildTreeThemeInput(
      {
        "--bg-1": "oklch(0.19 0.008 60)",
        "--ink-1": "oklch(0.78 0.008 60)",
        "--accent-soft": "oklch(0.74 0.17 50 / 0.14)",
        "--add": "oklch(0.78 0.16 145)",
      },
      "dark",
    );
    expect(input.type).toBe("dark");
    expect(input.bg).toBe("oklch(0.19 0.008 60)");
    expect(input.colors?.["sideBar.background"]).toBe("oklch(0.19 0.008 60)");
    expect(input.colors?.["list.activeSelectionBackground"]).toBe("oklch(0.74 0.17 50 / 0.14)");
    expect(input.colors?.["gitDecoration.addedResourceForeground"]).toBe("oklch(0.78 0.16 145)");
  });

  test("omits keys whose tokens are missing or blank rather than emitting empty strings", () => {
    const input = buildTreeThemeInput({ "--bg-1": "  ", "--ink-1": "#fff" }, "light");
    expect(input.bg).toBeUndefined();
    expect(input.colors && "sideBar.background" in input.colors).toBe(false);
    expect(input.colors?.["sideBar.foreground"]).toBe("#fff");
  });
});

describe("tree path helpers", () => {
  test("treePathBasename tolerates a trailing slash", () => {
    expect(treePathBasename("src/components/Button.tsx")).toBe("Button.tsx");
    expect(treePathBasename("src/components/")).toBe("components");
    expect(treePathBasename("README.md")).toBe("README.md");
  });

  test("treePathParent returns the project-relative parent, empty at root", () => {
    expect(treePathParent("src/components/Button.tsx")).toBe("src/components");
    expect(treePathParent("src/")).toBe("");
    expect(treePathParent("README.md")).toBe("");
  });

  test("treeRelToAbs joins onto the project root, stripping dir slashes", () => {
    expect(treeRelToAbs("/repo", "src/a.ts")).toBe("/repo/src/a.ts");
    expect(treeRelToAbs("/repo/", "src/empty/")).toBe("/repo/src/empty");
    expect(treeRelToAbs("/repo", "")).toBe("/repo");
  });
});
