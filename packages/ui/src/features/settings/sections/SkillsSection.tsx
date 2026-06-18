import type { CommandResponse, SkillInfo } from "@pi-deck/core/protocol/commands.js";
import { FolderOpen, GitBranch, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { PidChip } from "../../../components/chip/PidChip";
import { humanizeError } from "../../../lib/format/humanize-error.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { useProjectsStore } from "../../sessions/useProjectsStore";
import { useSessionsStore } from "../../sessions/useSessionsStore";
import { InstallSkillsModal } from "./InstallSkillsModal";

type SkillsData = CommandResponse<"skills.list">;

const THIN_CTL = {
  height: 28,
  paddingTop: 0,
  paddingBottom: 0,
  boxSizing: "border-box",
} as const;

/**
 * Settings → Skills. Lists every skill pi discovers for the active project (global dirs like
 * `~/.pi/agent/skills` plus project `.pi/skills` / `.agents/skills`). Install via the repo
 * scan/select modal (clone → pick a subset → copy into the global dir) or from a local folder;
 * remove deletes the skill off disk. Skills become `/skill:name` commands in the composer and
 * are advertised to the model via the system prompt.
 */
export function SkillsSection() {
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [query, setQuery] = useState("");

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

  const installFromFolder = async () => {
    const picker = window.bridge?.openDirectory;
    if (!picker) {
      useNotificationStore.getState().error("Folder picker unavailable in this build");
      return;
    }
    const path = await picker();
    if (!path) return;
    const client = useSessionsStore.getState().client;
    if (!client) return;
    setInstalling(true);
    try {
      const res = await client.call("skills.install", { source: { kind: "folder", path } });
      const name = res.installed[0]?.name;
      useNotificationStore.getState().success(name ? `Installed ${name}` : "Installed skill");
      await load();
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to install skill"));
    } finally {
      setInstalling(false);
    }
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

  const allSkills = data?.skills ?? [];
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? allSkills.filter((s) =>
            `${s.name} ${s.description} ${s.filePath}`.toLowerCase().includes(q),
          )
        : allSkills,
    [allSkills, q],
  );

  const groups = [
    {
      key: "installed",
      label: "Installed",
      hint: "global",
      rows: filtered.filter((s) => s.scope !== "project"),
    },
    {
      key: "project",
      label: "Project",
      hint: "this repo",
      rows: filtered.filter((s) => s.scope === "project"),
    },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">Settings · Skills</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 className="pid-settings-section-title">Agent Skills</h1>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-3)",
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ color: "var(--accent)" }}>{allSkills.length}</span> installed
          </span>
        </div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 28,
              boxSizing: "border-box",
              padding: "0 10px",
              background: "var(--bg-1)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              color: "var(--ink-3)",
            }}
          >
            <Search size={13} aria-hidden />
            <input
              style={{
                flex: 1,
                alignSelf: "stretch",
                border: 0,
                outline: "none",
                background: "transparent",
                padding: 0,
                color: "var(--ink-0)",
                fontFamily: "var(--font-ui)",
                fontSize: "var(--t-13)",
              }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter skills…"
              spellCheck={false}
            />
            {query && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
                {filtered.length}
              </span>
            )}
          </div>
          <PidButton
            variant="primary"
            longLabel
            style={THIN_CTL}
            icon={<GitBranch size={12} aria-hidden />}
            onClick={() => setInstallOpen(true)}
          >
            Install from repo
          </PidButton>
          <PidButton
            longLabel
            style={THIN_CTL}
            icon={<FolderOpen size={12} aria-hidden />}
            disabled={installing}
            onClick={() => void installFromFolder()}
          >
            {installing ? "Installing…" : "From folder…"}
          </PidButton>
        </div>

        {!projectId ? (
          <div className="pid-list-empty" style={{ marginTop: 12 }}>
            Open a project to list its skills.
          </div>
        ) : (
          <div
            style={{
              marginTop: 12,
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              background: "var(--bg-1)",
              overflow: "hidden",
            }}
          >
            {groups.length === 0 ? (
              <div className="pid-list-empty" style={{ padding: "20px 14px" }}>
                {loading
                  ? "Scanning…"
                  : query
                    ? `No skills match “${query}”.`
                    : "No skills installed yet — install from a repo or a local folder."}
              </div>
            ) : (
              groups.map((g, gi) => (
                <div key={g.key}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      padding: "10px 14px 8px",
                      borderTop: gi === 0 ? "none" : "1px solid var(--line)",
                      borderBottom: "1px solid var(--line)",
                      background: "var(--bg-2)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span style={{ color: "var(--ink-1)" }}>{g.label}</span>
                    <span style={{ color: "var(--ink-3)" }}>· {g.hint}</span>
                    <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>
                      {g.rows.length}
                    </span>
                  </div>
                  {g.rows.map((skill) => (
                    <SkillRow key={skill.filePath} skill={skill} onUninstall={uninstall} />
                  ))}
                </div>
              ))
            )}
          </div>
        )}

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

      <InstallSkillsModal
        open={installOpen}
        onOpenChange={setInstallOpen}
        onInstalled={() => void load()}
      />
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
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 14,
        alignItems: "start",
        padding: "14px",
        borderTop: "1px solid var(--line)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <code style={{ color: "var(--ink-0)", fontSize: "var(--t-13)" }}>
            /skill:{skill.name}
          </code>
          {skill.disableModelInvocation ? <PidChip variant="info">manual only</PidChip> : null}
        </div>
        <div style={{ color: "var(--ink-2)", fontSize: "var(--t-12)", marginTop: 3 }}>
          {skill.description}
        </div>
        <div
          style={{
            color: "var(--ink-3)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.04em",
            marginTop: 3,
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
          style={THIN_CTL}
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
