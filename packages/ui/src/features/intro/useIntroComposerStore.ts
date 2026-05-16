import { create } from "zustand";

interface IntroComposerState {
  text: string;
  setText: (text: string) => void;
  clear: () => void;
}

/**
 * Standalone text buffer for the intro-screen composer stub. We don't reuse the chat
 * composer's draft store because the intro composer lives outside any session — the
 * value is consumed once on dispatch (creates a session, seeds the prompt) and cleared.
 */
export const useIntroComposerStore = create<IntroComposerState>((set) => ({
  text: "",
  setText: (text) => set({ text }),
  clear: () => set({ text: "" }),
}));
