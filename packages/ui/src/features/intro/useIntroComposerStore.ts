import type { AgentMode, SessionModelRef, ThinkingLevel } from "@pi-deck/core/domain/session.js";
import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface IntroComposerState {
  text: string;
  /** Last-selected model on the intro composer; applied to the session created on Send. */
  pendingModelRef: SessionModelRef | undefined;
  /** Last-selected thinking level on the intro composer; applied to the session created on Send. */
  pendingThinkingLevel: ThinkingLevel | undefined;
  /** Last-selected agent mode; defaults to "plan" on a fresh install. */
  agentMode: AgentMode;
  /** Files / folders / repo refs queued for the next prompt; cleared on Send. */
  attachments: PromptAttachment[];

  setText: (text: string) => void;
  setPendingModel: (ref: SessionModelRef | undefined) => void;
  setPendingThinkingLevel: (level: ThinkingLevel | undefined) => void;
  setAgentMode: (mode: AgentMode) => void;
  addAttachments: (next: PromptAttachment[]) => void;
  removeAttachment: (path: string) => void;
  clearAttachments: () => void;
  clear: () => void;
}

/**
 * Standalone draft state for the intro-screen composer. We don't reuse the chat composer's
 * draft store because the intro composer lives outside any session — text is consumed once
 * on dispatch (creates a session, seeds the prompt) and cleared, while model/effort
 * preferences persist across launches so the next session opens with the user's last pick.
 */
export const useIntroComposerStore = create<IntroComposerState>()(
  persist(
    (set) => ({
      text: "",
      pendingModelRef: undefined,
      pendingThinkingLevel: undefined,
      agentMode: "plan",
      attachments: [],

      setText: (text) => set({ text }),
      setPendingModel: (pendingModelRef) => set({ pendingModelRef }),
      setPendingThinkingLevel: (pendingThinkingLevel) => set({ pendingThinkingLevel }),
      setAgentMode: (agentMode) => set({ agentMode }),
      addAttachments: (next) =>
        set((s) => {
          // De-dupe on (kind|path) — re-attaching the same file is a no-op rather than dup chips.
          const seen = new Set(s.attachments.map((a) => `${a.kind}|${a.path}`));
          const merged = [...s.attachments];
          for (const a of next) {
            const key = `${a.kind}|${a.path}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(a);
          }
          return { attachments: merged };
        }),
      removeAttachment: (path) =>
        set((s) => ({ attachments: s.attachments.filter((a) => a.path !== path) })),
      clearAttachments: () => set({ attachments: [] }),
      // `clear` runs after Send — drops both the typed text and the just-consumed attachments.
      clear: () => set({ text: "", attachments: [] }),
    }),
    {
      name: "pi-deck:intro-composer:v1",
      // Persist user picks across reloads; in-flight `text` and `attachments` are session-scoped.
      partialize: (state) => ({
        pendingModelRef: state.pendingModelRef,
        pendingThinkingLevel: state.pendingThinkingLevel,
        agentMode: state.agentMode,
      }),
    },
  ),
);
