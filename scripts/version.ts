#!/usr/bin/env bun
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Bump = "patch" | "minor" | "major";

const RAW = process.argv[2];
if (!RAW) {
  console.error("usage: bun run version <patch|minor|major|x.y.z>");
  process.exit(1);
}

const ROOT = join(import.meta.dir, "..");
const ROOT_PKG = join(ROOT, "package.json");
const PACKAGES_DIR = join(ROOT, "packages");

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function writeJson(path: string, value: Record<string, unknown>): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function parseSemver(value: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) {
    throw new Error(`Not a valid semver: ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function bump(current: string, kind: Bump): string {
  const [major, minor, patch] = parseSemver(current);
  switch (kind) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

function resolveNext(raw: string, currentRoot: string): string {
  if (raw === "patch" || raw === "minor" || raw === "major") {
    return bump(currentRoot, raw);
  }
  return parseSemver(raw).join(".");
}

const rootPkg = readJson(ROOT_PKG);
const currentVersion = String(rootPkg.version ?? "0.0.0");
const nextVersion = resolveNext(RAW, currentVersion);

console.log(`Bumping pi-deck: ${currentVersion} -> ${nextVersion}`);

rootPkg.version = nextVersion;
writeJson(ROOT_PKG, rootPkg);

for (const name of readdirSync(PACKAGES_DIR)) {
  const pkgPath = join(PACKAGES_DIR, name, "package.json");
  let pkg: Record<string, unknown>;
  try {
    pkg = readJson(pkgPath);
  } catch {
    continue;
  }
  pkg.version = nextVersion;
  writeJson(pkgPath, pkg);
  console.log(`  ${pkg.name ?? name} -> ${nextVersion}`);
}

console.log("");
console.log("Next steps:");
console.log(`  git commit -am "release: v${nextVersion}"`);
console.log(`  git tag v${nextVersion}`);
console.log(`  git push && git push --tags`);
