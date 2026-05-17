import { type FormEvent, Fragment, useEffect, useMemo } from "react";
import { Glyph } from "../../components/glyph/index.js";
import { Folder, X } from "../../components/icons/index.js";
import { PidChipPicker, type PidChipPickerOption } from "../../components/picker/PidChipPicker.js";
import { useNavStore } from "../../lib/useNavStore.js";
import { useToastStore } from "../_status/useToastStore.js";
import { useGitStore } from "../git/useGitStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { PidAgentModePicker } from "./PidAgentModePicker.js";
import { PidAttachmentsPicker } from "./PidAttachmentsPicker.js";
import { PidEffortPicker } from "./PidEffortPicker.js";
import { PidModelPicker } from "./PidModelPicker.js";
import { INTRO_TEMPLATES } from "./templates.js";
import { useIntroComposerStore } from "./useIntroComposerStore.js";

const RECENT_LIMIT = 3;

export function PidComposerScreen() {
  const text = useIntroComposerStore((s) => s.text);
  const setText = useIntroComposerStore((s) => s.setText);
  const clear = useIntroComposerStore((s) => s.clear);
  const pendingModelRef = useIntroComposerStore((s) => s.pendingModelRef);
  const pendingThinkingLevel = useIntroComposerStore((s) => s.pendingThinkingLevel);
  const agentMode = useIntroComposerStore((s) => s.agentMode);
  const attachments = useIntroComposerStore((s) => s.attachments);
  const removeAttachment = useIntroComposerStore((s) => s.removeAttachment);

  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const setActiveProject = useProjectsStore((s) => s.setActive);

  const branches = useGitStore((s) =>
    activeProjectId ? s.branchesByProject[activeProjectId] : undefined,
  );
  const currentBranch = useGitStore((s) =>
    activeProjectId ? s.currentBranchByProject[activeProjectId] : undefined,
  );
  const refreshGit = useGitStore((s) => s.refresh);
  const checkoutBranch = useGitStore((s) => s.checkout);

  const sessions = useSessionsStore((s) => s.sessions);

  useEffect(() => {
    if (!activeProjectId) return;
    void refreshGit(activeProjectId);
  }, [activeProjectId, refreshGit]);

  const recents = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
        .slice(0, RECENT_LIMIT),
    [sessions],
  );

  const workspaceOptions: PidChipPickerOption[] = useMemo(
    () =>
      projects.map((p) => ({
        value: p.id,
        label: p.displayName,
        sub: p.path,
      })),
    [projects],
  );

  const branchOptions: PidChipPickerOption[] = useMemo(() => {
    if (!branches || branches.length === 0) {
      return currentBranch ? [{ value: currentBranch, label: currentBranch, sub: "current" }] : [];
    }
    return branches.map((b) => ({
      value: b.name,
      label: b.name,
      sub: b.isCurrent ? "current" : formatRelative(b.lastActivityAt),
    }));
  }, [branches, currentBranch]);

  const projectKicker = activeProject
    ? `${activeProject.displayName.toUpperCase()} · IDLE`
    : "PI-DECK · IDLE";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!activeProjectId) {
      useToastStore.getState().push("Open a project first", "error");
      return;
    }
    const store = useSessionsStore.getState();
    try {
      await store.createSession(activeProjectId, {
        modelRef: pendingModelRef,
        thinkingLevel: pendingThinkingLevel,
        agentMode,
      });
      await useSessionsStore.getState().sendPrompt(trimmed, {
        agentMode,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      clear();
      useNavStore.getState().goToSession();
    } catch {
      // Toast already surfaced by the store.
    }
  };

  const onTemplate = (body: string) => setText(body);

  const onRecent = (sessionId: string) => {
    useSessionsStore
      .getState()
      .activateSession(sessionId)
      .catch(() => {});
    useNavStore.getState().goToSession();
  };

  const onBranchChange = (name: string) => {
    if (!activeProjectId || name === currentBranch) return;
    void checkoutBranch(activeProjectId, name);
  };

  return (
    <div className="pid-composer-screen">
      <div className="pid-composer-screen-inner">
        <header className="pid-composer-hero">
          <div className="pid-composer-hero-mark-row">
            <span className="pid-composer-hero-mark" aria-hidden>
              π
            </span>
            <span className="pid-composer-hero-kicker">{projectKicker}</span>
          </div>
          <h1 className="pid-composer-hero-title">What are we shipping today?</h1>
          <p className="pid-composer-hero-blurb">
            Drop a task, paste a stack trace, or @-mention a file. pi reads your repo, proposes a
            plan, and writes code against a fresh branch.
          </p>
        </header>

        <div className="pid-composer-chip-row">
          <PidChipPicker
            icon="folder"
            ariaLabel="Select workspace"
            value={activeProjectId ?? ""}
            options={workspaceOptions}
            onChange={(id) => setActiveProject(id)}
            triggerLabel={activeProject?.displayName ?? "no project"}
          />
          <PidChipPicker
            icon="branch"
            ariaLabel="Select branch"
            value={currentBranch ?? ""}
            options={branchOptions}
            onChange={onBranchChange}
            triggerLabel={currentBranch || "—"}
            disabled={!activeProjectId || branchOptions.length === 0}
          />
        </div>

        <form className="pid-composer-shell" onSubmit={onSubmit}>
          {attachments.length > 0 && (
            <div className="pid-composer-attachments">
              {attachments.map((a) => (
                <span key={`${a.kind}|${a.path}`} className="pid-composer-attachment">
                  {a.kind === "folder" ? <Folder size={11} /> : null}
                  <span className="pid-composer-attachment-path" title={a.path}>
                    {basename(a.path)}
                  </span>
                  <button
                    type="button"
                    className="pid-composer-attachment-remove"
                    onClick={() => removeAttachment(a.path)}
                    aria-label={`Remove ${a.path}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <label className="sr-only" htmlFor="pid-composer-input">
            New prompt
          </label>
          <textarea
            id="pid-composer-input"
            className="pid-composer-input"
            placeholder="e.g. 'add a /share button to PostHeader that copies a tracked URL'"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="pid-composer-row">
            <PidAgentModePicker />
            <PidAttachmentsPicker />
            <span className="pid-composer-row-spacer" />
            <PidModelPicker />
            <PidEffortPicker />
            <button
              type="submit"
              className="pid-composer-send"
              disabled={!text.trim() || !activeProjectId}
            >
              <Glyph kind="send" size={12} />
              <span>Send</span>
            </button>
          </div>
        </form>

        <div>
          <div className="pid-composer-templates-label">start from a template</div>
          <div className="pid-composer-templates">
            {INTRO_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className="pid-composer-template"
                onClick={() => onTemplate(template.body)}
              >
                <span className="pid-composer-template-num">{template.num}</span>
                <span className="pid-composer-template-title">{template.title}</span>
                <span className="pid-composer-template-blurb">{template.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        {recents.length > 0 && (
          <div className="pid-composer-recent">
            <span className="pid-composer-recent-label">recent</span>
            {recents.map((session, ix) => (
              <Fragment key={session.id}>
                {ix > 0 && <span className="pid-composer-recent-sep">·</span>}
                <button
                  type="button"
                  className="pid-composer-recent-item"
                  onClick={() => onRecent(session.id)}
                  title={session.title}
                >
                  {session.title}
                </button>
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

function formatRelative(iso?: string): string | undefined {
  if (!iso) return undefined;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return undefined;
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
