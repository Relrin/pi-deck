import { create } from "zustand";

export type NotificationKind = "success" | "error" | "info";

export interface NotificationAction {
  /** Stable identifier — handy for tests and analytics later. */
  id: string;
  label: string;
  /** Visual treatment. Defaults to "secondary" (outlined). */
  variant?: "primary" | "secondary" | "danger";
  /** Optional leading icon (a Lucide / Glyph component). Caller renders it. */
  leadingIcon?: React.ReactNode;
  /** Whether to dismiss the toast after the action fires. Defaults to true. Set false
   * when the action triggers another notification (e.g. retry pushes a new one). */
  dismissAfter?: boolean;
  onSelect: () => void | Promise<void>;
}

export interface NotificationFootnote {
  label: string;
  onSelect: () => void;
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  /** Bold one-line header. */
  title: string;
  /** Optional uppercase badge on the right side of the title row (e.g., "COMMIT"). */
  tag?: string;
  /** Optional body sentence under the title. */
  body?: string;
  /** Optional dimmer metadata line (e.g., "9a3f12c · 7 files · +212 -18 · just now"). */
  meta?: string;
  /** Up to three action buttons, rendered in order. */
  actions?: NotificationAction[];
  /** Optional inline link at the bottom — e.g. "view log". */
  footnote?: NotificationFootnote;
  /** Total ms before auto-dismiss. `0` keeps the entry until the user dismisses. */
  durationMs: number;
  createdAt: number;
}

export type NotificationInput = Omit<Notification, "id" | "createdAt"> & {
  /** Optional caller-provided id; otherwise auto-generated. Lets a retry replace the
   * previous notification instead of stacking — pass the same id to swap-in. */
  id?: string;
};

interface NotificationStoreState {
  notifications: Notification[];
  /** Pushes (or replaces, when `input.id` matches an existing entry) a notification.
   * Returns the resolved id so callers can dismiss programmatically. */
  push: (input: NotificationInput) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const MAX = 4;

export const useNotificationStore = create<NotificationStoreState>((set) => ({
  notifications: [],
  push: (input) => {
    const id = input.id ?? `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => {
      const fresh: Notification = {
        id,
        kind: input.kind,
        title: input.title,
        tag: input.tag,
        body: input.body,
        meta: input.meta,
        actions: input.actions,
        footnote: input.footnote,
        durationMs: input.durationMs,
        createdAt: Date.now(),
      };
      // Caller-driven replace: if an entry with this id already exists, swap it in place
      // rather than stacking. This is what makes a retry-and-fail-again present as "the
      // same notification updated" instead of two separate cards.
      const idx = state.notifications.findIndex((n) => n.id === id);
      if (idx >= 0) {
        const next = state.notifications.slice();
        next[idx] = fresh;
        return { notifications: next };
      }
      const appended = [...state.notifications, fresh];
      if (appended.length > MAX) appended.splice(0, appended.length - MAX);
      return { notifications: appended };
    });
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
  dismissAll: () => set({ notifications: [] }),
}));
