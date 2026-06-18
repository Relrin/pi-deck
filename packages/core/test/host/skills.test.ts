import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGit } from "../../src/git/runner.js";
import {
  installSelectedSkills,
  installSkillFromFolder,
  listSkills,
  normalizeRepoUrl,
  repoDirName,
  repoSlug,
  scanRepoSkills,
  uninstallSkill,
} from "../../src/host/skills.js";

let tmpDir: string;
let agentDir: string;
let projectDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "pi-deck-skills-"));
  agentDir = join(tmpDir, "agent");
  projectDir = join(tmpDir, "project");
  await mkdir(join(agentDir, "skills"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeSkill(dir: string, name: string): Promise<string> {
  const skillDir = join(dir, name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: Test skill ${name} for unit tests.\n---\n\n# ${name}\n`,
    "utf8",
  );
  return skillDir;
}

describe("repoDirName", () => {
  test("derives folder names from common git URL shapes", () => {
    expect(repoDirName("https://github.com/anthropics/skills.git")).toBe("skills");
    expect(repoDirName("https://github.com/anthropics/skills")).toBe("skills");
    expect(repoDirName("git@github.com:badlogic/pi-skills.git")).toBe("pi-skills");
  });

  test("rejects names that would escape or be empty", () => {
    expect(repoDirName("///")).toBeNull();
    expect(repoDirName("..")).toBeNull();
  });
});

describe("listSkills", () => {
  test("finds global and project skills and marks them removable", async () => {
    await writeSkill(join(agentDir, "skills"), "global-skill");
    await writeSkill(join(projectDir, ".pi", "skills"), "project-skill");

    const listing = listSkills(projectDir, agentDir);
    const global = listing.skills.find((s) => s.name === "global-skill");
    const project = listing.skills.find((s) => s.name === "project-skill");

    expect(global).toBeDefined();
    expect(global?.scope).toBe("user");
    expect(global?.removable).toBe(true);
    expect(project).toBeDefined();
    expect(project?.scope).toBe("project");
    expect(project?.removable).toBe(true);
  });
});

describe("installSkillFromFolder", () => {
  test("copies a skill folder into the global skills dir", async () => {
    const src = await writeSkill(tmpDir, "my-skill");
    const installed = await installSkillFromFolder(src, agentDir);
    expect(installed).toBe(join(agentDir, "skills", "my-skill"));
    const st = await stat(join(installed, "SKILL.md"));
    expect(st.isFile()).toBe(true);
  });

  test("rejects folders without markdown content", async () => {
    const src = join(tmpDir, "not-a-skill");
    await mkdir(src, { recursive: true });
    await writeFile(join(src, "data.bin"), "x", "utf8");
    expect(installSkillFromFolder(src, agentDir)).rejects.toThrow(/SKILL.md/);
  });

  test("refuses to overwrite an existing install", async () => {
    const src = await writeSkill(tmpDir, "dup-skill");
    await installSkillFromFolder(src, agentDir);
    expect(installSkillFromFolder(src, agentDir)).rejects.toThrow(/already exists/);
  });
});

describe("normalizeRepoUrl", () => {
  test("expands bare GitHub shorthands to https URLs", () => {
    expect(normalizeRepoUrl("anthropics/skills")).toBe("https://github.com/anthropics/skills");
    expect(normalizeRepoUrl("github.com/mattpocock/skills")).toBe(
      "https://github.com/mattpocock/skills",
    );
  });

  test("leaves full URLs, scp-style, and local paths untouched", () => {
    expect(normalizeRepoUrl("https://github.com/anthropics/skills.git")).toBe(
      "https://github.com/anthropics/skills.git",
    );
    expect(normalizeRepoUrl("git@github.com:badlogic/pi-skills.git")).toBe(
      "git@github.com:badlogic/pi-skills.git",
    );
    expect(normalizeRepoUrl("/tmp/local/fixture-repo")).toBe("/tmp/local/fixture-repo");
    expect(normalizeRepoUrl("C:\\Users\\me\\fixture-repo")).toBe("C:\\Users\\me\\fixture-repo");
  });
});

describe("repoSlug", () => {
  test("derives owner/repo from common git URL shapes", () => {
    expect(repoSlug("https://github.com/anthropics/skills.git")).toBe("anthropics/skills");
    expect(repoSlug("git@github.com:badlogic/pi-skills.git")).toBe("badlogic/pi-skills");
  });
});

describe("scanRepoSkills + installSelectedSkills", () => {
  /** Turn a directory holding skills into a committed git repo we can clone from. */
  async function makeFixtureRepo(dir: string): Promise<void> {
    const env = {
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@t",
    };
    await runGit(dir, ["init"], { detectNotARepo: false });
    await runGit(dir, ["add", "-A"], { detectNotARepo: false });
    await runGit(dir, ["commit", "-m", "init"], { detectNotARepo: false, env });
  }

  test("scans a repo, then installs only the selected skills and skips already-installed ones", async () => {
    // Two skills in a fixture repo; "alpha" is also already installed globally.
    const repo = join(tmpDir, "fixture-repo");
    await writeSkill(repo, "alpha");
    await writeSkill(repo, "beta");
    await makeFixtureRepo(repo);
    await writeSkill(join(agentDir, "skills"), "alpha");

    const scan = await scanRepoSkills(repo, agentDir);
    const alpha = scan.skills.find((s) => s.name === "alpha");
    const beta = scan.skills.find((s) => s.name === "beta");
    expect(alpha?.alreadyInstalled).toBe(true);
    expect(beta?.alreadyInstalled).toBe(false);

    const result = await installSelectedSkills(
      scan.scanId,
      [alpha?.id ?? "", beta?.id ?? ""],
      agentDir,
    );

    expect(result.installed.map((s) => s.name)).toContain("beta");
    expect(result.skipped).toContain("alpha");
    expect((await stat(join(agentDir, "skills", "beta", "SKILL.md"))).isFile()).toBe(true);
  });

  test("rejects installing against an unknown or consumed scan handle", async () => {
    expect(installSelectedSkills("does-not-exist", ["x"], agentDir)).rejects.toThrow(/expired/);
  });
});

describe("uninstallSkill", () => {
  test("removes a directory skill inside the global root", async () => {
    const dir = await writeSkill(join(agentDir, "skills"), "doomed");
    await uninstallSkill({ filePath: join(dir, "SKILL.md"), baseDir: dir }, projectDir, agentDir);
    expect(await stat(dir).catch(() => null)).toBeNull();
  });

  test("a root-level single-file skill loses only its markdown file", async () => {
    const root = join(agentDir, "skills");
    const file = join(root, "loose-skill.md");
    await writeFile(file, "---\nname: loose\ndescription: d\n---\n", "utf8");
    const sibling = await writeSkill(root, "sibling");

    await uninstallSkill({ filePath: file, baseDir: root }, projectDir, agentDir);

    expect(await stat(file).catch(() => null)).toBeNull();
    expect(await stat(sibling).catch(() => null)).not.toBeNull();
    expect(await stat(root).catch(() => null)).not.toBeNull();
  });

  test("refuses paths outside the known skill roots", async () => {
    const outside = join(tmpDir, "precious");
    await mkdir(outside, { recursive: true });
    expect(
      uninstallSkill(
        { filePath: join(outside, "SKILL.md"), baseDir: outside },
        projectDir,
        agentDir,
      ),
    ).rejects.toThrow(/outside/);
    expect(await stat(outside).catch(() => null)).not.toBeNull();
  });

  test("refuses traversal out of a root via dotted segments", async () => {
    const sneaky = join(agentDir, "skills", "..", "..", "victim");
    await mkdir(join(tmpDir, "victim"), { recursive: true });
    expect(
      uninstallSkill({ filePath: join(sneaky, "SKILL.md"), baseDir: sneaky }, projectDir, agentDir),
    ).rejects.toThrow(/outside/);
  });
});
