import type { CommandResponse } from "@pi-deck/core/protocol/commands.js";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Check, GitBranch, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { humanizeError } from "../../../lib/format/humanize-error.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore";

type ScanData = CommandResponse<"skills.scan">;
type ScannedSkill = ScanData["skills"][number];

type Phase = "idle" | "scanning" | "scanned" | "error" | "installing";

const SAMPLE_REPOS: { label: string; url: string }[] = [
  { label: "anthropics/skills", url: "https://github.com/anthropics/skills" },
  { label: "mattpocock/skills", url: "https://github.com/mattpocock/skills" },
];

const THIN_CTL = {
  height: 28,
  paddingTop: 0,
  paddingBottom: 0,
  boxSizing: "border-box",
} as const;

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Called after a successful install so the parent can refresh its skill list. */
  onInstalled: () => void;
}

/**
 * Settings → Skills → Install from repository. Point it at a git repo, it shallow-clones and
 * lists the skills it finds (host-side `skills.scan`), then installs just the selected subset
 * (`skills.install` with `kind:"scan"`). The clone is cleaned up host-side after install.
 */
export function InstallSkillsModal({ open, onOpenChange, onInstalled }: Props) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [scan, setScan] = useState<ScanData | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [log, setLog] = useState<string[]>([]);
  const logTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of logTimers.current) clearTimeout(t);
    logTimers.current = [];
  }, []);

  // Reset everything each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setUrl("");
    setPhase("idle");
    setScan(null);
    setPicked(new Set());
    setLog([]);
    return clearTimers;
  }, [open, clearTimers]);

  const installable = useMemo(
    () => (scan ? scan.skills.filter((s) => !s.alreadyInstalled) : []),
    [scan],
  );
  const allPicked = installable.length > 0 && installable.every((s) => picked.has(s.id));

  const scanRepo = async () => {
    const target = url.trim();
    if (!target) {
      setPhase("error");
      return;
    }
    const client = useSessionsStore.getState().client;
    if (!client) {
      setPhase("error");
      return;
    }
    setPhase("scanning");
    setScan(null);
    setPicked(new Set());
    // A lightweight progress trail while the single round-trip runs (no event stream yet).
    clearTimers();
    setLog([`$ git clone --depth 1 ${target}`]);
    logTimers.current.push(
      setTimeout(() => setLog((l) => [...l, "Cloning repository…"]), 220),
      setTimeout(() => setLog((l) => [...l, "Scanning tree for SKILL.md manifests…"]), 560),
    );
    try {
      const result = await client.call("skills.scan", { url: target });
      clearTimers();
      setScan(result);
      setLog((l) => [
        ...l,
        `found ${result.skills.length} SKILL.md manifest${result.skills.length === 1 ? "" : "s"}`,
        `${result.repo.branch || "HEAD"} · ${result.repo.commit || "—"}`,
      ]);
      // Default to every installable skill selected; the user can pare it down.
      setPicked(new Set(result.skills.filter((s) => !s.alreadyInstalled).map((s) => s.id)));
      setPhase("scanned");
    } catch (err) {
      clearTimers();
      setLog([]);
      setPhase("error");
      useNotificationStore.getState().error(humanizeError(err, "Failed to scan repository"));
    }
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setAll = (on: boolean) => setPicked(on ? new Set(installable.map((s) => s.id)) : new Set());

  const install = async () => {
    if (!scan || picked.size === 0) return;
    const client = useSessionsStore.getState().client;
    if (!client) return;
    setPhase("installing");
    try {
      const res = await client.call("skills.install", {
        source: { kind: "scan", scanId: scan.scanId, skillIds: [...picked] },
      });
      if (res.installed.length === 0) {
        useNotificationStore.getState().info("Nothing installed", {
          body: "Every selected skill was already installed.",
        });
      } else {
        const skippedNote =
          res.skipped.length > 0 ? ` · ${res.skipped.length} already installed` : "";
        useNotificationStore.getState().push({
          kind: "success",
          tag: "SKILLS",
          title: `Installed ${res.installed.length} skill${res.installed.length === 1 ? "" : "s"}`,
          body: res.installed.map((s) => s.name).join(" · "),
          meta: `${scan.repo.slug} @ ${scan.repo.commit || "—"}${skippedNote}`,
          durationMs: 6000,
        });
      }
      onInstalled();
      onOpenChange(false);
    } catch (err) {
      setPhase("scanned");
      useNotificationStore.getState().error(humanizeError(err, "Failed to install skills"));
    }
  };

  const installing = phase === "installing";

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="pid-modal-backdrop" />
        <RadixDialog.Content
          className="pid-modal"
          style={{ width: "min(720px, 92vw)", maxHeight: "min(80vh, 640px)" }}
        >
          {/* Header */}
          <div className="pid-modal-header">
            <div>
              <div className="pid-settings-section-kicker">skills · install from git</div>
              <RadixDialog.Title className="pid-modal-title">
                Install from repository
              </RadixDialog.Title>
            </div>
            <RadixDialog.Description className="pid-modal-description">
              Clone a repository, review the skills it contains, and install the ones you pick.
            </RadixDialog.Description>
            <PidButton
              variant="ghost"
              style={THIN_CTL}
              icon={<X size={12} aria-hidden />}
              onClick={() => onOpenChange(false)}
            >
              esc
            </PidButton>
          </div>

          {/* URL bar */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--line)",
              background: "var(--bg-0)",
            }}
          >
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
                  color: "var(--ink-2)",
                }}
              >
                <GitBranch size={13} aria-hidden />
                <input
                  // biome-ignore lint/a11y/noAutofocus: focusing the URL field is the point of the modal
                  autoFocus
                  style={{
                    flex: 1,
                    alignSelf: "stretch",
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    padding: 0,
                    color: "var(--ink-0)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                  }}
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (phase === "error") setPhase("idle");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void scanRepo();
                  }}
                  placeholder="github.com/owner/repo  ·  or  git@github.com:owner/repo.git"
                  spellCheck={false}
                />
              </div>
              <PidButton
                variant="primary"
                longLabel
                style={THIN_CTL}
                icon={<Search size={12} aria-hidden />}
                disabled={phase === "scanning" || !url.trim()}
                onClick={() => void scanRepo()}
              >
                {phase === "scanning" ? "Scanning…" : "Scan"}
              </PidButton>
            </div>

            {phase === "idle" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 10,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}
                >
                  try:
                </span>
                {SAMPLE_REPOS.map((r) => (
                  <button
                    key={r.url}
                    type="button"
                    onClick={() => setUrl(r.url)}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--ink-2)",
                      background: "transparent",
                      border: 0,
                      padding: "2px 6px",
                      cursor: "pointer",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
            {phase === "error" && (
              <div className="pid-form-hint" style={{ marginTop: 10, color: "var(--del)" }}>
                Enter a valid git repository URL (owner/repo).
              </div>
            )}
          </div>

          {/* Body */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {log.length > 0 && (
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: phase === "scanned" ? "1px solid var(--line)" : "none",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  background: "var(--bg-0)",
                }}
              >
                {log.map((line, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: log lines are append-only
                    key={i}
                    style={{
                      color: line.startsWith("$") ? "var(--ink-1)" : "var(--ink-3)",
                      lineHeight: 1.7,
                    }}
                  >
                    {!line.startsWith("$") && (
                      <span style={{ color: "var(--add)", marginRight: 6 }}>✓</span>
                    )}
                    {line}
                  </div>
                ))}
                {phase === "scanning" && (
                  <div style={{ color: "var(--accent)", lineHeight: 1.7 }}>▍</div>
                )}
              </div>
            )}

            {phase === "scanned" && scan && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--line)",
                    background: "var(--bg-2)",
                  }}
                >
                  <span style={{ fontSize: "var(--t-13)", color: "var(--ink-0)", fontWeight: 500 }}>
                    {scan.repo.slug}
                  </span>
                  <span
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}
                  >
                    {scan.skills.length} skill{scan.skills.length === 1 ? "" : "s"} found
                  </span>
                  <span style={{ flex: 1 }} />
                  <PidButton
                    variant="ghost"
                    style={THIN_CTL}
                    disabled={installable.length === 0}
                    onClick={() => setAll(!allPicked)}
                  >
                    {allPicked ? "Select none" : "Select all"}
                  </PidButton>
                </div>

                {scan.skills.length === 0 ? (
                  <div className="pid-list-empty" style={{ padding: "24px 16px" }}>
                    No SKILL.md manifests found in this repository.
                  </div>
                ) : (
                  scan.skills.map((skill) => (
                    <SkillRow
                      key={skill.id}
                      skill={skill}
                      checked={picked.has(skill.id)}
                      onToggle={() => !skill.alreadyInstalled && toggle(skill.id)}
                    />
                  ))
                )}
              </>
            )}

            {phase === "idle" && (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "var(--ink-3)",
                  fontSize: "var(--t-13)",
                }}
              >
                <div style={{ marginBottom: 6, color: "var(--ink-2)" }}>
                  Point pi at any repository that contains{" "}
                  <code style={{ color: "var(--ink-1)" }}>SKILL.md</code> manifests.
                </div>
                <div style={{ fontSize: "var(--t-12)" }}>
                  It clones shallowly, lists the skills it finds, and installs just the ones you
                  want.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid var(--line)",
              background: "var(--bg-0)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
              {phase === "scanned" ? (
                <>
                  <span style={{ color: picked.size ? "var(--accent)" : "var(--ink-3)" }}>
                    {picked.size}
                  </span>{" "}
                  of {installable.length} selected
                </>
              ) : (
                "No repository scanned yet"
              )}
            </span>
            <span style={{ flex: 1 }} />
            <PidButton
              variant="ghost"
              longLabel
              style={THIN_CTL}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </PidButton>
            <PidButton
              variant="primary"
              longLabel
              style={THIN_CTL}
              icon={<Plus size={12} aria-hidden />}
              disabled={phase !== "scanned" || picked.size === 0 || installing}
              onClick={() => void install()}
            >
              {installing
                ? "Installing…"
                : `Install${picked.size > 0 ? ` ${picked.size}` : ""} selected`}
            </PidButton>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function SkillRow({
  skill,
  checked,
  onToggle,
}: {
  skill: ScannedSkill;
  checked: boolean;
  onToggle: () => void;
}) {
  const already = skill.alreadyInstalled;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={already}
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr auto",
        gap: 12,
        alignItems: "start",
        width: "100%",
        textAlign: "left",
        padding: "12px 16px",
        border: 0,
        borderBottom: "1px solid var(--line)",
        cursor: already ? "default" : "pointer",
        opacity: already ? 0.55 : 1,
        background: checked ? "var(--accent-soft)" : "transparent",
        font: "inherit",
        color: "inherit",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          marginTop: 2,
          borderRadius: 4,
          border: `1px solid ${checked || already ? "var(--accent)" : "var(--line-strong)"}`,
          background: checked || already ? "var(--accent)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent-ink)",
        }}
      >
        {(checked || already) && <Check size={10} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--t-13)", fontWeight: 500, color: "var(--ink-0)" }}>
            {skill.name}
          </span>
          {already && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
              · already installed
            </span>
          )}
        </span>
        <span
          style={{
            display: "block",
            fontSize: "var(--t-12)",
            color: "var(--ink-2)",
            lineHeight: 1.5,
            marginTop: 3,
          }}
        >
          {skill.description}
        </span>
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--ink-3)",
          whiteSpace: "nowrap",
          paddingTop: 3,
        }}
      >
        {skill.id}
      </span>
    </button>
  );
}
