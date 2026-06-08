import { create } from "zustand";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useNotificationStore } from "../_status/useNotificationStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import type { Eol } from "./eol.js";
import { languageForFile } from "./languages.js";

export interface EditorCursor {
  /** 1-based line. */
  line: number;
  /** 1-based column. */
  col: number;
  /** Length of the current selection in characters (0 when it's a caret). */
  selLen: number;
}

export type TabStatus = "loading" | "ready" | "error";

export interface EditorTab {
  /** Stable identity: `${projectId}:${absPath}`. */
  id: string;
  projectId: string;
  /** POSIX absolute path (the FsNode path). Used for `fs.readFile` / `fs.writeFile`. */
  absPath: string;
  /** Project-relative POSIX path. Drives the breadcrumb + git baseline lookup. */
  relPath: string;
  fileName: string;
  status: TabStatus;
  errorMessage?: string;
  /** Loaded file content (LF-normalised). Updated to the saved content on save. */
  content: string;
  /** HEAD baseline for the diff gutter; `null` = untracked / no repo (no tints). */
  baseline: string | null;
  eol: Eol;
  /** Non-editable: binary blob, oversized file, or a load error. */
  readOnly: boolean;
  /** Drives the read-only overlay copy. */
  blocked?: "binary" | "tooLarge";
  /** Unsaved changes — mirrored from the CodeMirror host for the tab dot. */
  dirty: boolean;
  cursor: EditorCursor;
  /** Status-bar language label. */
  languageLabel: string;
  /** Detected indentation (drives the status bar + CodeMirror's tab size / indent unit). */
  indentUseTabs: boolean;
  indentWidth: number;
}

/** Per-workspace open-file set. Tabs are isolated per project: switching projects swaps the
 * whole tab strip + active file. */
export interface ProjectTabs {
  /** Tab ids in display order. */
  order: string[];
  activeTabId: string | null;
}

export interface OpenFileArgs {
  projectId: string;
  /** POSIX absolute path. */
  absPath: string;
  /** Project-relative POSIX path. */
  relPath: string;
}

interface EditorStoreState {
  /** Per-project tab strips. The `tabs` map is global (ids are project-qualified). */
  byProject: Record<string, ProjectTabs | undefined>;
  tabs: Record<string, EditorTab>;

  /** Open a file (or focus its existing tab) and load its contents + baseline. */
  openFile: (args: OpenFileArgs) => void;
  setActive: (id: string) => void;
  closeTab: (id: string) => void;
  setCursor: (id: string, cursor: EditorCursor) => void;
  setDirty: (id: string, dirty: boolean) => void;
  /** Persist `content` to disk. Returns true on success. */
  saveTab: (id: string, content: string) => Promise<boolean>;
}

const INITIAL_CURSOR: EditorCursor = { line: 1, col: 1, selLen: 0 };
const EMPTY_ORDER: string[] = [];

/**
 * Canonical POSIX form for path identity: forward slashes, no trailing slash.
 */
function toPosixPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function tabId(projectId: string, absPath: string): string {
  return `${projectId}:${toPosixPath(absPath)}`;
}

function basename(path: string): string {
  const ix = path.lastIndexOf("/");
  return ix >= 0 ? path.slice(ix + 1) : path;
}

/**
 * Best-effort indentation guess for the status bar + editor indent unit. Tabs win when they lead
 * more lines than spaces do; otherwise we take the most common positive indent *step* between
 * consecutive lines (preferring 2 or 4). Cosmetic — a wrong guess only mislabels the chip.
 */
function detectIndent(content: string): { useTabs: boolean; width: number } {
  const stepCounts = new Map<number, number>();
  let tabLines = 0;
  let spaceLines = 0;
  let prevIndent = 0;
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    if (line[0] === "\t") {
      tabLines++;
      continue;
    }
    const m = /^( +)/.exec(line);
    const indent = m?.[1]?.length ?? 0;
    if (indent > 0) {
      spaceLines++;
      const step = Math.abs(indent - prevIndent);
      if (step > 0) stepCounts.set(step, (stepCounts.get(step) ?? 0) + 1);
    }
    prevIndent = indent;
  }
  if (tabLines > spaceLines) return { useTabs: true, width: 4 };
  let best = 2;
  let bestN = 0;
  for (const [step, n] of stepCounts) {
    if ((step === 2 || step === 4) && n > bestN) {
      best = step;
      bestN = n;
    }
  }
  return { useTabs: false, width: best };
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  byProject: {},
  tabs: {},

  openFile: ({ projectId, absPath, relPath }) => {
    // Normalize so a file opened from different surfaces (file tree vs. git panel) shares one tab.
    const normAbs = toPosixPath(absPath);
    const id = tabId(projectId, normAbs);
    if (get().tabs[id]) {
      set((s) => {
        const proj = s.byProject[projectId] ?? { order: [], activeTabId: null };
        return { byProject: { ...s.byProject, [projectId]: { ...proj, activeTabId: id } } };
      });
      return;
    }
    const fileName = basename(relPath) || basename(normAbs);
    const tab: EditorTab = {
      id,
      projectId,
      absPath: normAbs,
      relPath,
      fileName,
      status: "loading",
      content: "",
      baseline: null,
      eol: "lf",
      readOnly: false,
      dirty: false,
      cursor: { ...INITIAL_CURSOR },
      languageLabel: languageForFile(fileName).label,
      indentUseTabs: false,
      indentWidth: 2,
    };
    set((s) => {
      const proj = s.byProject[projectId] ?? { order: [], activeTabId: null };
      return {
        tabs: { ...s.tabs, [id]: tab },
        byProject: {
          ...s.byProject,
          [projectId]: { order: [...proj.order, id], activeTabId: id },
        },
      };
    });
    void loadTab(id, set, get);
  },

  setActive: (id) => {
    set((s) => {
      const tab = s.tabs[id];
      if (!tab) return s;
      const proj = s.byProject[tab.projectId];
      if (!proj || proj.activeTabId === id) return s;
      return { byProject: { ...s.byProject, [tab.projectId]: { ...proj, activeTabId: id } } };
    });
  },

  closeTab: (id) => {
    set((s) => {
      const tab = s.tabs[id];
      if (!tab) return s;
      const proj = s.byProject[tab.projectId];
      if (!proj) return s;
      const order = proj.order.filter((x) => x !== id);
      const { [id]: _removed, ...tabs } = s.tabs;
      let activeTabId = proj.activeTabId;
      if (activeTabId === id) {
        const wasAt = proj.order.indexOf(id);
        // Prefer the tab that slid into this slot, else the previous one, else nothing.
        activeTabId = order[wasAt] ?? order[wasAt - 1] ?? null;
      }
      return { tabs, byProject: { ...s.byProject, [tab.projectId]: { order, activeTabId } } };
    });
  },

  setCursor: (id, cursor) => {
    set((s) => {
      const tab = s.tabs[id];
      if (!tab) return s;
      const c = tab.cursor;
      if (c.line === cursor.line && c.col === cursor.col && c.selLen === cursor.selLen) return s;
      return { tabs: { ...s.tabs, [id]: { ...tab, cursor } } };
    });
  },

  setDirty: (id, dirty) => {
    set((s) => {
      const tab = s.tabs[id];
      if (!tab || tab.dirty === dirty) return s;
      return { tabs: { ...s.tabs, [id]: { ...tab, dirty } } };
    });
  },

  saveTab: async (id, content) => {
    const tab = get().tabs[id];
    if (!tab || tab.readOnly) return false;
    const client = useSessionsStore.getState().client;
    if (!client) return false;
    try {
      await client.call("fs.writeFile", {
        projectId: tab.projectId,
        path: tab.absPath,
        content,
        eol: tab.eol,
      });
      set((s) => {
        const current = s.tabs[id];
        if (!current) return s;
        return { tabs: { ...s.tabs, [id]: { ...current, content, dirty: false } } };
      });
      return true;
    } catch (err) {
      useNotificationStore.getState().error(humanizeError(err, "Failed to save file"));
      return false;
    }
  },
}));

/** Load a tab's contents + HEAD baseline. Guards against the tab being closed mid-flight. */
async function loadTab(
  id: string,
  set: (fn: (s: EditorStoreState) => Partial<EditorStoreState>) => void,
  get: () => EditorStoreState,
): Promise<void> {
  const tab = get().tabs[id];
  if (!tab) return;
  const client = useSessionsStore.getState().client;
  if (!client) {
    patchTab(id, set, get, { status: "error", errorMessage: "Not connected", readOnly: true });
    return;
  }
  try {
    const [file, baseline] = await Promise.all([
      client.call("fs.readFile", { projectId: tab.projectId, path: tab.absPath }),
      client
        .call("git.fileBaseline", { projectId: tab.projectId, path: tab.relPath })
        .then((r) => r.content)
        .catch(() => null),
    ]);
    if (!get().tabs[id]) return; // closed while loading
    if (file.binary || file.tooLarge) {
      patchTab(id, set, get, {
        status: "ready",
        readOnly: true,
        blocked: file.binary ? "binary" : "tooLarge",
        eol: file.eol,
      });
      return;
    }
    const indent = detectIndent(file.content);
    patchTab(id, set, get, {
      status: "ready",
      content: file.content,
      baseline,
      eol: file.eol,
      readOnly: false,
      indentUseTabs: indent.useTabs,
      indentWidth: indent.width,
    });
  } catch (err) {
    if (!get().tabs[id]) return;
    patchTab(id, set, get, {
      status: "error",
      errorMessage: humanizeError(err, "Failed to open file"),
      readOnly: true,
    });
  }
}

function patchTab(
  id: string,
  set: (fn: (s: EditorStoreState) => Partial<EditorStoreState>) => void,
  get: () => EditorStoreState,
  patch: Partial<EditorTab>,
): void {
  const tab = get().tabs[id];
  if (!tab) return;
  set((s) => ({ tabs: { ...s.tabs, [id]: { ...tab, ...patch } } }));
}

/** Tab ids (display order) for a project, or a stable empty array. */
export function selectProjectOrder(projectId: string | undefined) {
  return (s: EditorStoreState): string[] =>
    (projectId ? s.byProject[projectId]?.order : undefined) ?? EMPTY_ORDER;
}

/** The active tab id for a project, or null. */
export function selectActiveTabId(projectId: string | undefined) {
  return (s: EditorStoreState): string | null =>
    (projectId ? s.byProject[projectId]?.activeTabId : null) ?? null;
}

/** The active tab object for a project, or undefined. */
export function selectActiveTab(projectId: string | undefined) {
  return (s: EditorStoreState): EditorTab | undefined => {
    const id = projectId ? s.byProject[projectId]?.activeTabId : undefined;
    return id ? s.tabs[id] : undefined;
  };
}
