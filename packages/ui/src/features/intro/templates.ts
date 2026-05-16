export interface IntroTemplate {
  id: string;
  num: string;
  title: string;
  blurb: string;
  body: string;
}

export const INTRO_TEMPLATES: readonly IntroTemplate[] = [
  {
    id: "fix-failing-test",
    num: "01",
    title: "Fix a failing test",
    blurb: "Paste a stack trace, get a patched test + fix.",
    body: "Here's a failing test:\n\n```\n<paste stack trace here>\n```\n\nIdentify the root cause and propose a minimal fix. Update the test if its expectation was wrong.",
  },
  {
    id: "implement-a-spec",
    num: "02",
    title: "Implement a spec",
    blurb: "Drop a Markdown spec, pi plans + writes against it.",
    body: "Implement the following spec end-to-end. Produce a short plan first, wait for confirmation, then execute.\n\n```markdown\n<paste spec here>\n```",
  },
  {
    id: "refactor-in-place",
    num: "03",
    title: "Refactor in place",
    blurb: "Pick a file, describe the shape you want.",
    body: "Refactor <path/to/file> so that <describe the new shape>. Keep public APIs unchanged unless I say otherwise.",
  },
  {
    id: "write-the-docs",
    num: "04",
    title: "Write the docs",
    blurb: "Generate docs from a module + commit.",
    body: "Write developer-facing documentation for <module/path>. Cover purpose, public API, common gotchas, and one runnable example. Commit when done.",
  },
  {
    id: "review-a-pr",
    num: "05",
    title: "Review a PR",
    blurb: "Open a PR by number, get a structured review.",
    body: "Review PR #<number>. Produce a structured review: correctness, design, tests, risk. Flag anything that should block merge.",
  },
  {
    id: "bisect-a-regression",
    num: "06",
    title: "Bisect a regression",
    blurb: "Find the commit that broke a behaviour.",
    body: "Bisect a regression. The expected behavior is <…>; the broken behavior is <…>. Identify the commit that introduced the change and propose a revert or forward fix.",
  },
];
