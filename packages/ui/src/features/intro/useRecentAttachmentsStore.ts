import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const RECENT_CAP = 5;

interface RecentAttachmentsState {
  entries: PromptAttachment[];
  push: (attachment: PromptAttachment) => void;
  clear: () => void;
}

/**
 * MRU list of attachments the user has referenced from the intro composer. Survives
 * restarts so the attachments popover can show familiar paths to one-click reattach.
 * Capped at RECENT_CAP — the popover is meant to feel like a recent-files shortcut,
 * not a full history view.
 */
export const useRecentAttachmentsStore = create<RecentAttachmentsState>()(
  persist(
    (set) => ({
      entries: [],
      push: (attachment) =>
        set((s) => {
          const key = `${attachment.kind}|${attachment.path}`;
          const without = s.entries.filter((e) => `${e.kind}|${e.path}` !== key);
          return { entries: [attachment, ...without].slice(0, RECENT_CAP) };
        }),
      clear: () => set({ entries: [] }),
    }),
    {
      name: "pi-deck:recent-attachments:v1",
    },
  ),
);
