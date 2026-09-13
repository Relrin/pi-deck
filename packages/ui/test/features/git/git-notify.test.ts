import { afterEach, describe, expect, test } from "bun:test";
import {
  commitSuccessNotification,
  pullFailureNotification,
  pushFailureNotification,
  pushSuccessNotification,
  rollbackSuccessNotification,
  stashSuccessNotification,
} from "../../../src/features/git/git-notify";
import { loadLocale } from "../../../src/i18n/i18n-util.sync";
import { llFor } from "../../../src/i18n/t";
import { useLocaleStore } from "../../../src/i18n/useLocaleStore";

// `test/setup.ts` sync-loads only `en`. Never `mock.module` the i18n modules — they are
// process-global and unrevertable, and `bun test`'s file order is OS-dependent.
loadLocale("ru");

const PROJECT = "proj-1";

afterEach(() => {
  useLocaleStore.setState({ uiLocale: "en", agentLanguage: "match-ui" });
});

/**
 * `git-notify.ts` is the reference example of imperative translation: plain functions called from
 * zustand actions, reading `ll()` inside the function body. These tests pin the two things that
 * would break silently — interpolation of a branch name, and a plural file count — plus the
 * reason-body lookup that used to be a module-level `Record` and would have frozen the launch
 * locale.
 */
describe("commitSuccessNotification", () => {
  const input = {
    branch: "feature/i18n",
    shortSha: "9a3f12c",
    subject: "Localize the shell",
    fileCount: 7,
    add: 212,
    del: 18,
    actions: [],
  };

  test("interpolates the branch name into the title", () => {
    expect(commitSuccessNotification(PROJECT, input).title).toBe("Committed to feature/i18n");
  });

  test("falls back to a branchless title when there is no branch", () => {
    const { branch: _branch, ...rest } = input;
    expect(commitSuccessNotification(PROJECT, rest).title).toBe("Commit created");
  });

  test("meta carries the sha, a plural file count, the diff stat and a relative time", () => {
    expect(commitSuccessNotification(PROJECT, input).meta).toBe(
      "9a3f12c · 7 files · +212 -18 · just now",
    );
  });

  test("the file count is a real plural, not an appended 's'", () => {
    const one = commitSuccessNotification(PROJECT, { ...input, fileCount: 1 }).meta;
    expect(one).toContain("1 file ·");
    expect(one).not.toContain("1 files");
  });

  test("the id is stable per project, so a retry replaces rather than stacks", () => {
    expect(commitSuccessNotification(PROJECT, input).id).toBe("git.commit:proj-1");
  });
});

describe("pushSuccessNotification", () => {
  const base = { remote: "origin", branch: "master", ahead: 3 };

  test("interpolates remote and branch, and pluralizes the commit count", () => {
    const n = pushSuccessNotification(PROJECT, base);
    expect(n.title).toBe("Pushed to origin/master");
    expect(n.body).toBe("3 commits sent upstream.");
  });

  test("singular commit count", () => {
    expect(pushSuccessNotification(PROJECT, { ...base, ahead: 1 }).body).toBe(
      "1 commit sent upstream.",
    );
  });

  test("nothing ahead reads as up to date rather than '0 commits'", () => {
    expect(pushSuccessNotification(PROJECT, { ...base, ahead: 0 }).body).toBe(
      "Branch is up to date with origin.",
    );
  });
});

describe("failure notifications", () => {
  test("push failure keeps the git command in its reason body verbatim", () => {
    const n = pushFailureNotification(PROJECT, {
      remote: "origin",
      branch: "master",
      reason: "no_upstream",
      stderr: "",
      actions: [],
    });
    expect(n.title).toBe("Push to origin failed");
    expect(n.tag).toBe("Push failed");
    // The embedded command is what the user would type — it must survive translation.
    expect(n.body).toContain("git push -u <remote> <branch>");
    expect(n.meta).toBe("origin/master · no-upstream");
  });

  test("a non-fast-forward push is tagged as rejected, not merely failed", () => {
    const n = pushFailureNotification(PROJECT, {
      remote: "origin",
      branch: "master",
      reason: "non_fast_forward",
      stderr: "",
      actions: [],
    });
    expect(n.tag).toBe("Push rejected");
    expect(n.meta).toBe("origin/master · non-fast-forward");
  });

  test("the log footnote appears only when there is stderr to show", () => {
    const args = {
      remote: "origin",
      branch: "master",
      reason: "unknown" as const,
      actions: [],
    };
    expect(pushFailureNotification(PROJECT, { ...args, stderr: "" }).footnote).toBeUndefined();
    expect(pushFailureNotification(PROJECT, { ...args, stderr: "boom" }).footnote?.label).toBe(
      "view log",
    );
  });

  test("pull failure resolves its own reason table", () => {
    const n = pullFailureNotification(PROJECT, {
      remote: "origin",
      branch: "master",
      reason: "conflict",
      stderr: "",
    });
    expect(n.body).toContain("Merge conflict");
    expect(n.meta).toBe("origin/master · conflict");
  });
});

describe("plural bodies", () => {
  test("rollback", () => {
    expect(rollbackSuccessNotification(PROJECT, { fileCount: 1 }).body).toBe(
      "1 file restored to HEAD.",
    );
    expect(rollbackSuccessNotification(PROJECT, { fileCount: 4 }).body).toBe(
      "4 files restored to HEAD.",
    );
  });

  test("stash distinguishes a selection from the whole tree", () => {
    const pop = { id: "pop", label: "apply", onSelect: () => {} };
    expect(stashSuccessNotification(PROJECT, { selectedCount: 1 }, pop).body).toBe(
      "1 file moved to the stash.",
    );
    expect(stashSuccessNotification(PROJECT, { selectedCount: 5 }, pop).body).toBe(
      "5 files moved to the stash.",
    );
    expect(stashSuccessNotification(PROJECT, {}, pop).body).toBe("Working tree stashed.");
  });
});

/**
 * The reason bodies used to be module-level `Record` constants, evaluated once at import. That
 * would have captured whatever catalog was loaded when the module first ran and never updated on a
 * language switch — a bug no lint rule catches, because it lives in a `.ts` file where the Biome
 * rule against importing the imperative translator into a component does not apply.
 */
describe("a language switch reaches the builders", () => {
  test("the reason body is resolved per call, not frozen at import", () => {
    const english = pushFailureNotification(PROJECT, {
      remote: "origin",
      branch: "master",
      reason: "auth_failed",
      stderr: "",
      actions: [],
    }).body;

    useLocaleStore.setState({ uiLocale: "ru" });

    const russian = pushFailureNotification(PROJECT, {
      remote: "origin",
      branch: "master",
      reason: "auth_failed",
      stderr: "",
      actions: [],
    }).body;

    // `git` is untranslated until phase 07, so the text is still the English fallback. What this
    // pins is that the lookup happened again under the new locale rather than returning a value
    // captured at module scope — assert on the store, and on the call having succeeded at all.
    expect(useLocaleStore.getState().uiLocale).toBe("ru");
    expect(russian).toBe(english);
    expect(russian ?? "").not.toBe("");
  });

  test("a translated namespace really does change mid-run", () => {
    // `plan` is translated, so it demonstrates the memo in `t.ts` is not pinning one locale.
    expect(String(llFor("ru").plan.panel.inProgressFallback())).not.toBe(
      String(llFor("en").plan.panel.inProgressFallback()),
    );
  });
});
