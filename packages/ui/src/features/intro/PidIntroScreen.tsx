import { type FormEvent, type KeyboardEvent, useMemo } from "react";
import { PidButton } from "../../components/buttons/PidButton";
import { PidKbd } from "../../components/kbd/PidKbd";
import { Tooltip } from "../../components/ui/Tooltip";
import { useNavStore } from "../../lib/useNavStore";
import { useToastStore } from "../_status/useToastStore";
import { useProjectsStore } from "../sessions/useProjectsStore";
import { useSessionsStore } from "../sessions/useSessionsStore";
import { INTRO_TEMPLATES } from "./templates";
import { useIntroComposerStore } from "./useIntroComposerStore";

export interface PidIntroScreenProps {
  variant: "fullscreen" | "inline-empty-session";
}

const RECENT_LIMIT = 5;

export function PidIntroScreen({ variant }: PidIntroScreenProps) {
  const text = useIntroComposerStore((s) => s.text);
  const setText = useIntroComposerStore((s) => s.setText);
  const clear = useIntroComposerStore((s) => s.clear);
  const sessions = useSessionsStore((s) => s.sessions);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId));

  const recents = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
        .slice(0, RECENT_LIMIT),
    [sessions],
  );

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
      await store.createSession(activeProjectId);
      // createSession sets activeSessionId; sendPrompt picks it up.
      await useSessionsStore.getState().sendPrompt(trimmed);
      clear();
      useNavStore.getState().goToSession();
    } catch {
      // Toast already surfaced by the store; nothing else to do here.
    }
  };

  const onTemplate = (body: string) => {
    setText(body);
  };

  // Enter submits the prompt; Shift/Ctrl/Cmd+Enter falls through to the textarea's default
  // newline-insertion behaviour. Mirrors MessageInput (SESSION tab) and PidComposerScreen
  // (BLANK tab) so the keyboard contract is identical across every composer in the app.
  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const onRecent = (sessionId: string) => {
    useSessionsStore
      .getState()
      .activateSession(sessionId)
      .catch(() => {});
    useNavStore.getState().goToSession();
  };

  const projectKicker = activeProject
    ? `${activeProject.displayName.toUpperCase()} · IDLE`
    : "PI-DECK · IDLE";

  return (
    <div className="pid-intro" data-variant={variant}>
      <header className="pid-intro-hero">
        <div className="pid-intro-kicker">
          <span className="pid-intro-mark" aria-hidden>
            π
          </span>
          <span>{projectKicker}</span>
        </div>
        <h1 className="pid-intro-title">what are we shipping today?</h1>
        <p className="pid-intro-blurb">
          Drop a task, paste a stack trace, or @-mention a file. pi reads your repo, proposes a
          plan, and writes code against a fresh branch.
        </p>
      </header>

      <form className="pid-intro-composer" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="pid-intro-composer-input">
          New prompt
        </label>
        <textarea
          id="pid-intro-composer-input"
          placeholder="e.g. 'add a /share button to PostHeader that copies a tracked URL'"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onComposerKeyDown}
        />
        <div className="pid-intro-composer-footer">
          <span aria-hidden>
            {activeProject ? `${activeProject.displayName} · main` : "no project · main"}
          </span>
          <Tooltip content="Dispatch · Enter" side="top">
            <PidButton
              type="submit"
              variant="primary"
              disabled={!text.trim() || !activeProjectId}
              longLabel
              aria-label="Dispatch prompt"
              aria-keyshortcuts="Enter"
            >
              Dispatch
            </PidButton>
          </Tooltip>
        </div>
      </form>

      <div>
        <div className="pid-intro-templates-label">start from a template</div>
        <div className="pid-intro-templates">
          {INTRO_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="pid-card"
              onClick={() => onTemplate(template.body)}
            >
              <span className="pid-intro-template-num">{template.num}</span>
              <span className="pid-intro-template-title">{template.title}</span>
              <span className="pid-intro-template-blurb">{template.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pid-intro-recent">
        <span className="pid-intro-recent-label">recent</span>
        {recents.length === 0 ? (
          <span aria-hidden>—</span>
        ) : (
          recents.map((session) => (
            <button
              key={session.id}
              type="button"
              className="pid-intro-recent-item"
              onClick={() => onRecent(session.id)}
              title={session.title}
            >
              {session.title}
            </button>
          ))
        )}
      </div>

      {variant === "fullscreen" && (
        <div className="pid-intro-shortcut">
          <span>or</span>
          <PidKbd keys={["Mod", "N"]} />
          <span>new session</span>
        </div>
      )}
    </div>
  );
}
