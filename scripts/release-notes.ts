#!/usr/bin/env bun
import { spawnSync } from "node:child_process";

type Commit = { hash: string; subject: string };

function git(...args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function lastTag(): string | null {
  const result = spawnSync("git", ["describe", "--tags", "--abbrev=0"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function commitsSince(tag: string | null): Commit[] {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const raw = git("log", "--no-merges", "--pretty=%H%x09%s", range);
  if (!raw) return [];
  return raw.split("\n").map((line) => {
    const [hash, subject] = line.split("\t");
    return { hash: hash ?? "", subject: subject ?? "" };
  });
}

const GROUPS: ReadonlyArray<{ label: string; prefixes: ReadonlyArray<string> }> = [
  { label: "Features", prefixes: ["feat"] },
  { label: "Fixes", prefixes: ["fix"] },
  { label: "Performance", prefixes: ["perf"] },
  { label: "Documentation", prefixes: ["docs"] },
  { label: "Refactors", prefixes: ["refactor"] },
  { label: "Tests", prefixes: ["test"] },
  { label: "Build & CI", prefixes: ["build", "ci", "chore"] },
];

function classify(subject: string): string {
  const match = /^(\w+)(?:\(.+\))?!?:/.exec(subject);
  if (!match) return "Other";
  const type = match[1]?.toLowerCase() ?? "";
  const group = GROUPS.find((g) => g.prefixes.includes(type));
  return group?.label ?? "Other";
}

const tag = lastTag();
const commits = commitsSince(tag);
const buckets = new Map<string, Commit[]>();

for (const commit of commits) {
  const label = classify(commit.subject);
  const bucket = buckets.get(label) ?? [];
  bucket.push(commit);
  buckets.set(label, bucket);
}

const header = tag ? `## Changes since ${tag}` : "## Initial release";
const lines: string[] = [header, ""];

if (commits.length === 0) {
  lines.push("_No commits since last tag._");
} else {
  const orderedLabels = [...GROUPS.map((g) => g.label), "Other"];
  for (const label of orderedLabels) {
    const bucket = buckets.get(label);
    if (!bucket || bucket.length === 0) continue;
    lines.push(`### ${label}`);
    for (const commit of bucket) {
      lines.push(`- ${commit.subject} (${commit.hash.slice(0, 7)})`);
    }
    lines.push("");
  }
}

console.log(lines.join("\n").trimEnd());
