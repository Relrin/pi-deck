import { create } from "zustand";

interface ToolCardExpansionStoreState {
  /** sessionId → (callId → expanded). Absence means collapsed (the default). */
  expanded: Record<string, Record<string, boolean>>;
  isOpen: (sessionId: string, callId: string) => boolean;
  setOpen: (sessionId: string, callId: string, open: boolean) => void;
  toggle: (sessionId: string, callId: string) => void;
}

/**
 * Per-session memory of which tool-call cards are expanded. `ToolCallCard` reads and writes
 * here instead of holding the open/closed flag in local state, so a card stays open when its
 * component unmounts and remounts — which happens both when the user switches center screens
 * (the router swaps `ChatView` out entirely) and when the virtualized message list recycles a
 * row that scrolls out of view.
 *
 * In-memory only (no localStorage), matching `useScrollPositionStore`: the feedback is about
 * persistence within a session, not across app restarts.
 */
export const useToolCardExpansionStore = create<ToolCardExpansionStoreState>((set, getState) => ({
  expanded: {},
  isOpen: (sessionId, callId) => getState().expanded[sessionId]?.[callId] ?? false,
  setOpen: (sessionId, callId, open) =>
    set((state) => {
      const current = state.expanded[sessionId]?.[callId] ?? false;
      if (current === open) return state;
      return {
        expanded: {
          ...state.expanded,
          [sessionId]: { ...state.expanded[sessionId], [callId]: open },
        },
      };
    }),
  toggle: (sessionId, callId) => {
    const current = getState().isOpen(sessionId, callId);
    getState().setOpen(sessionId, callId, !current);
  },
}));
