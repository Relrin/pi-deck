import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { MessageSquare, Pencil, Trash2 } from "../../../components/icons/index.js";
import { offsetsToRange } from "../../plan-panel/planCommentAnchor.js";
import {
  type PlanComment,
  selectPlanComments,
  usePlanCommentsStore,
} from "../../plan-panel/usePlanCommentsStore.js";

/**
 * CSS Custom Highlight API shims. The API is present in Electron's Chromium but its types may
 * lag in the TS DOM lib, and it's absent under jsdom - so we feature-detect and degrade to "no
 * highlight" (comments still function) rather than depend on the global types.
 */
type HighlightCtor = new (...ranges: Range[]) => unknown;
interface HighlightRegistry {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
}
function highlightRegistry(): HighlightRegistry | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  return css?.highlights ?? null;
}
function highlightCtor(): HighlightCtor | null {
  return (globalThis as { Highlight?: HighlightCtor }).Highlight ?? null;
}

export interface PlanCommentLayerProps {
  sessionId: string;
  /** The plan-card assistant message these comments anchor to. */
  messageId: string;
  /** The plan card body element — the offset/highlight root (`[data-plan-card-body]`). */
  bodyRef: RefObject<HTMLDivElement | null>;
}

/**
 * The review-comment surface for a plan card: paints highlights over commented/draft text via
 * the CSS Custom Highlight API, floats an inline composer next to the active selection, and
 * lists the pending comments above the card footer. Pure view over `usePlanCommentsStore` -
 * submission lives in the footer's "Request changes" button (`PlanCard`).
 */
export function PlanCommentLayer({ sessionId, messageId, bodyRef }: PlanCommentLayerProps) {
  const session = usePlanCommentsStore(selectPlanComments(sessionId));
  const addComment = usePlanCommentsStore((s) => s.addComment);
  const cancelDraft = usePlanCommentsStore((s) => s.cancelDraft);
  const updateComment = usePlanCommentsStore((s) => s.updateComment);
  const removeComment = usePlanCommentsStore((s) => s.removeComment);

  const comments = session.comments.filter((c) => c.messageId === messageId);
  const draft = session.draft && session.draft.messageId === messageId ? session.draft : null;

  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Paint highlights for every pending comment + the active draft. Re-runs whenever the set of
  // comments or the draft changes; cleans the registry on unmount so a superseded card leaves
  // no stray highlight.
  useLayoutEffect(() => {
    const registry = highlightRegistry();
    const Ctor = highlightCtor();
    const root = bodyRef.current;
    if (!registry || !Ctor || !root) return;

    const commentRanges = session.comments
      .filter((c) => c.messageId === messageId)
      .map((c) => offsetsToRange(root, c.start, c.end))
      .filter((r): r is Range => r !== null);
    if (commentRanges.length) registry.set("pid-plan-comment", new Ctor(...commentRanges));
    else registry.delete("pid-plan-comment");

    const activeDraft =
      session.draft && session.draft.messageId === messageId ? session.draft : null;
    const draftRange = activeDraft
      ? offsetsToRange(root, activeDraft.start, activeDraft.end)
      : null;
    if (draftRange) registry.set("pid-plan-comment-draft", new Ctor(draftRange));
    else registry.delete("pid-plan-comment-draft");

    return () => {
      registry.delete("pid-plan-comment");
      registry.delete("pid-plan-comment-draft");
    };
  }, [session.comments, session.draft, messageId, bodyRef]);

  // Anchor the floating composer just below the selection, in card-relative coordinates (the
  // card is `position: relative`, so the absolutely-positioned composer scrolls with it).
  useLayoutEffect(() => {
    const activeDraft =
      session.draft && session.draft.messageId === messageId ? session.draft : null;
    if (!activeDraft) {
      setPos(null);
      return;
    }
    const root = bodyRef.current;
    const card = root?.closest(".pid-plan-card") as HTMLElement | null;
    if (!root || !card) return;
    const range = offsetsToRange(root, activeDraft.start, activeDraft.end);
    if (!range) return;
    const rangeRect = range.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    setPos({
      top: rangeRect.bottom - cardRect.top + 6,
      left: Math.max(0, rangeRect.left - cardRect.left),
    });
  }, [session.draft, messageId, bodyRef]);

  return (
    <>
      {draft && (
        <DraftComposer
          key={`${draft.start}-${draft.end}`}
          quote={draft.quote}
          pos={pos}
          onSubmit={(reply) => addComment(sessionId, reply)}
          onCancel={() => cancelDraft(sessionId)}
        />
      )}
      {comments.length > 0 && (
        <div className="pid-plan-comments">
          <div className="pid-plan-comments-header">
            <MessageSquare size={11} aria-hidden />
            <span>{comments.length === 1 ? "1 comment" : `${comments.length} comments`}</span>
          </div>
          {comments.map((c) => (
            <PendingComment
              key={c.id}
              comment={c}
              onUpdate={(reply) => updateComment(sessionId, c.id, reply)}
              onRemove={() => removeComment(sessionId, c.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/** Inline composer floated next to a fresh selection. Enter adds, Esc cancels. */
function DraftComposer({
  quote,
  pos,
  onSubmit,
  onCancel,
}: {
  quote: string;
  pos: { top: number; left: number } | null;
  onSubmit: (reply: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = () => {
    const trimmed = text.trim();
    if (trimmed) onSubmit(trimmed);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="pid-plan-comment-composer" style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}>
      <blockquote className="pid-plan-comment-quote">{quote}</blockquote>
      <textarea
        ref={ref}
        className="pid-plan-comment-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Add a comment…  Enter to add · Esc to cancel"
        aria-label="Comment on the selected plan text"
        rows={2}
      />
      <div className="pid-plan-comment-actions">
        <button type="button" className="pid-plan-comment-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="pid-plan-comment-btn pid-plan-comment-btn-primary"
          onClick={submit}
          disabled={!text.trim()}
        >
          Comment
        </button>
      </div>
    </div>
  );
}

/** One pending comment in the stack: the quoted plan text + the user's note, editable/removable. */
function PendingComment({
  comment,
  onUpdate,
  onRemove,
}: {
  comment: PlanComment;
  onUpdate: (reply: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.reply);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onUpdate(trimmed);
    setEditing(false);
  };
  const cancel = () => {
    setText(comment.reply);
    setEditing(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <div className="pid-plan-comment">
      <blockquote className="pid-plan-comment-quote">{comment.quote}</blockquote>
      {editing ? (
        <>
          <textarea
            ref={ref}
            className="pid-plan-comment-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Edit comment"
            rows={2}
          />
          <div className="pid-plan-comment-actions">
            <button type="button" className="pid-plan-comment-btn" onClick={cancel}>
              Cancel
            </button>
            <button
              type="button"
              className="pid-plan-comment-btn pid-plan-comment-btn-primary"
              onClick={save}
              disabled={!text.trim()}
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <div className="pid-plan-comment-body">
          <p className="pid-plan-comment-reply">{comment.reply}</p>
          <div className="pid-plan-comment-tools">
            <button
              type="button"
              className="pid-plan-comment-icon"
              aria-label="Edit comment"
              onClick={() => setEditing(true)}
            >
              <Pencil size={12} aria-hidden />
            </button>
            <button
              type="button"
              className="pid-plan-comment-icon"
              aria-label="Delete comment"
              onClick={onRemove}
            >
              <Trash2 size={12} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
