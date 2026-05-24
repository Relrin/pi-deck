import { describe, expect, test } from "bun:test";
import { buildPrUrl, normalizeRemoteUrl } from "../../src/git/pr.js";

describe("normalizeRemoteUrl", () => {
  test("https remote with .git suffix", () => {
    expect(normalizeRemoteUrl("https://github.com/relrin/pi-deck.git")).toEqual({
      host: "github.com",
      path: "relrin/pi-deck",
      raw: "https://github.com/relrin/pi-deck",
    });
  });

  test("https remote with userinfo", () => {
    expect(normalizeRemoteUrl("https://relrin@github.com/relrin/pi-deck.git")).toEqual({
      host: "github.com",
      path: "relrin/pi-deck",
      raw: "https://relrin@github.com/relrin/pi-deck",
    });
  });

  test("scp-style ssh url", () => {
    expect(normalizeRemoteUrl("git@github.com:relrin/pi-deck.git")).toEqual({
      host: "github.com",
      path: "relrin/pi-deck",
      raw: "git@github.com:relrin/pi-deck",
    });
  });

  test("ssh:// url", () => {
    expect(normalizeRemoteUrl("ssh://git@gitlab.com/foo/bar.git")).toEqual({
      host: "gitlab.com",
      path: "foo/bar",
      raw: "ssh://git@gitlab.com/foo/bar",
    });
  });

  test("nested groups (gitlab)", () => {
    const r = normalizeRemoteUrl("git@gitlab.com:group/sub/project.git");
    expect(r.host).toBe("gitlab.com");
    expect(r.path).toBe("group/sub/project");
  });
});

describe("buildPrUrl", () => {
  test("github → /compare?expand=1", () => {
    const base = { host: "github.com", path: "relrin/pi-deck", raw: "" };
    expect(buildPrUrl(base, "feat/x")).toBe(
      "https://github.com/relrin/pi-deck/compare/feat%2Fx?expand=1",
    );
  });

  test("gitlab → /-/merge_requests/new", () => {
    const base = { host: "gitlab.com", path: "group/proj", raw: "" };
    expect(buildPrUrl(base, "feat/x")).toBe(
      "https://gitlab.com/group/proj/-/merge_requests/new?merge_request%5Bsource_branch%5D=feat%2Fx",
    );
  });

  test("bitbucket → /pull-requests/new", () => {
    const base = { host: "bitbucket.org", path: "team/proj", raw: "" };
    expect(buildPrUrl(base, "feat/x")).toBe(
      "https://bitbucket.org/team/proj/pull-requests/new?source=feat%2Fx",
    );
  });

  test("unknown host → repo URL fallback", () => {
    const base = { host: "git.example.com", path: "x/y", raw: "" };
    expect(buildPrUrl(base, "feat/x")).toBe("https://git.example.com/x/y");
  });

  test("empty host (unparseable) → raw fallback", () => {
    const base = { host: "", path: "", raw: "weird://value" };
    expect(buildPrUrl(base, "feat/x")).toBe("weird://value");
  });
});
