import type { SessionModelRef, ThinkingLevel } from "@pi-deck/core/domain/session.js";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface IntroComposerState {
  text: string;
  /** Last-selected model on the intro composer; applied to the session created on Send. */
  pendingModelRef: SessionModelRef | undefined;
  /** Last-selected thinking level on the intro composer; applied to the session created on Send. */
  pendingThinkingLevel: ThinkingLevel | undefined;

  setText: (text: string) => void;
  setPendingModel: (ref: SessionModelRef | undefined) => void;
  setPendingThinkingLevel: (level: ThinkingLevel | undefined) => void;
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

      setText: (text) => set({ text }),
      setPendingModel: (pendingModelRef) => set({ pendingModelRef }),
      setPendingThinkingLevel: (pendingThinkingLevel) => set({ pendingThinkingLevel }),
      clear: () => set({ text: "" }),
    }),
    {
      name: "pi-deck:intro-composer:v1",
      // Only the user's persistent picks survive reloads — `text` is the in-flight draft.
      partialize: (state) => ({
        pendingModelRef: state.pendingModelRef,
        pendingThinkingLevel: state.pendingThinkingLevel,
      }),
    },
  ),
);
