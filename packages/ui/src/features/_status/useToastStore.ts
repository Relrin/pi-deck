import { create } from "zustand";

export interface Toast {
  id: string;
  message: string;
  kind: "error" | "info";
  createdAt: number;
}

interface ToastStoreState {
  toasts: Toast[];
  push: (message: string, kind?: Toast["kind"]) => void;
  dismiss: (id: string) => void;
}

const MAX_TOASTS = 5;

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],
  push: (message, kind = "info") =>
    set((state) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next = [...state.toasts, { id, message, kind, createdAt: Date.now() }];
      if (next.length > MAX_TOASTS) next.splice(0, next.length - MAX_TOASTS);
      return { toasts: next };
    }),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
