import type { AskUserAnswer } from "../../protocol/commands.js";
import type { AskUserQuestion } from "../../protocol/events.js";

/** Default wait before an unanswered question auto-cancels. Questions (especially plan-steering
 * ones) can take a while to think through, so this is far longer than the approval timeout. */
export const ASK_USER_TIMEOUT_MS = 30 * 60_000;

/** A pending question handed to whatever frontend is wired in. */
export interface AskRequest {
  askId: string;
  toolCallId: string;
  questions: AskUserQuestion[];
}

/**
 * Frontend-agnostic port the ask-user tool talks to. The tool doesn't know or care whether a
 * GUI or a TUI is on the other end - it just `present()`s a request and awaits an answer.
 * pi-deck injects a GUI frontend (see `createDeferredFrontend`); a terminal presenter is a
 * clean future drop-in against the same interface.
 */
export interface AskFrontend {
  present(request: AskRequest, signal?: AbortSignal): Promise<AskUserAnswer>;
  /** Optional: cancel any in-flight questions when the session shuts down. */
  dispose?(): void;
}

export interface DeferredFrontendOptions {
  /** Called synchronously when a question needs to reach the user (e.g. emit a host event). */
  onAskRequest: (request: AskRequest) => void;
  /** Auto-cancel timeout. Defaults to {@link ASK_USER_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Injectable timers for deterministic tests. */
  timers?: {
    setTimeout: (cb: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
  };
}

export interface DeferredFrontend extends AskFrontend {
  /** Resolve a pending question with the user's answer. Unknown ids are a no-op so a stale or
   * duplicate reply from the renderer doesn't throw. */
  resolveAsk(askId: string, answer: AskUserAnswer): void;
  /** Snapshot of currently pending question ids. */
  pendingAskIds(): string[];
  /** Cancel every pending question; used when the worker shuts down mid-turn. */
  dispose(): void;
}

const CANCELLED: AskUserAnswer = { answers: [], cancelled: true };

interface PendingEntry {
  resolve: (answer: AskUserAnswer) => void;
  cleanup: () => void;
}

/**
 * The host-driven realization of {@link AskFrontend}: `present()` registers a pending entry,
 * fires `onAskRequest`, and suspends until `resolveAsk()` is called from the host (with the
 * renderer's answer), the timeout elapses, or the turn's `AbortSignal` fires. This is exactly
 * what the GUI flow needs - it mirrors the agent-mode approval suspend/resume machinery.
 */
export function createDeferredFrontend(options: DeferredFrontendOptions): DeferredFrontend {
  const timers = options.timers ?? {
    setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
    clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>),
  };
  const timeoutMs = options.timeoutMs ?? ASK_USER_TIMEOUT_MS;
  const pending = new Map<string, PendingEntry>();

  function finish(askId: string, answer: AskUserAnswer): void {
    const entry = pending.get(askId);
    if (!entry) return;
    pending.delete(askId);
    entry.cleanup();
    entry.resolve(answer);
  }

  return {
    present(request, signal) {
      return new Promise<AskUserAnswer>((resolve) => {
        if (signal?.aborted) {
          resolve(CANCELLED);
          return;
        }
        const timerHandle = timers.setTimeout(() => finish(request.askId, CANCELLED), timeoutMs);
        const onAbort = () => finish(request.askId, CANCELLED);
        signal?.addEventListener("abort", onAbort, { once: true });
        pending.set(request.askId, {
          resolve,
          cleanup: () => {
            timers.clearTimeout(timerHandle);
            signal?.removeEventListener("abort", onAbort);
          },
        });
        options.onAskRequest(request);
      });
    },
    resolveAsk(askId, answer) {
      finish(askId, answer);
    },
    pendingAskIds() {
      return [...pending.keys()];
    },
    dispose() {
      for (const askId of [...pending.keys()]) finish(askId, CANCELLED);
    },
  };
}
