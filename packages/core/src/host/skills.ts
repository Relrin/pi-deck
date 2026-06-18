import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import {
  DefaultResourceLoader,
  getAgentDir,
  loadSkills,
  loadSkillsFromDir,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { runGit } from "../git/runner.js";
import type { ScannedSkill, SessionCommandInfo, SkillInfo } from "../protocol/commands.js";

/**
 * Host-side skill management. Listing reuses pi's own discovery (`loadSkills`) so what the
 * settings panel shows is exactly what a session's system prompt will contain. Install only
 * ever writes into the **global** skills dir (`<agentDir>/skills`); uninstall is containment
 * checked against the known skill roots so a malicious `baseDir` can't escape into arbitrary
 * filesystem deletes.
 */

export interface SkillsListing {
  skills: SkillInfo[];
  diagnostics: Array<{ type: "warning" | "error" | "collision"; message: string; path?: string }>;
}

/** Directories pi-deck may delete skills from (per project). */
function skillRoots(projectPath: string | undefined, agentDir: string): string[] {
  const roots = [join(agentDir, "skills"), join(homedir(), ".agents", "skills")];
  if (projectPath) {
    roots.push(join(projectPath, ".pi", "skills"), join(projectPath, ".agents", "skills"));
  }
  return roots.map((r) => resolve(r));
}

function samePath(a: string, b: string): boolean {
  // Windows paths are case-insensitive; normalising both sides keeps the containment
  // check honest against mixed-case input from the renderer.
  const norm = (p: string) =>
    process.platform === "win32" ? resolve(p).toLowerCase() : resolve(p);
  return norm(a) === norm(b);
}

function isInside(child: string, parent: string): boolean {
  const from = process.platform === "win32" ? resolve(parent).toLowerCase() : resolve(parent);
  const to = process.platform === "win32" ? resolve(child).toLowerCase() : resolve(child);
  const rel = relative(from, to);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

export function listSkills(projectPath: string, agentDir = getAgentDir()): SkillsListing {
  let skillPaths: string[] = [];
  try {
    // Settings may add extra skill dirs (e.g. ~/.claude/skills). Unreadable settings just
    // mean the default locations are scanned.
    skillPaths = SettingsManager.create(projectPath, agentDir).getSkillPaths();
  } catch {
    skillPaths = [];
  }
  const result = loadSkills({ cwd: projectPath, agentDir, skillPaths, includeDefaults: true });
  const roots = skillRoots(projectPath, agentDir);
  return {
    skills: result.skills.map((s) => ({
      name: s.name,
      description: s.description,
      filePath: s.filePath,
      baseDir: s.baseDir,
      scope: s.sourceInfo.scope,
      disableModelInvocation: s.disableModelInvocation,
      removable: roots.some(
        (root) =>
          isInside(s.baseDir, root) || (samePath(s.baseDir, root) && isInside(s.filePath, root)),
      ),
    })),
    diagnostics: result.diagnostics.map((d) => ({
      type: d.type,
      message: d.message,
      path: d.path,
    })),
  };
}

/**
 * Slash commands derivable from disk alone, for composers with no live session yet (the
 * BLANK screen). Covers prompt templates + skills via pi's own loader, with extensions
 * disabled — extension commands only exist inside a running session and never execute
 * host-side. Ordering mirrors pi's `getCommands()`: templates before skills.
 */
export async function listProjectCommands(
  projectPath: string,
  agentDir = getAgentDir(),
): Promise<SessionCommandInfo[]> {
  let settingsManager: SettingsManager | undefined;
  try {
    settingsManager = SettingsManager.create(projectPath, agentDir);
  } catch {
    settingsManager = undefined;
  }
  const loader = new DefaultResourceLoader({
    cwd: projectPath,
    agentDir,
    ...(settingsManager ? { settingsManager } : {}),
    noExtensions: true,
    noThemes: true,
    noContextFiles: true,
  });
  await loader.reload();
  const templates = loader.getPrompts().prompts.map((t) => ({
    name: t.name,
    description: t.description,
    source: "prompt" as const,
    sourcePath: t.filePath,
  }));
  const skills = loader.getSkills().skills.map((s) => ({
    name: `skill:${s.name}`,
    description: s.description,
    source: "skill" as const,
    sourcePath: s.filePath,
  }));
  return [...templates, ...skills];
}

/** `https://github.com/foo/bar.git` / `git@host:foo/bar` → `bar`. */
export function repoDirName(url: string): string | null {
  const tail = url
    .replace(/[/\\]+$/, "")
    .split(/[/\\:]/)
    .pop();
  if (!tail) return null;
  const name = tail.replace(/\.git$/i, "").trim();
  return /^[\w.-]+$/.test(name) && name !== "." && name !== ".." ? name : null;
}

async function ensureAbsent(target: string): Promise<void> {
  const existing = await stat(target).catch(() => null);
  if (existing) {
    throw new Error(`${basename(target)} already exists in the skills directory — remove it first`);
  }
}

export async function installSkillFromGit(url: string, agentDir = getAgentDir()): Promise<string> {
  const name = repoDirName(url);
  if (!name) throw new Error("Could not derive a folder name from the repository URL");
  const skillsDir = join(agentDir, "skills");
  await mkdir(skillsDir, { recursive: true });
  const target = join(skillsDir, name);
  await ensureAbsent(target);
  await runGit(skillsDir, ["clone", "--depth", "1", url, name], {
    timeoutMs: 120_000,
    detectNotARepo: false,
  });
  return target;
}

export async function installSkillFromFolder(
  srcPath: string,
  agentDir = getAgentDir(),
): Promise<string> {
  const src = resolve(srcPath);
  const st = await stat(src).catch(() => null);
  if (!st?.isDirectory()) throw new Error("Selected path is not a folder");
  const entries = await readdir(src);
  const looksLikeSkills = entries.some((e) => {
    const lower = e.toLowerCase();
    return lower === "skill.md" || lower.endsWith(".md");
  });
  if (!looksLikeSkills) {
    throw new Error(
      "Folder doesn't look like a skill: expected a SKILL.md (or .md files) at its root",
    );
  }
  const skillsDir = join(agentDir, "skills");
  await mkdir(skillsDir, { recursive: true });
  const target = join(skillsDir, basename(src));
  if (samePath(src, target) || isInside(target, src)) {
    throw new Error("Folder is already inside the skills directory");
  }
  await ensureAbsent(target);
  await cp(src, target, { recursive: true });
  return target;
}

/**
 * Expand bare GitHub shorthands (`owner/repo`, `github.com/owner/repo`) to an https URL so the
 * placeholder examples and quick-links actually clone. Anything that already carries a scheme,
 * an scp-style `git@…` host, or looks like a local path is returned untouched.
 */
export function normalizeRepoUrl(raw: string): string {
  const url = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) || url.startsWith("git@") || url.startsWith("file:")) {
    return url;
  }
  const slug = url.replace(/^github\.com\//i, "");
  return /^[\w.-]+\/[\w.-]+$/.test(slug) ? `https://github.com/${slug}` : url;
}

/** Best-effort `owner/repo` slug for display (toast meta). Falls back to the folder name. */
export function repoSlug(url: string): string {
  const cleaned = url
    .trim()
    .replace(/^git@[^:]+:/, "")
    .replace(/^[a-z]+:\/\/(www\.)?[^/]+\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  return repoDirName(url) ?? cleaned;
}

/** A skill discovered inside a cloned repo, retained between `scanRepoSkills` and install. */
interface ScannedSkillEntry extends ScannedSkill {
  /** Absolute path of the skill's directory inside the clone — copied on install. */
  baseDir: string;
}

interface ScanCache {
  /** Temp dir holding the shallow clone; removed after install or when swept. */
  tempRoot: string;
  repo: { slug: string; branch: string; commit: string };
  skills: ScannedSkillEntry[];
  createdAt: number;
}

const scanCache = new Map<string, ScanCache>();
/** Scans older than this are dropped (and their temp clones deleted) on the next scan. */
const SCAN_TTL_MS = 30 * 60_000;

async function sweepStaleScans(): Promise<void> {
  const now = Date.now();
  for (const [id, entry] of scanCache) {
    if (now - entry.createdAt > SCAN_TTL_MS) {
      scanCache.delete(id);
      await rm(entry.tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Shallow-clone a repo into a temp dir and enumerate the skills inside it using pi's own
 * discovery (so what we list is exactly what pi would load). The clone is kept under `scanId`
 * so a follow-up `installSelectedSkills` can copy just the chosen folders without re-cloning.
 */
export async function scanRepoSkills(
  url: string,
  agentDir = getAgentDir(),
): Promise<{
  scanId: string;
  repo: { slug: string; branch: string; commit: string };
  skills: ScannedSkill[];
}> {
  await sweepStaleScans();
  const cloneUrl = normalizeRepoUrl(url);
  const name = repoDirName(cloneUrl);
  if (!name) throw new Error("Could not derive a folder name from the repository URL");

  const tempRoot = await mkdtemp(join(tmpdir(), "pi-deck-skill-scan-"));
  const repoDir = join(tempRoot, name);
  try {
    await runGit(tempRoot, ["clone", "--depth", "1", cloneUrl, name], {
      timeoutMs: 120_000,
      detectNotARepo: false,
    });
  } catch (err) {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    throw err;
  }

  // Branch/commit are cosmetic (toast meta); a repo missing them still installs fine.
  let branch = "";
  let commit = "";
  try {
    branch = (await runGit(repoDir, ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
    commit = (await runGit(repoDir, ["rev-parse", "--short", "HEAD"])).stdout.trim();
  } catch {
    /* ignore */
  }

  const installedNames = new Set(
    loadSkillsFromDir({ dir: join(agentDir, "skills"), source: "user" }).skills.map((s) => s.name),
  );

  // pi's recursive discovery skips dot-dirs (so `.git`) and `node_modules` for us.
  const found = loadSkillsFromDir({ dir: repoDir, source: "path" }).skills;
  const usedIds = new Set<string>();
  const skills: ScannedSkillEntry[] = found.map((s) => {
    let id = s.name;
    for (let n = 2; usedIds.has(id); n++) id = `${s.name}-${n}`;
    usedIds.add(id);
    return {
      id,
      name: s.name,
      description: s.description,
      alreadyInstalled: installedNames.has(s.name),
      baseDir: s.baseDir,
    };
  });

  const scanId = randomUUID();
  const repo = { slug: repoSlug(cloneUrl), branch, commit };
  scanCache.set(scanId, { tempRoot, repo, skills, createdAt: Date.now() });

  return {
    scanId,
    repo,
    skills: skills.map(({ id, name, description, alreadyInstalled }) => ({
      id,
      name,
      description,
      alreadyInstalled,
    })),
  };
}

/**
 * Copy the chosen skills from a prior scan's clone into the global skills dir. Selections
 * whose target name already exists are reported as `skipped` rather than overwritten. The
 * temp clone is removed once we're done with it.
 */
export async function installSelectedSkills(
  scanId: string,
  skillIds: string[],
  agentDir = getAgentDir(),
): Promise<{ installed: Array<{ name: string }>; skipped: string[] }> {
  const cache = scanCache.get(scanId);
  if (!cache) {
    throw new Error("This scan has expired — rescan the repository and try again");
  }
  const skillsDir = join(agentDir, "skills");
  await mkdir(skillsDir, { recursive: true });

  const wanted = new Set(skillIds);
  const installed: Array<{ name: string }> = [];
  const skipped: string[] = [];

  for (const entry of cache.skills) {
    if (!wanted.has(entry.id)) continue;
    const target = join(skillsDir, basename(entry.baseDir));
    if (await stat(target).catch(() => null)) {
      skipped.push(entry.name);
      continue;
    }
    await cp(entry.baseDir, target, {
      recursive: true,
      // Guard the rare case where the skill is the repo root itself.
      filter: (src) => !src.split(/[/\\]/).includes(".git"),
    });
    installed.push({ name: entry.name });
  }

  scanCache.delete(scanId);
  await rm(cache.tempRoot, { recursive: true, force: true }).catch(() => {});

  return { installed, skipped };
}

/** Folder install, normalised to the shared `skills.install` response shape. */
export async function installSkillFolder(
  srcPath: string,
  agentDir = getAgentDir(),
): Promise<{ installed: Array<{ name: string }>; skipped: string[] }> {
  const target = await installSkillFromFolder(srcPath, agentDir);
  return { installed: [{ name: basename(target) }], skipped: [] };
}

/**
 * Delete an installed skill. Directory skills (`baseDir` strictly inside a root) are removed
 * wholesale; root-level single-file skills (`baseDir` *is* a root) only lose their `.md` file
 * — deleting the root would take every sibling skill with it.
 */
export async function uninstallSkill(
  args: { filePath: string; baseDir: string },
  projectPath: string | undefined,
  agentDir = getAgentDir(),
): Promise<void> {
  const roots = skillRoots(projectPath, agentDir);
  const base = resolve(args.baseDir);
  const file = resolve(args.filePath);

  if (roots.some((root) => samePath(base, root))) {
    if (!isInside(file, base)) {
      throw new Error("Refusing to delete a file outside the skill directory");
    }
    await rm(file, { force: true });
    return;
  }
  if (!roots.some((root) => isInside(base, root))) {
    throw new Error("Refusing to delete a folder outside the known skill directories");
  }
  await rm(base, { recursive: true, force: true });
}
