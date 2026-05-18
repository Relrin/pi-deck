import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import {
  type FormEvent,
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Archive, Folder, Send, X } from "../../components/icons/index.js";
import { PidChipPicker, type PidChipPickerOption } from "../../components/picker/PidChipPicker.js";
import { isMacOs } from "../../lib/platform.js";
import { useNavStore } from "../../lib/useNavStore.js";
import { useToastStore } from "../_status/useToastStore.js";
import { useGitStore } from "../git/useGitStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { PidAgentModePicker } from "./PidAgentModePicker.js";
import { PidAttachmentsPicker } from "./PidAttachmentsPicker.js";
import { PidBranchPicker } from "./PidBranchPicker.js";
import { PidEffortPicker } from "./PidEffortPicker.js";
import { PidModelPicker } from "./PidModelPicker.js";
import { PidRepoFileSearchDialog } from "./PidRepoFileSearchDialog.js";
import { INTRO_TEMPLATES } from "./templates.js";
import { useIntroComposerStore } from "./useIntroComposerStore.js";
import { useRecentAttachmentsStore } from "./useRecentAttachmentsStore.js";

const RECENT_LIMIT = 3;

export function PidComposerScreen() {
  const text = useIntroComposerStore((s) => s.text);
  const setText = useIntroComposerStore((s) => s.setText);
  const clear = useIntroComposerStore((s) => s.clear);
  const pendingModelRef = useIntroComposerStore((s) => s.pendingModelRef);
  const pendingThinkingLevel = useIntroComposerStore((s) => s.pendingThinkingLevel);
  const agentMode = useIntroComposerStore((s) => s.agentMode);
  const attachments = useIntroComposerStore((s) => s.attachments);
  const addAttachments = useIntroComposerStore((s) => s.addAttachments);
  const removeAttachment = useIntroComposerStore((s) => s.removeAttachment);
  const pushRecent = useRecentAttachmentsStore((s) => s.push);

  const [repoSearchOpen, setRepoSearchOpen] = useState(false);

  const attachAndRemember = useCallback(
    (next: PromptAttachment[]) => {
      if (next.length === 0) return;
      addAttachments(next);
      for (const a of next) pushRecent(a);
    },
    [addAttachments, pushRecent],
  );

  const chooseFiles = useCallback(async () => {
    const picker = window.bridge?.openFiles;
    if (!picker) {
      useToastStore.getState().push("File picker unavailable in this build", "error");
      return;
    }
    const paths = await picker();
    if (paths.length === 0) return;
    attachAndRemember(paths.map((path) => ({ kind: "file" as const, path })));
  }, [attachAndRemember]);

  const chooseFolder = useCallback(async () => {
    const picker = window.bridge?.openDirectory;
    if (!picker) {
      useToastStore.getState().push("Folder picker unavailable in this build", "error");
      return;
    }
    const path = await picker();
    if (!path) return;
    attachAndRemember([{ kind: "folder", path }]);
  }, [attachAndRemember]);

  const openRepoSearch = useCallback(() => setRepoSearchOpen(true), []);

  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const setActiveProject = useProjectsStore((s) => s.setActive);
  const openProjectFromDialog = useProjectsStore((s) => s.openProjectFromDialog);
  const protocolClient = useSessionsStore((s) => s.client);

  const openAnotherFolder = useCallback(() => {
    if (!protocolClient) {
      useToastStore.getState().push("Host not connected", "error");
      return;
    }
    void openProjectFromDialog(protocolClient);
  }, [openProjectFromDialog, protocolClient]);

  const refreshGit = useGitStore((s) => s.refresh);

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

  // Keyboard shortcuts inside the composer textarea. Mirrors the kbd badges in the
  // attachments popover so the visual hint matches the actual binding on this platform.
  // `@` only fires at a word boundary so typing emails or mid-string `@` mentions still works.
  const onComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const mod = isMacOs() ? event.metaKey : event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && key === "o") {
      event.preventDefault();
      if (event.shiftKey) void chooseFolder();
      else void chooseFiles();
      return;
    }
    if (event.key === "@" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const target = event.currentTarget;
      const caret = target.selectionStart ?? 0;
      const prev = caret > 0 ? target.value[caret - 1] : "";
      const atBoundary = caret === 0 || !prev || /\s/.test(prev);
      if (atBoundary) {
        event.preventDefault();
        openRepoSearch();
      }
    }
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
            triggerLeading={<Archive size={12} aria-hidden />}
            ariaLabel="Select workspace"
            value={activeProjectId ?? ""}
            options={workspaceOptions}
            onChange={(id) => setActiveProject(id)}
            triggerLabel={activeProject?.displayName ?? "no project"}
            footerAction={{
              label: "Open another folder…",
              icon: "plus",
              onSelect: openAnotherFolder,
            }}
          />
          <PidBranchPicker projectId={activeProjectId} />
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
            onKeyDown={onComposerKeyDown}
          />
          <div className="pid-composer-row">
            <PidAgentModePicker />
            <PidAttachmentsPicker
              onChooseFiles={chooseFiles}
              onChooseFolder={chooseFolder}
              onOpenRepoSearch={openRepoSearch}
              onPickRecent={(a) => attachAndRemember([a])}
            />
            <span className="pid-composer-row-spacer" />
            <PidModelPicker />
            <PidEffortPicker />
            <button
              type="submit"
              className="pid-composer-send"
              disabled={!text.trim() || !activeProjectId}
            >
              <Send size={12} aria-hidden />
              <span>Send</span>
            </button>
          </div>
        </form>

        <div className="pid-composer-templates-wrap">
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
      {repoSearchOpen && (
        <PidRepoFileSearchDialog
          open={repoSearchOpen}
          onClose={() => setRepoSearchOpen(false)}
          onSelect={(picks) => {
            attachAndRemember(picks.map<PromptAttachment>((path) => ({ kind: "repo-ref", path })));
            setRepoSearchOpen(false);
          }}
        />
      )}
    </div>
  );
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
