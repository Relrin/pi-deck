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
    body: "Here's a failing test:\n\n```\n<paste the test name + full stack trace / assertion output>\n```\n\nReproduce it first, then find the root cause — explain in a sentence or two what's actually broken before you change any code. Apply the smallest fix that makes it pass without weakening the test; if the test's expectation was wrong, fix the test instead and tell me why. Re-run the affected tests to confirm they're green and that nothing nearby broke.",
  },
  {
    id: "implement-a-spec",
    num: "02",
    title: "Implement a spec",
    blurb: "Drop a Markdown spec, pi plans + writes against it.",
    body: "Implement the spec below.\n\n```markdown\n<paste the spec here>\n```\n\nFirst read the relevant code and outline a short plan: the files you'll touch, the order you'll do them in, and any ambiguities you need me to resolve. Wait for my go-ahead, then build it in small, reviewable steps that follow the existing patterns and conventions. Add or update tests for the new behaviour and run them, and flag anything in the spec that was unclear or that you had to deviate from.",
  },
  {
    id: "refactor-in-place",
    num: "03",
    title: "Refactor in place",
    blurb: "Pick a file, describe the shape you want.",
    body: "Refactor <path/to/file> into <describe the shape you want>.\n\nKeep this behaviour-preserving: the public API and observable behaviour stay identical unless I say otherwise. Work in small steps and keep the build and existing tests green after each one — don't rewrite everything at once. Avoid unrelated drive-by changes, and when you're done, summarise what moved and why.",
  },
  {
    id: "write-the-docs",
    num: "04",
    title: "Write the docs",
    blurb: "Generate docs from a module + commit.",
    body: "Write developer-facing documentation for <module / path>.\n\nRead the actual code first so the docs match reality - don't invent behaviour. Cover what it's for, the public API (signatures and key parameters), at least one runnable usage example, and the common gotchas or edge cases. Match the project's existing docs style and location. Show me the draft, then commit it with a clear message once it reads well.",
  },
  {
    id: "review-a-pr",
    num: "05",
    title: "Review a PR",
    blurb: "Open a PR by number, get a structured review.",
    body: "Review PR #<number> (or this branch's diff against <base branch>).\n\nWork from the actual diff and give a structured review:\n- Correctness - bugs, edge cases, error handling.\n- Design - does it fit the codebase; is there a simpler approach?\n- Tests - is the new behaviour covered; what's missing?\n- Risk - security, performance, migrations, backward compatibility.\n\nCite specific files and lines, separate must-fix blockers from nits, and finish with a clear verdict (approve / request changes). Don't change any code unless I ask.",
  },
  {
    id: "bisect-a-regression",
    num: "06",
    title: "Bisect a regression",
    blurb: "Find the commit that broke a behaviour.",
    body: "Help me track down a regression.\n\n- Expected: <what used to happen>\n- Broken: <what happens now>\n- Last known-good: <commit / tag / version, if known>\n\nReproduce the broken behaviour first, then narrow down the offending change against that reproduction (git history / git bisect). Identify the exact commit that introduced it and explain why that change caused the break, then propose the lower-risk fix — a targeted forward fix or a revert — plus the test that should have caught it.",
  },
];
