import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * State for the integrated terminal bottom panel. Scoped **per pi-deck session** so each
 * session has its own isolated set of terminal tabs (like native terminal tabs), plus its own
 * panel open/height. The active scope key is the active session id, or `GLOBAL_SCOPE` when no
 * session is open (e.g. the blank/start screen).
 *
 * PTYs live only for the app run, so the host-side `terminalId` of each tab is runtime-only and
 * stripped on persist; on reload a tab re-opens a fresh PTY lazily when it next becomes active.
 */

export const GLOBAL_SCOPE = "__global__";

export const TERMINAL_MIN_HEIGHT = 120;
export const TERMINAL_MAX_HEIGHT = 1200;
export const TERMINAL_DEFAULT_HEIGHT = 280;

const clampHeight = (px: number) =>
  Math.min(Math.max(Math.round(px), TERMINAL_MIN_HEIGHT), TERMINAL_MAX_HEIGHT);

export interface TerminalTab {
  /** Stable client id, persisted; identifies the tab across reloads. */
  tabId: string;
  /** Working directory the PTY was (or will be) opened in. */
  cwd: string;
  /** Host PTY id — runtime only, null until opened, reset to null on persist/exit. */
  terminalId: string | null;
  /** Shell path the host actually spawned; populated from the `terminal.open` response. */
  shell?: string;
  /**
   * Shell path the user explicitly chose for this tab via the new-terminal picker. `undefined`
   * means "use the global default shell setting". Drives the `terminal.open` request; distinct
   * from `shell`, which is the resolved path the host reports back (used for the tab label).
   */
  requestedShell?: string;
  /** True once the PTY has exited; the view shows an "[exited]" affordance to restart. */
  exited: boolean;
}

interface SessionTerminalState {
  open: boolean;
  height: number;
  tabs: TerminalTab[];
  activeTabId: string | null;
}

interface TerminalStore {
  bySession: Record<string, SessionTerminalState>;
  /** The scope whose tabs/panel are currently shown. Set from the active session. */
  currentKey: string;

  setScope: (key: string) => void;
  setOpen: (open: boolean) => void;
  togglePanel: () => void;
  setHeight: (px: number) => void;

  addTab: (tab: Omit<TerminalTab, "exited">) => void;
  /** Add `tab` only when the scope has no tabs yet. */
  ensureTab: (tab: Omit<TerminalTab, "exited">) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setTabTerminalId: (tabId: string, terminalId: string, shell?: string) => void;
  /** Find the tab carrying `terminalId` across all scopes and mark it exited. */
  applyExit: (terminalId: string) => void;
}

function emptyScope(): SessionTerminalState {
  return { open: false, height: TERMINAL_DEFAULT_HEIGHT, tabs: [], activeTabId: null };
}

/** Immutably update the scope identified by `currentKey`. */
function patchCurrent(
  state: TerminalStore,
  fn: (scope: SessionTerminalState) => SessionTerminalState,
): Pick<TerminalStore, "bySession"> {
  const key = state.currentKey;
  const scope = state.bySession[key] ?? emptyScope();
  return { bySession: { ...state.bySession, [key]: fn(scope) } };
}

export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set) => ({
      bySession: {},
      currentKey: GLOBAL_SCOPE,

      setScope: (key) =>
        set((state) => {
          if (state.currentKey === key && state.bySession[key]) return state;
          const bySession = state.bySession[key]
            ? state.bySession
            : { ...state.bySession, [key]: emptyScope() };
          return { currentKey: key, bySession };
        }),

      setOpen: (open) => set((state) => patchCurrent(state, (s) => ({ ...s, open }))),
      togglePanel: () => set((state) => patchCurrent(state, (s) => ({ ...s, open: !s.open }))),
      setHeight: (px) =>
        set((state) => patchCurrent(state, (s) => ({ ...s, height: clampHeight(px) }))),

      addTab: (tab) =>
        set((state) =>
          patchCurrent(state, (s) => ({
            ...s,
            tabs: [...s.tabs, { ...tab, exited: false }],
            activeTabId: tab.tabId,
          })),
        ),

      // Check-and-add in a single synchronous `set`, so a second concurrent call (StrictMode's
      // double-invoked effect) sees the tab the first added and no-ops instead of duplicating it.
      ensureTab: (tab) =>
        set((state) =>
          patchCurrent(state, (s) =>
            s.tabs.length > 0
              ? s
              : { ...s, tabs: [{ ...tab, exited: false }], activeTabId: tab.tabId },
          ),
        ),

      removeTab: (tabId) =>
        set((state) =>
          patchCurrent(state, (s) => {
            const idx = s.tabs.findIndex((t) => t.tabId === tabId);
            if (idx === -1) return s;
            const tabs = s.tabs.filter((t) => t.tabId !== tabId);
            // When closing the active tab, focus the neighbour (prefer the one to the left).
            let activeTabId = s.activeTabId;
            if (s.activeTabId === tabId) {
              const next = tabs[idx - 1] ?? tabs[idx] ?? tabs[tabs.length - 1];
              activeTabId = next?.tabId ?? null;
            }
            return { ...s, tabs, activeTabId };
          }),
        ),

      setActiveTab: (tabId) =>
        set((state) => patchCurrent(state, (s) => ({ ...s, activeTabId: tabId }))),

      setTabTerminalId: (tabId, terminalId, shell) =>
        set((state) =>
          patchCurrent(state, (s) => ({
            ...s,
            tabs: s.tabs.map((t) =>
              t.tabId === tabId ? { ...t, terminalId, shell: shell ?? t.shell, exited: false } : t,
            ),
          })),
        ),

      applyExit: (terminalId) =>
        set((state) => {
          let changed = false;
          const bySession: Record<string, SessionTerminalState> = {};
          for (const [key, scope] of Object.entries(state.bySession)) {
            const tabs = scope.tabs.map((t) => {
              if (t.terminalId === terminalId && !t.exited) {
                changed = true;
                return { ...t, exited: true };
              }
              return t;
            });
            bySession[key] = changed && tabs !== scope.tabs ? { ...scope, tabs } : scope;
          }
          return changed ? { bySession } : state;
        }),
    }),
    {
      name: "pi-deck:terminal:v1",
      version: 1,
      // Persist panel state + tab descriptors per session, but strip runtime PTY state — a
      // persisted `terminalId` is dead after the app restarts, so tabs reopen lazily.
      partialize: (state) => ({
        bySession: Object.fromEntries(
          Object.entries(state.bySession).map(([key, scope]) => [
            key,
            {
              open: scope.open,
              height: scope.height,
              activeTabId: scope.activeTabId,
              tabs: scope.tabs.map((t) => ({
                tabId: t.tabId,
                cwd: t.cwd,
                shell: t.shell,
                requestedShell: t.requestedShell,
                terminalId: null,
                exited: false,
              })),
            },
          ]),
        ),
      }),
    },
  ),
);

/** Stable selector: the scope state for the current key (or an empty scope). */
export function selectCurrentScope(state: TerminalStore): SessionTerminalState {
  return state.bySession[state.currentKey] ?? emptyScope();
}
