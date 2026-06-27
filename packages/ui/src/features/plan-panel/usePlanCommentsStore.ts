import { create } from "zustand";

/**
 * A review comment on a plan card. Anchored by character offsets into the card body's
 * rendered `textContent` (see `planCommentAnchor`) so the highlight survives React
 * re-renders. `quote` is the selected text - both what we re-highlight and what
 * we send to the agent as a blockquote.
 */
export interface PlanComment {
  id: string;
  /** The plan-card assistant message this comment is anchored to. */
  messageId: string;
  quote: string;
  start: number;
  end: number;
  reply: string;
}

/** A selection captured from the context menu, awaiting the user's reply text. */
export interface PlanDraft {
  messageId: string;
  quote: string;
  start: number;
  end: number;
}

interface PlanCommentsSession {
  comments: PlanComment[];
  draft: PlanDraft | null;
}

interface PlanCommentsStoreState {
  bySession: Record<string, PlanCommentsSession>;
  /** Capture a selection as the active draft (replaces any in-progress draft). */
  startDraft: (sessionId: string, draft: PlanDraft) => void;
  /** Discard the active draft without adding a comment. */
  cancelDraft: (sessionId: string) => void;
  /** Promote the active draft into a pending comment with the given reply text. No-op on a
   *  blank reply or when there is no draft. */
  addComment: (sessionId: string, reply: string) => void;
  /** Edit an existing pending comment's reply text. */
  updateComment: (sessionId: string, id: string, reply: string) => void;
  /** Drop a pending comment. */
  removeComment: (sessionId: string, id: string) => void;
  /** Drop everything for a session (after a successful submit, or on session delete). */
  clearSession: (sessionId: string) => void;
}

const emptySessionState = (): PlanCommentsSession => ({ comments: [], draft: null });

/** Monotonic id source — unique within an app run, stable enough for React keys + tests. */
let seq = 0;
const nextId = (): string => `pc-${++seq}`;

export const usePlanCommentsStore = create<PlanCommentsStoreState>((set) => ({
  bySession: {},

  startDraft: (sessionId, draft) =>
    set((state) => ({
      bySession: {
        ...state.bySession,
        [sessionId]: { ...(state.bySession[sessionId] ?? emptySessionState()), draft },
      },
    })),

  cancelDraft: (sessionId) =>
    set((state) => {
      const prev = state.bySession[sessionId];
      if (!prev?.draft) return state;
      return { bySession: { ...state.bySession, [sessionId]: { ...prev, draft: null } } };
    }),

  addComment: (sessionId, reply) =>
    set((state) => {
      const prev = state.bySession[sessionId] ?? emptySessionState();
      const trimmed = reply.trim();
      if (!prev.draft || !trimmed) return state;
      const comment: PlanComment = { ...prev.draft, id: nextId(), reply: trimmed };
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { comments: [...prev.comments, comment], draft: null },
        },
      };
    }),

  updateComment: (sessionId, id, reply) =>
    set((state) => {
      const prev = state.bySession[sessionId];
      if (!prev) return state;
      const trimmed = reply.trim();
      if (!trimmed) return state;
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: {
            ...prev,
            comments: prev.comments.map((c) => (c.id === id ? { ...c, reply: trimmed } : c)),
          },
        },
      };
    }),

  removeComment: (sessionId, id) =>
    set((state) => {
      const prev = state.bySession[sessionId];
      if (!prev) return state;
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { ...prev, comments: prev.comments.filter((c) => c.id !== id) },
        },
      };
    }),

  clearSession: (sessionId) =>
    set((state) => {
      if (!state.bySession[sessionId]) return state;
      const next = { ...state.bySession };
      delete next[sessionId];
      return { bySession: next };
    }),
}));

/** Stable empty so selectors don't churn for sessions with no comments yet. */
const EMPTY_STATE: PlanCommentsSession = Object.freeze(emptySessionState());

export function selectPlanComments(sessionId: string | undefined) {
  return (state: PlanCommentsStoreState): PlanCommentsSession =>
    sessionId ? (state.bySession[sessionId] ?? EMPTY_STATE) : EMPTY_STATE;
}

/**
 * Build the single plan-mode reply we send when the user clicks "Request changes": a short
 * lead-in, then each comment as a `> quote` blockquote followed by its reply, separated by a
 * horizontal rule, and a closing instruction to keep revising in plan mode. The agent's
 * plan-mode prompt already overwrites the plan file on feedback, so this drives a revision.
 */
export function composeCommentsMessage(comments: PlanComment[]): string {
  const blocks = comments.map((c) => {
    const quoted = c.quote
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    return `${quoted}\n\n${c.reply.trim()}`;
  });
  return [
    "I have some feedback on the plan before approving:",
    "",
    blocks.join("\n\n---\n\n"),
    "",
    "Please revise the plan accordingly and keep it in plan mode.",
  ].join("\n");
}
