import type { AgentMode, SessionModelRef, ThinkingLevel } from "@pi-deck/core/domain/session.js";
import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * In-memory representation of a clipboard/dropped image staged in the composer. Carries
 * the full-resolution base64 payload (sent to pi on Send) plus a small pre-generated
 * thumbnail data-URL used for the chip, the lightbox source on quick previews, and the
 * persisted user-message history thumbnail.
 */
export interface PromptImageDraft {
  /** Stable local key for React lists and `removeImage(id)`. */
  id: string;
  mimeType: string;
  /** Full-resolution base64 (no `data:…;base64,` prefix). Sent to pi, dropped after Send. */
  data: string;
  /** ~256 px max-dim data-URL used for chip + history thumbnail. */
  thumbnailDataUrl: string;
  /** Display label (e.g. "Pasted image" or original filename). */
  name: string;
  /** Original byte size of the full payload; drives the size cap. */
  byteSize: number;
}

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
  /** Clipboard/dropped images queued for the next prompt; cleared on Send. */
  images: PromptImageDraft[];

  setText: (text: string) => void;
  setPendingModel: (ref: SessionModelRef | undefined) => void;
  setPendingThinkingLevel: (level: ThinkingLevel | undefined) => void;
  setAgentMode: (mode: AgentMode) => void;
  addAttachments: (next: PromptAttachment[]) => void;
  removeAttachment: (path: string) => void;
  clearAttachments: () => void;
  addImages: (next: PromptImageDraft[]) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
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
      images: [],

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
      addImages: (next) =>
        set((s) => {
          // De-dupe on `id` — `useImagePaste` generates a fresh id per paste, so this only
          // protects against accidental double-fires of the same handler.
          const seen = new Set(s.images.map((i) => i.id));
          const merged = [...s.images];
          for (const img of next) {
            if (seen.has(img.id)) continue;
            seen.add(img.id);
            merged.push(img);
          }
          return { images: merged };
        }),
      removeImage: (id) => set((s) => ({ images: s.images.filter((i) => i.id !== id) })),
      clearImages: () => set({ images: [] }),
      // `clear` runs after Send — drops typed text, attachments, and any staged images.
      clear: () => set({ text: "", attachments: [], images: [] }),
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
