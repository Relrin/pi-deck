import type { CommandResponse, SkillInfo } from "@pi-deck/core/protocol/commands.js";
import { useCallback, useEffect, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { PidChip } from "../../../components/chip/PidChip";
import { humanizeError } from "../../../lib/format/humanize-error.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { useProjectsStore } from "../../sessions/useProjectsStore";
import { useSessionsStore } from "../../sessions/useSessionsStore";

type SkillsData = CommandResponse<"skills.list">;

/**
 * Settings → Skills. Lists every skill pi discovers for the active project (global dirs like
 * `~/.pi/agent/skills` plus project `.pi/skills` / `.agents/skills`), with install (git clone
 * or local folder copy into the global dir) and uninstall. Skills become `/skill:name`
 * commands in the composer and are advertised to the model via the system prompt.
 */
export function SkillsSection() {
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [gitUrl, setGitUrl] = useState("");
  const [installing, setInstalling] = useState(false);

  const load = useCallback(async () => {
    const client = useSessionsStore.getState().client;
    if (!client || !projectId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      setData(await client.call("skills.list", { projectId }));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const install = async (
    source: { kind: "git"; url: string } | { kind: "folder"; path: string },
  ) => {
    const client = useSessionsStore.getState().client;
    if (!client) return;
    setInstalling(true);
    try {
      await client.call("skills.install", { source });
      setGitUrl("");
      await load();
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to install skill"));
    } finally {
      setInstalling(false);
    }
  };

  const installFromFolder = async () => {
    const picker = window.bridge?.openDirectory;
    if (!picker) {
      useNotificationStore.getState().error("Folder picker unavailable in this build");
      return;
    }
    const path = await picker();
    if (!path) return;
    await install({ kind: "folder", path });
  };

  const uninstall = async (skill: SkillInfo) => {
    const client = useSessionsStore.getState().client;
    if (!client || !projectId) return;
    try {
      await client.call("skills.uninstall", {
        projectId,
        filePath: skill.filePath,
        baseDir: skill.baseDir,
      });
      await load();
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to remove skill"));
    }
  };

  const globalSkills = data?.skills.filter((s) => s.scope !== "project") ?? [];
  const projectSkills = data?.skills.filter((s) => s.scope === "project") ?? [];

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">Settings · Skills</div>
        <h1 className="pid-settings-section-title">Agent Skills</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-desc">
          Skills are capability packages the agent loads on demand (
          <a href="https://agentskills.io" target="_blank" rel="noreferrer">
            Agent Skills standard
          </a>
          ). Their descriptions ride along in the system prompt, and each one is invocable directly
          by typing <code>/skill:name</code> in the composer.{" "}
          <strong>Review skill content before installing</strong> — a skill can instruct the agent
          to run arbitrary code.
        </div>
      </section>

      <section className="pid-settings-block">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div className="pid-settings-block-label">
            Installed skills{projectId ? "" : " (open a project to list)"}
          </div>
          <PidButton onClick={() => void load()} disabled={loading || !projectId}>
            {loading ? "Scanning..." : "Refresh"}
          </PidButton>
        </div>

        <SkillGroup title="Global" skills={globalSkills} onUninstall={uninstall} />
        <SkillGroup title="Project" skills={projectSkills} onUninstall={uninstall} />

        {data && data.diagnostics.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {data.diagnostics.map((d) => (
              <div
                key={`${d.message}|${d.path ?? ""}`}
                className="pid-form-hint"
                style={{ color: d.type === "error" ? "var(--del)" : "var(--mod)" }}
              >
                {d.message}
                {d.path ? <code style={{ marginLeft: 6 }}>{d.path}</code> : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">Install</div>
        <div className="pid-settings-block-desc">
          Installs into <code>~/.pi/agent/skills/</code>. Clone a skills repository (e.g.{" "}
          <code>https://github.com/anthropics/skills</code>) or copy a local folder containing a{" "}
          <code>SKILL.md</code>. Sessions load skills when their agent starts — a session that is
          already running picks up new installs the next time it's reopened.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="pid-form-input"
            style={{ flex: 1 }}
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            placeholder="https://github.com/owner/skills-repo.git"
            spellCheck={false}
          />
          <PidButton
            variant="primary"
            longLabel
            disabled={!gitUrl.trim() || installing}
            onClick={() => void install({ kind: "git", url: gitUrl.trim() })}
          >
            {installing ? "Installing…" : "Clone"}
          </PidButton>
          <PidButton longLabel disabled={installing} onClick={() => void installFromFolder()}>
            From folder…
          </PidButton>
        </div>
      </section>
    </div>
  );
}

function SkillGroup({
  title,
  skills,
  onUninstall,
}: {
  title: string;
  skills: SkillInfo[];
  onUninstall: (skill: SkillInfo) => Promise<void>;
}) {
  if (skills.length === 0) {
    return (
      <div style={{ marginTop: 8 }}>
        <div className="pid-settings-block-label">{title}</div>
        <div className="pid-list-empty">No {title.toLowerCase()} skills found.</div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div className="pid-settings-block-label">{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {skills.map((skill) => (
          <SkillRow key={skill.filePath} skill={skill} onUninstall={onUninstall} />
        ))}
      </div>
    </div>
  );
}

function SkillRow({
  skill,
  onUninstall,
}: {
  skill: SkillInfo;
  onUninstall: (skill: SkillInfo) => Promise<void>;
}) {
  // Deleting files off disk deserves a second click; the arm state resets after a beat.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        background: "var(--bg-1)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--ink-0)", fontSize: "var(--t-13)" }}>
            <code>/skill:{skill.name}</code>
          </span>
          {skill.disableModelInvocation ? <PidChip variant="info">manual only</PidChip> : null}
        </div>
        <div style={{ color: "var(--ink-2)", fontSize: "var(--t-12)", marginTop: 2 }}>
          {skill.description}
        </div>
        <div
          style={{
            color: "var(--ink-3)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.04em",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={skill.filePath}
        >
          {skill.filePath}
        </div>
      </div>
      {skill.removable ? (
        <PidButton
          variant={armed ? "danger" : "ghost"}
          longLabel
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            setArmed(false);
            void onUninstall(skill);
          }}
        >
          {armed ? "Confirm remove" : "Remove"}
        </PidButton>
      ) : null}
    </div>
  );
}
