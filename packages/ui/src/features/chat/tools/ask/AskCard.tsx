import type { AskUserQuestion } from "@pi-deck/core/protocol/events.js";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { PidButton } from "../../../../components/buttons/PidButton.js";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Plus,
  Send,
  X,
} from "../../../../components/icons/index.js";
import { PidKbd } from "../../../../components/kbd/PidKbd.js";
import { cn } from "../../../../lib/cn.js";
import { humanizeError } from "../../../../lib/format/humanize-error.js";
import { useNotificationStore } from "../../../_status/useNotificationStore.js";
import { useSessionsStore } from "../../../sessions/useSessionsStore.js";
import { Markdown } from "../../messages/Markdown.js";
import type { ToolCallEntry } from "../../types.js";
import {
  type AskDraft,
  allowsCustom,
  buildAnswer,
  canSubmit as draftCanSubmit,
  initialDraft,
  isQuestionComplete,
  pickLayout,
} from "./askLayout.js";

/**
 * Inline "pi is asking" card rendered in place of the generic tool card for `ask_user_question`
 * calls (see AssistantMessage). While the question is pending it presents one of four layouts —
 * option cards, multi-select, split preview, or multi-question tabs - derived from the payload
 * shape; once answered it collapses to a compact summary of what the user chose.
 */
export function AskCard({ call, sessionId }: { call: ToolCallEntry; sessionId: string }) {
  if (call.pendingAsk) {
    return (
      <AskInteractive
        key={call.pendingAsk.askId}
        sessionId={sessionId}
        askId={call.pendingAsk.askId}
        questions={call.pendingAsk.questions}
      />
    );
  }
  return <AskResolved call={call} />;
}

/* ──────────────────────────── interactive ──────────────────────────── */

function AskInteractive({
  sessionId,
  askId,
  questions,
}: {
  sessionId: string;
  askId: string;
  questions: AskUserQuestion[];
}) {
  const client = useSessionsStore((s) => s.client);
  const notify = useNotificationStore((s) => s.error);
  const layout = useMemo(() => pickLayout(questions), [questions]);
  const [draft, setDraft] = useState<AskDraft>(() => initialDraft(questions, layout));
  const [activeTab, setActiveTab] = useState(0);
  const [busy, setBusy] = useState(false);

  const cardCanSubmit = draftCanSubmit(questions, draft, layout) && !busy;

  const advanceTab = useCallback(
    (from: number) => setActiveTab(Math.min(from + 1, questions.length)),
    [questions.length],
  );

  const chooseSingle = useCallback(
    (qi: number, idx: number) => {
      setDraft((prev) =>
        prev.map((it, i) =>
          i === qi ? { ...it, optionIndices: [idx], customActive: false, skipped: false } : it,
        ),
      );
      if (layout === "tabs") advanceTab(qi);
    },
    [layout, advanceTab],
  );

  const chooseCustom = useCallback((qi: number) => {
    setDraft((prev) =>
      prev.map((it, i) =>
        i === qi ? { ...it, optionIndices: [], customActive: true, skipped: false } : it,
      ),
    );
  }, []);

  const setCustomText = useCallback((qi: number, text: string) => {
    setDraft((prev) => prev.map((it, i) => (i === qi ? { ...it, custom: text } : it)));
  }, []);

  const closeCustom = useCallback((qi: number) => {
    setDraft((prev) =>
      prev.map((it, i) => (i === qi ? { ...it, customActive: false, optionIndices: [0] } : it)),
    );
  }, []);

  const toggleMulti = useCallback((qi: number, idx: number) => {
    setDraft((prev) =>
      prev.map((it, i) => {
        if (i !== qi) return it;
        const has = it.optionIndices.includes(idx);
        return {
          ...it,
          skipped: false,
          optionIndices: has
            ? it.optionIndices.filter((x) => x !== idx)
            : [...it.optionIndices, idx],
        };
      }),
    );
  }, []);

  const addMulti = useCallback((qi: number, text: string) => {
    const v = text.trim();
    if (!v) return;
    setDraft((prev) =>
      prev.map((it, i) => (i === qi ? { ...it, added: [...(it.added ?? []), v] } : it)),
    );
  }, []);

  const removeAdded = useCallback((qi: number, j: number) => {
    setDraft((prev) =>
      prev.map((it, i) =>
        i === qi ? { ...it, added: (it.added ?? []).filter((_, k) => k !== j) } : it,
      ),
    );
  }, []);

  const skip = useCallback(
    (qi: number) => {
      setDraft((prev) =>
        prev.map((it, i) =>
          i === qi ? { ...it, skipped: true, customActive: false, optionIndices: [] } : it,
        ),
      );
      advanceTab(qi);
    },
    [advanceTab],
  );

  const submit = useCallback(async () => {
    if (!client || busy) return;
    setBusy(true);
    try {
      await client.answerQuestion(sessionId, askId, buildAnswer(questions, draft));
      // Leave `busy` set: the matching tool.call.end clears `pendingAsk` and swaps this card for
      // the resolved summary. If the worker is already gone the card simply stays disabled.
    } catch (err) {
      notify(humanizeError(err, "Failed to send your answer"));
      setBusy(false);
    }
  }, [client, busy, sessionId, askId, questions, draft, notify]);

  // Keyboard affordances, scoped to this card and guarded against editable targets (so typing a
  // custom answer doesn't trigger picks). Number keys pick/toggle the active question's options;
  // Enter sends; ↑/↓ move the preview selection.
  useEffect(() => {
    if (busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && isEditableTarget(target)) return;
      const qi = layout === "tabs" ? activeTab : 0;
      const q = questions[qi];
      if (!q) {
        // Review tab: Enter submits.
        if (e.key === "Enter" && cardCanSubmit) {
          e.preventDefault();
          void submit();
        }
        return;
      }
      if (e.key === "Enter") {
        if (layout !== "tabs" && cardCanSubmit) {
          e.preventDefault();
          void submit();
        }
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        if (idx < q.options.length) {
          e.preventDefault();
          q.multiSelect ? toggleMulti(qi, idx) : chooseSingle(qi, idx);
        }
        return;
      }
      if (layout === "preview" && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        const cur = draft[0]?.optionIndices[0] ?? 0;
        const next =
          e.key === "ArrowDown" ? Math.min(cur + 1, q.options.length - 1) : Math.max(cur - 1, 0);
        chooseSingle(0, next);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, layout, activeTab, questions, draft, cardCanSubmit, submit, toggleMulti, chooseSingle]);

  const handlers = {
    chooseSingle,
    chooseCustom,
    setCustomText,
    closeCustom,
    toggleMulti,
    addMulti,
    removeAdded,
    skip,
    submit,
    setActiveTab,
  };

  if (layout === "multi") {
    return (
      <MultiLayout
        q={questions[0] as AskUserQuestion}
        draft={draft}
        h={handlers}
        canSend={cardCanSubmit}
      />
    );
  }
  if (layout === "preview") {
    return (
      <PreviewLayout
        q={questions[0] as AskUserQuestion}
        draft={draft}
        h={handlers}
        canSend={cardCanSubmit}
      />
    );
  }
  if (layout === "tabs") {
    return (
      <TabsLayout
        questions={questions}
        draft={draft}
        activeTab={activeTab}
        h={handlers}
        canSend={cardCanSubmit}
      />
    );
  }
  return (
    <CardsLayout
      q={questions[0] as AskUserQuestion}
      draft={draft}
      h={handlers}
      canSend={cardCanSubmit}
    />
  );
}

/* ──────────────────────────── shared atoms ──────────────────────────── */

interface Handlers {
  chooseSingle: (qi: number, idx: number) => void;
  chooseCustom: (qi: number) => void;
  setCustomText: (qi: number, text: string) => void;
  closeCustom: (qi: number) => void;
  toggleMulti: (qi: number, idx: number) => void;
  addMulti: (qi: number, text: string) => void;
  removeAdded: (qi: number, j: number) => void;
  skip: (qi: number) => void;
  submit: () => void | Promise<void>;
  setActiveTab: (n: number) => void;
}

function AskFrame({
  header,
  status,
  statusTone,
  question,
  headSlot,
  children,
  footer,
}: {
  header?: string;
  status: string;
  statusTone?: "default" | "done";
  question?: string;
  headSlot?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="pid-ask">
      <div className="pid-ask-head">
        <span className="pid-ask-eyebrow">
          <span className="pid-ask-qmark">?</span> pi is asking
          {header ? (
            <>
              {" · "}
              <span className="pid-ask-hdr">{header}</span>
            </>
          ) : null}
        </span>
        <span className="pid-ask-status" data-tone={statusTone === "done" ? "done" : undefined}>
          {status}
        </span>
      </div>
      {question && <div className="pid-ask-q">{question}</div>}
      {headSlot}
      {children}
      <div className="pid-ask-foot">{footer}</div>
    </div>
  );
}

function Marker({ kind, on }: { kind: "radio" | "check"; on: boolean }) {
  return (
    <span className={cn("pid-ask-marker", kind)} data-on={on || undefined}>
      {kind === "radio" ? <span className="pid-ask-dot" /> : on ? <Check size={11} /> : null}
    </span>
  );
}

function OptionRow({
  kind,
  on,
  onClick,
  onMouseEnter,
  label,
  mono,
  desc,
  kbd,
  tag,
  compact,
}: {
  kind: "radio" | "check";
  on: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  label: string;
  mono?: boolean;
  desc?: string;
  kbd?: string;
  tag?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("pid-ask-opt", compact && "compact")}
      data-on={on || undefined}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <Marker kind={kind} on={on} />
      <span className="pid-ask-opt-main">
        <span className="pid-ask-opt-row1">
          <span className={cn("pid-ask-opt-label", mono && "mono")}>{label}</span>
          {tag && <span className="pid-ask-tag">{tag}</span>}
          {kbd && <kbd className="pid-kbd pid-ask-opt-kbd">{kbd}</kbd>}
        </span>
        {desc && <span className="pid-ask-opt-desc">{desc}</span>}
      </span>
    </button>
  );
}

function CustomAnswer({
  value,
  onChange,
  onBack,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onEnter?: () => void;
}) {
  return (
    <div className="pid-ask-custom" data-on>
      <div className="pid-ask-custom-top">
        <Plus size={11} /> your answer
      </div>
      <textarea
        className="pid-ask-custom-input"
        // biome-ignore lint/a11y/noAutofocus: focus follows the user's explicit "Something else" pick
        autoFocus
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onEnter?.();
          }
        }}
        placeholder="Describe what you want…"
      />
      <div className="pid-ask-custom-foot">
        <span className="pid-ask-hint">
          <PidKbd keys={["Enter"]} /> send · <PidKbd keys={["Shift", "Enter"]} /> new line
        </span>
        <button type="button" className="pid-ask-link" onClick={onBack}>
          back to options
        </button>
      </div>
    </div>
  );
}

function OtherRow({
  on,
  onClick,
  compact,
}: {
  on: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("pid-ask-opt pid-ask-other", compact && "compact")}
      data-on={on || undefined}
      onClick={onClick}
    >
      <Marker kind="radio" on={on} />
      <span className="pid-ask-opt-main">
        <span className="pid-ask-opt-row1">
          <span className="pid-ask-opt-label">Something else…</span>
        </span>
        <span className="pid-ask-opt-desc">None of these fit - write a custom answer.</span>
      </span>
    </button>
  );
}

function Spacer() {
  return <span className="pid-ask-spacer" />;
}

/* ──────────────────────────── cards ──────────────────────────── */

function CardsLayout({
  q,
  draft,
  h,
  canSend,
}: {
  q: AskUserQuestion;
  draft: AskDraft;
  h: Handlers;
  canSend: boolean;
}) {
  const item = draft[0];
  const custom = item?.customActive;
  return (
    <AskFrame
      header={q.header}
      status="awaiting your pick"
      question={q.question}
      footer={
        <>
          <span className="pid-ask-hint">
            <kbd className="pid-kbd">1</kbd>–<kbd className="pid-kbd">{q.options.length}</kbd> pick
            · <PidKbd keys={["Enter"]} /> send
          </span>
          <Spacer />
          <PidButton
            variant="primary"
            longLabel
            icon={<ArrowRight size={12} />}
            disabled={!canSend}
            onClick={() => void h.submit()}
          >
            Send pick
          </PidButton>
        </>
      }
    >
      <div className="pid-ask-opts">
        {q.options.map((o, i) => (
          <OptionRow
            // biome-ignore lint/suspicious/noArrayIndexKey: option order is stable for the dialog's life
            key={i}
            kind="radio"
            on={!custom && item?.optionIndices.includes(i) === true}
            onClick={() => h.chooseSingle(0, i)}
            label={o.label}
            mono
            desc={o.description}
            kbd={String(i + 1)}
          />
        ))}
        {allowsCustom(q) &&
          (custom ? (
            <CustomAnswer
              value={item?.custom ?? ""}
              onChange={(v) => h.setCustomText(0, v)}
              onBack={() => h.closeCustom(0)}
              onEnter={() => {
                if (canSend) void h.submit();
              }}
            />
          ) : (
            <OtherRow on={false} onClick={() => h.chooseCustom(0)} />
          ))}
      </div>
    </AskFrame>
  );
}

/* ──────────────────────────── multi-select ──────────────────────────── */

function MultiLayout({
  q,
  draft,
  h,
  canSend,
}: {
  q: AskUserQuestion;
  draft: AskDraft;
  h: Handlers;
  canSend: boolean;
}) {
  const item = draft[0];
  const added = item?.added ?? [];
  const count = (item?.optionIndices.length ?? 0) + added.length;
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState("");
  const commitAdd = () => {
    h.addMulti(0, addDraft);
    setAddDraft("");
    setAddOpen(false);
  };
  return (
    <AskFrame
      header={q.header}
      status="pick any"
      question={q.question}
      footer={
        <>
          <span className="pid-ask-hint">
            <kbd className="pid-kbd">1</kbd>–<kbd className="pid-kbd">{q.options.length}</kbd>{" "}
            toggle
          </span>
          <Spacer />
          <PidButton
            variant="primary"
            longLabel
            icon={<Check size={12} />}
            disabled={!canSend}
            onClick={() => void h.submit()}
          >
            Send {count} {count === 1 ? "choice" : "choices"}
          </PidButton>
        </>
      }
    >
      <div className="pid-ask-opts">
        {q.options.map((o, i) => (
          <OptionRow
            // biome-ignore lint/suspicious/noArrayIndexKey: option order is stable for the dialog's life
            key={i}
            kind="check"
            on={item?.optionIndices.includes(i) === true}
            onClick={() => h.toggleMulti(0, i)}
            label={o.label}
            mono
            desc={o.description}
          />
        ))}
        {added.map((p, j) => (
          <div key={`added-${p}`} className="pid-ask-opt" data-on>
            <Marker kind="check" on />
            <span className="pid-ask-opt-main">
              <span className="pid-ask-opt-row1">
                <span className="pid-ask-opt-label mono">{p}</span>
              </span>
              <span className="pid-ask-opt-desc">added by you</span>
            </span>
            <button
              type="button"
              className="pid-ask-x"
              aria-label="Remove"
              onClick={() => h.removeAdded(0, j)}
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {allowsCustom(q) &&
          (addOpen ? (
            <div className="pid-ask-custom" data-on>
              <div className="pid-ask-custom-top">
                <Plus size={11} /> add an item
              </div>
              <div className="pid-ask-inline-input">
                <input
                  className="pid-ask-text"
                  // biome-ignore lint/a11y/noAutofocus: focus follows the user's explicit "add" action
                  autoFocus
                  value={addDraft}
                  placeholder="Type a value…"
                  onChange={(e) => setAddDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitAdd();
                  }}
                />
                <PidButton
                  variant="primary"
                  longLabel
                  icon={<Plus size={11} />}
                  disabled={!addDraft.trim()}
                  onClick={commitAdd}
                >
                  Add
                </PidButton>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="pid-ask-opt pid-ask-other"
              onClick={() => setAddOpen(true)}
            >
              <span className="pid-ask-marker check ghost">
                <Plus size={11} />
              </span>
              <span className="pid-ask-opt-main">
                <span className="pid-ask-opt-row1">
                  <span className="pid-ask-opt-label">Add one I missed…</span>
                </span>
                <span className="pid-ask-opt-desc">Include something the list didn't cover.</span>
              </span>
            </button>
          ))}
      </div>
    </AskFrame>
  );
}

/* ──────────────────────────── split preview ──────────────────────────── */

function PreviewLayout({
  q,
  draft,
  h,
  canSend,
}: {
  q: AskUserQuestion;
  draft: AskDraft;
  h: Handlers;
  canSend: boolean;
}) {
  const item = draft[0];
  const custom = item?.customActive === true;
  const sel = item?.optionIndices[0] ?? 0;
  const [hover, setHover] = useState<number | null>(null);
  const active = custom ? null : (hover ?? sel);
  const activeOpt = active != null ? q.options[active] : undefined;
  const selectedLabel = q.options[sel]?.label ?? "";
  return (
    <AskFrame
      header={q.header}
      status="awaiting your pick"
      question={q.question}
      footer={
        <>
          <span className="pid-ask-hint">
            <PidKbd keys={["ArrowUp"]} />
            <PidKbd keys={["ArrowDown"]} /> preview · <PidKbd keys={["Enter"]} /> choose
          </span>
          <Spacer />
          <PidButton
            variant="primary"
            longLabel
            icon={<ArrowRight size={12} />}
            disabled={!canSend}
            onClick={() => void h.submit()}
          >
            {custom ? "Send custom answer" : `Choose “${selectedLabel}”`}
          </PidButton>
        </>
      }
    >
      <div className="pid-ask-split">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: hover only previews; click/keyboard select */}
        <div className="pid-ask-split-opts" onMouseLeave={() => setHover(null)}>
          {q.options.map((o, i) => (
            <OptionRow
              // biome-ignore lint/suspicious/noArrayIndexKey: option order is stable for the dialog's life
              key={i}
              kind="radio"
              compact
              on={!custom && sel === i}
              onClick={() => h.chooseSingle(0, i)}
              onMouseEnter={() => setHover(i)}
              label={o.label}
              desc={o.description}
            />
          ))}
          {allowsCustom(q) && <OtherRow compact on={custom} onClick={() => h.chooseCustom(0)} />}
        </div>
        {custom ? (
          <CustomAnswer
            value={item?.custom ?? ""}
            onChange={(v) => h.setCustomText(0, v)}
            onBack={() => h.closeCustom(0)}
            onEnter={() => {
              if (canSend) void h.submit();
            }}
          />
        ) : (
          <div className="pid-ask-preview">
            <div className="pid-ask-preview-head">
              <span className="pid-ask-preview-title">{activeOpt?.label}</span>
              <span className="pid-ask-preview-badge">preview</span>
            </div>
            <div className="pid-ask-preview-body">
              {activeOpt?.preview ? (
                <Markdown text={activeOpt.preview} isComplete />
              ) : (
                <span className="pid-ask-muted">No preview for this option.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </AskFrame>
  );
}

/* ──────────────────────────── multi-question tabs ──────────────────────────── */

function TabsLayout({
  questions,
  draft,
  activeTab,
  h,
  canSend,
}: {
  questions: AskUserQuestion[];
  draft: AskDraft;
  activeTab: number;
  h: Handlers;
  canSend: boolean;
}) {
  const review = activeTab >= questions.length;
  const answeredCount = questions.filter((q, i) => isQuestionComplete(q, draft[i])).length;
  const q = questions[activeTab];
  const item = draft[activeTab];

  return (
    <AskFrame
      status={`${answeredCount}/${questions.length} answered`}
      headSlot={
        <div className="pid-ask-tabs">
          {questions.map((qq, i) => {
            const done = isQuestionComplete(qq, draft[i]);
            return (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: question order is stable for the dialog's life
                key={i}
                type="button"
                className="pid-ask-tab"
                data-on={activeTab === i || undefined}
                data-done={done || undefined}
                onClick={() => h.setActiveTab(i)}
              >
                <span className="pid-ask-tab-dot">{done ? <Check size={9} /> : i + 1}</span>
                {qq.header}
              </button>
            );
          })}
          <button
            type="button"
            className="pid-ask-tab pid-ask-tab-review"
            data-on={review || undefined}
            onClick={() => h.setActiveTab(questions.length)}
          >
            Review
          </button>
        </div>
      }
      footer={
        review ? (
          <>
            <span className="pid-ask-hint">review your answers, then send</span>
            <Spacer />
            <PidButton
              variant="primary"
              longLabel
              icon={<Check size={12} />}
              disabled={!canSend}
              onClick={() => void h.submit()}
            >
              Send answers
            </PidButton>
          </>
        ) : (
          <>
            <span className="pid-ask-hint">
              <kbd className="pid-kbd">1</kbd>–
              <kbd className="pid-kbd">{q?.options.length ?? 0}</kbd> pick ·{" "}
              <PidKbd keys={["Enter"]} /> next
            </span>
            <Spacer />
            <PidButton longLabel onClick={() => h.skip(activeTab)}>
              Skip <ChevronRight size={11} />
            </PidButton>
          </>
        )
      }
    >
      {review ? (
        <div className="pid-ask-review">
          {questions.map((qq, i) => {
            const it = draft[i];
            const answered = isQuestionComplete(qq, it) && !it?.skipped;
            const label = answeredLabel(qq, it);
            return (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: question order is stable for the dialog's life
                key={i}
                type="button"
                className="pid-ask-review-row"
                onClick={() => h.setActiveTab(i)}
              >
                <span className="pid-ask-review-q">{qq.header}</span>
                <span className="pid-ask-review-a" data-empty={!answered || undefined}>
                  {label}
                </span>
                <ChevronRight size={11} />
              </button>
            );
          })}
        </div>
      ) : q ? (
        <div className="pid-ask-opts">
          <div className="pid-ask-q pid-ask-q-sub">{q.question}</div>
          {q.options.map((o, i) => (
            <OptionRow
              // biome-ignore lint/suspicious/noArrayIndexKey: option order is stable for the dialog's life
              key={i}
              kind="radio"
              on={!item?.customActive && item?.optionIndices.includes(i) === true}
              onClick={() => h.chooseSingle(activeTab, i)}
              label={o.label}
              desc={o.description}
              kbd={String(i + 1)}
            />
          ))}
          {allowsCustom(q) &&
            (item?.customActive ? (
              <CustomAnswer
                value={item?.custom ?? ""}
                onChange={(v) => h.setCustomText(activeTab, v)}
                onBack={() => h.closeCustom(activeTab)}
                // Multi-question: Enter moves to the next question (Review when on the last),
                // mirroring how picking an option auto-advances. Submit happens from Review.
                onEnter={() => h.setActiveTab(Math.min(activeTab + 1, questions.length))}
              />
            ) : (
              <OtherRow on={false} onClick={() => h.chooseCustom(activeTab)} />
            ))}
        </div>
      ) : null}
    </AskFrame>
  );
}

function answeredLabel(q: AskUserQuestion, item: AskDraft[number] | undefined): string {
  if (!item) return "not answered";
  if (item.skipped) return "skipped";
  if (item.customActive) return item.custom?.trim() ? item.custom.trim() : "not answered";
  const picks = item.optionIndices.map((i) => q.options[i]?.label).filter(Boolean) as string[];
  if (item.added?.length) picks.push(...item.added);
  return picks.length ? picks.join(", ") : "not answered";
}

/* ──────────────────────────── resolved ──────────────────────────── */

function AskResolved({ call }: { call: ToolCallEntry }) {
  const text = extractResultText(call.result);
  return (
    <div className="pid-ask pid-ask-resolved">
      <div className="pid-ask-head">
        <span className="pid-ask-eyebrow">
          <span className="pid-ask-qmark">?</span> pi asked
        </span>
        <span className="pid-ask-status" data-tone="done">
          <Send size={10} /> answered
        </span>
      </div>
      {text ? (
        <pre className="pid-ask-resolved-body">{text}</pre>
      ) : (
        <div className="pid-ask-resolved-body pid-ask-muted">No answer recorded.</div>
      )}
    </div>
  );
}

/* ──────────────────────────── helpers ──────────────────────────── */

function extractResultText(result: unknown): string {
  if (typeof result === "string") return result.trim();
  // The tool result may arrive as the AgentToolResult (`{ content: [...] }`) or as a bare
  // content array of `{ type: "text", text }` blocks, depending on how pi forwards it.
  const blocks = Array.isArray(result)
    ? result
    : result &&
        typeof result === "object" &&
        Array.isArray((result as { content?: unknown }).content)
      ? (result as { content: unknown[] }).content
      : undefined;
  if (!blocks) return "";
  return blocks
    .map((c) =>
      c && typeof c === "object" && typeof (c as { text?: unknown }).text === "string"
        ? (c as { text: string }).text
        : "",
    )
    .join("")
    .trim();
}

function isEditableTarget(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}
