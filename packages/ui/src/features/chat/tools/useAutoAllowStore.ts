import { create } from "zustand";

/**
 * Per-session "always allow this tool" registry.
 *
 * When the user ticks "always allow <key>" on an ApprovalPill, we remember the key here.
 * The next time the agent-mode plugin asks for approval on a tool call with the same key,
 * the pill auto-resolves to `allow` on mount instead of waiting for a click.
 *
 * Keys are *renderer-side only* and forgotten when the renderer unloads — there is no
 * persistence, no protocol surface, no plugin coordination. This matches the design choice
 * that the agent-mode plugin's `targetMode` (ask / accept-edits) is the durable knob; the
 * checkbox is a transient session convenience for the user who has just seen one tool ask
 * for approval and doesn't want to be asked again *in this session*.
 *
 * Key shape is whatever `deriveAllowKey()` produces (typically a tool name, or the first
 * token of a `bash` command). The store is intentionally schema-light: it's just a set per
 * session.
 */
interface AutoAllowState {
  /** Allowed keys, keyed by sessionId. */
  bySession: Record<string, ReadonlySet<string>>;
  /** Add `key` to the session's allowed set (idempotent). */
  add: (sessionId: string, key: string) => void;
  /** Check whether `key` is currently allowed for the session. */
  has: (sessionId: string, key: string) => boolean;
  /** Forget every allow for `sessionId` — useful on session delete. */
  clearSession: (sessionId: string) => void;
}

export const useAutoAllowStore = create<AutoAllowState>((set, get) => ({
  bySession: {},
  add: (sessionId, key) =>
    set((s) => {
      const current = s.bySession[sessionId];
      if (current?.has(key)) return s; // idempotent — preserve reference identity
      const next = new Set(current ?? []);
      next.add(key);
      return { bySession: { ...s.bySession, [sessionId]: next } };
    }),
  has: (sessionId, key) => Boolean(get().bySession[sessionId]?.has(key)),
  clearSession: (sessionId) =>
    set((s) => {
      if (!s.bySession[sessionId]) return s;
      const { [sessionId]: _drop, ...rest } = s.bySession;
      return { bySession: rest };
    }),
}));
