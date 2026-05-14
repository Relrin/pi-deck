import { create } from "zustand";

interface DraftStoreState {
  /** When set, MessageInput appends this to its textarea and clears it. */
  pendingInsert: string | undefined;
  insertIntoDraft: (text: string) => void;
  consumePendingInsert: () => string | undefined;
}

export const useDraftStore = create<DraftStoreState>((set, get) => ({
  pendingInsert: undefined,
  insertIntoDraft: (text) => set({ pendingInsert: text }),
  consumePendingInsert: () => {
    const value = get().pendingInsert;
    if (value !== undefined) set({ pendingInsert: undefined });
    return value;
  },
}));
