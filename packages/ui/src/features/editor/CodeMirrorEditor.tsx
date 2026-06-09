import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  type KeyBinding,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavStore } from "../../lib/useNavStore.js";
import { useThemeStore } from "../../theme/useThemeStore.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import {
  baselineText,
  type DiffHoverInfo,
  type DiffOverview,
  diffChunkInfo,
  diffGutter,
  diffHoverAt,
  diffOverview,
  gotoDiffChunk,
  revealDiffChunk,
  revertDiffChunk,
  setActiveDiffChunk,
  setDiffBaseline,
} from "./diffExtension.js";
import { cmHighlight, cmTheme } from "./editorTheme.js";
import { registerEditorView } from "./editorViewBridge.js";
import { languageForFile } from "./languages.js";
import { PidDiffBlockToolbar } from "./PidDiffBlockToolbar.js";
import { PidDiffMinimap } from "./PidDiffMinimap.js";
import {
  type EditorTab,
  selectActiveTabId,
  selectProjectOrder,
  useEditorStore,
} from "./useEditorStore.js";

// Compartments are shared keys; configuration is per-EditorState. We reconfigure the theme
// compartment on light/dark flips and the language compartment is set once per tab at build time.
const langCompartment = new Compartment();
const themeCompartment = new Compartment();

const EMPTY_OVERVIEW: DiffOverview = { hasBaseline: false, marks: [] };

interface TabCacheEntry {
  /** Detached state for an inactive tab — preserves undo history + selection on tab switch. */
  state: EditorState;
  scrollTop: number;
  /** The doc as last loaded/saved; the dirty flag is `!doc.eq(savedText)`. */
  savedText: EditorState["doc"];
  /** The tab's `reloadToken` when this state was built; a mismatch means the buffer was
   * replaced out-of-band (reopen-in-encoding) and the cached state is stale. */
  reloadToken: number;
}

/** Resolve whether the active theme is dark (drives CodeMirror's `dark` flag). */
function useThemeIsDark(): boolean {
  return useThemeStore(
    (s) =>
      (s.activeSpec?.meta?.kind ??
        s.available.find((t) => t.name === s.activeName)?.kind ??
        "dark") !== "light",
  );
}

/**
 * Single mounted `EditorView` that swaps state per active tab. The view is created once; switching
 * tabs calls `view.setState(cachedState)` so each tab keeps its own undo history, selection, and
 * scroll. Content/dirty/cursor flow back into `useEditorStore` for the tab strip + status bar.
 */
export function CodeMirrorEditor() {
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const activeTabId = useEditorStore(selectActiveTabId(projectId));
  const status = useEditorStore((s) => (activeTabId ? s.tabs[activeTabId]?.status : undefined));
  const blocked = useEditorStore((s) => (activeTabId ? s.tabs[activeTabId]?.blocked : undefined));
  const errorMessage = useEditorStore((s) =>
    activeTabId ? s.tabs[activeTabId]?.errorMessage : undefined,
  );
  const order = useEditorStore(selectProjectOrder(projectId));
  const dark = useThemeIsDark();

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const cacheRef = useRef<Map<string, TabCacheEntry>>(new Map());
  const prevIdRef = useRef<string | null>(null);
  const darkRef = useRef(dark);

  // Diff-block toolbar: opens on a gutter *click* (pinned), closes on outside-click / Escape /
  // scroll / edit / tab switch. Hovering the gutter only thickens the block's bar.
  const [openChunk, setOpenChunk] = useState<DiffHoverInfo | null>(null);
  const openIdxRef = useRef<number | null>(null);
  const activeIdxRef = useRef<number | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Diff overview ruler (minimap): a whole-file map of change blocks beside the scrollbar. Marks
  // are line-fraction based, so they only change on edits + tab switches — coalesce bursts via rAF.
  const [overview, setOverview] = useState<DiffOverview>(EMPTY_OVERVIEW);
  const overviewRafRef = useRef<number | null>(null);
  const refreshOverview = useCallback(() => {
    if (overviewRafRef.current !== null) return;
    overviewRafRef.current = requestAnimationFrame(() => {
      overviewRafRef.current = null;
      const v = viewRef.current;
      setOverview(v ? diffOverview(v.state) : EMPTY_OVERVIEW);
    });
  }, []);
  const refreshOverviewRef = useRef(refreshOverview);
  refreshOverviewRef.current = refreshOverview;

  const setActive = useCallback((view: EditorView, idx: number | null) => {
    if (activeIdxRef.current === idx) return;
    activeIdxRef.current = idx;
    setActiveDiffChunk(view, idx);
  }, []);

  const closeToolbar = useCallback(() => {
    openIdxRef.current = null;
    const v = viewRef.current;
    if (v) setActive(v, null);
    setOpenChunk(null);
  }, [setActive]);

  // Stable ref so the per-tab CM updateListener + scroll listener can close without re-subscribing.
  const closeToolbarRef = useRef(closeToolbar);
  closeToolbarRef.current = closeToolbar;

  // Hover → thicken the hovered block's bar (suppressed while the toolbar is pinned open).
  const handleWrapMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (openIdxRef.current !== null) return;
      const view = viewRef.current;
      if (!view) return;
      const info = diffHoverAt(view, e.clientX, e.clientY);
      setActive(view, info?.overGutter ? info.index : null);
    },
    [setActive],
  );

  const handleWrapMouseLeave = useCallback(() => {
    if (openIdxRef.current !== null) return;
    const view = viewRef.current;
    if (view) setActive(view, null);
  }, [setActive]);

  // Click the gutter → open/switch the toolbar; click elsewhere in the editor → dismiss.
  const handleWrapClick = useCallback(
    (e: React.MouseEvent) => {
      if (toolbarRef.current && e.target instanceof Node && toolbarRef.current.contains(e.target)) {
        return; // a toolbar button owns this click
      }
      const view = viewRef.current;
      if (!view) return;
      const info = diffHoverAt(view, e.clientX, e.clientY);
      if (info?.overGutter) {
        openIdxRef.current = info.index;
        setActive(view, info.index);
        setOpenChunk(info);
      } else if (openIdxRef.current !== null) {
        closeToolbar();
      }
    },
    [setActive, closeToolbar],
  );

  // Persist `content` to disk, then mark the in-editor baseline clean. Capturing the doc we wrote
  // (not the post-await doc) means edits made during the save round-trip correctly stay dirty.
  const handleSave = useCallback((view: EditorView, id: string) => {
    const savedDoc = view.state.doc;
    void useEditorStore
      .getState()
      .saveTab(id, savedDoc.toString())
      .then((ok) => {
        if (!ok) return;
        const entry = cacheRef.current.get(id);
        if (entry) entry.savedText = savedDoc;
        const current = viewRef.current;
        // Recompute dirty against the just-saved doc (it may differ if the user kept typing).
        // Only the live view reflects this tab if it's still the active one in its project.
        const tab = useEditorStore.getState().tabs[id];
        const stillActive = tab
          ? useEditorStore.getState().byProject[tab.projectId]?.activeTabId === id
          : false;
        if (current && stillActive) {
          useEditorStore.getState().setDirty(id, !current.state.doc.eq(savedDoc));
        } else {
          useEditorStore.getState().setDirty(id, false);
        }
      });
  }, []);

  const buildState = useCallback(
    (tab: EditorTab): EditorState => {
      const lang = languageForFile(tab.fileName);
      const listener = EditorView.updateListener.of((update) => {
        const id = tab.id;
        if (update.docChanged) {
          // Editing shifts/destroys chunks — drop the toolbar and re-map the overview ruler.
          closeToolbarRef.current();
          refreshOverviewRef.current();
          const entry = cacheRef.current.get(id);
          const isDirty = entry ? !update.state.doc.eq(entry.savedText) : true;
          useEditorStore.getState().setDirty(id, isDirty);
        }
        if (update.docChanged || update.selectionSet) {
          const sel = update.state.selection.main;
          const line = update.state.doc.lineAt(sel.head);
          useEditorStore.getState().setCursor(id, {
            line: line.number,
            col: sel.head - line.from + 1,
            selLen: sel.to - sel.from,
          });
        }
      });
      const saveKey: KeyBinding = {
        key: "Mod-s",
        preventDefault: true,
        run: (view) => {
          handleSave(view, tab.id);
          return true;
        },
      };
      const extensions: Extension[] = [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        EditorState.tabSize.of(tab.indentWidth),
        indentUnit.of(tab.indentUseTabs ? "\t" : " ".repeat(tab.indentWidth)),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        diffGutter(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
          saveKey,
        ]),
        langCompartment.of(lang.support),
        themeCompartment.of(cmTheme(darkRef.current)),
        syntaxHighlighting(cmHighlight()),
        EditorView.editable.of(!tab.readOnly),
        EditorState.readOnly.of(tab.readOnly),
        listener,
      ];
      let state = EditorState.create({ doc: tab.content, extensions });
      const base = baselineText(tab.baseline);
      if (base) state = state.update({ effects: setDiffBaseline.of(base) }).state;
      return state;
    },
    [handleSave],
  );

  // Create the view once; populate via the swap effect below (which also runs on first commit).
  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;
    const view = new EditorView({ parent, state: EditorState.create({ doc: "" }) });
    viewRef.current = view;

    // Publish the single view so the footer's "Go to Line:Column" control can drive the caret.
    registerEditorView(view);

    // Scrolling invalidates the toolbar's anchor — drop it.
    const onScroll = () => closeToolbarRef.current();
    view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      view.scrollDOM.removeEventListener("scroll", onScroll);

      if (overviewRafRef.current !== null) cancelAnimationFrame(overviewRafRef.current);

      registerEditorView(null);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Swap state when the active tab changes or finishes loading.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `status` is the rebuild trigger — it flips loading→ready once the file loads; the body reads the live tab via getState.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const prev = prevIdRef.current;
    if (prev && prev !== activeTabId) {
      const e = cacheRef.current.get(prev);
      if (e) {
        e.state = view.state;
        e.scrollTop = view.scrollDOM.scrollTop;
      }
      closeToolbarRef.current(); // a pinned toolbar belongs to the tab we're leaving
    }
    prevIdRef.current = activeTabId;
    if (!activeTabId) {
      setOverview(EMPTY_OVERVIEW);
      return;
    }
    const tab = useEditorStore.getState().tabs[activeTabId];
    if (!tab || tab.status !== "ready") {
      setOverview(EMPTY_OVERVIEW); // overlay covers loading / error
      return;
    }
    let entry = cacheRef.current.get(activeTabId);
    if (entry && entry.reloadToken !== tab.reloadToken) {
      // The buffer was swapped underneath us (reopen-in-encoding) — discard the cached state so
      // we rebuild from the freshly-decoded content rather than restoring the old doc.
      cacheRef.current.delete(activeTabId);
      entry = undefined;
    }
    if (!entry) {
      const state = buildState(tab);
      entry = { state, scrollTop: 0, savedText: state.doc, reloadToken: tab.reloadToken };
      cacheRef.current.set(activeTabId, entry);
    }
    view.setState(entry.state);
    view.scrollDOM.scrollTop = entry.scrollTop;
    if (!tab.readOnly) view.focus();
    refreshOverviewRef.current();
  }, [activeTabId, status, buildState]);

  // Flip CodeMirror's dark flag live across the active view + every cached (inactive) state, so
  // switching themes never loses background-tab history.
  useEffect(() => {
    darkRef.current = dark;
    for (const entry of cacheRef.current.values()) {
      entry.state = entry.state.update({
        effects: themeCompartment.reconfigure(cmTheme(dark)),
      }).state;
    }
    viewRef.current?.dispatch({ effects: themeCompartment.reconfigure(cmTheme(dark)) });
  }, [dark]);

  // While the toolbar is pinned open, dismiss it on Escape or a click outside the editor.
  useEffect(() => {
    if (!openChunk) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeToolbarRef.current();
    };
    const onDocDown = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Node && wrapRef.current && !wrapRef.current.contains(t)) {
        closeToolbarRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocDown, true);
    };
  }, [openChunk]);

  // Drop cached states for tabs that were closed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `order` is the prune trigger; membership is read from the live store.
  useEffect(() => {
    const tabs = useEditorStore.getState().tabs;
    for (const id of [...cacheRef.current.keys()]) {
      if (!tabs[id]) cacheRef.current.delete(id);
    }
  }, [order]);

  const overlay = renderOverlay(activeTabId, status, blocked, errorMessage);
  const view = viewRef.current;

  // Prev/next: navigate to the neighbour block and re-anchor the pinned toolbar to it.
  const reanchor = (view: EditorView, index: number) => {
    openIdxRef.current = index;
    activeIdxRef.current = index;
    requestAnimationFrame(() => {
      const info = diffChunkInfo(view, index);
      if (info) setOpenChunk(info);
      else closeToolbar();
    });
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only affordance (gutter click opens the toolbar, hover thickens the bar); the same actions live in the dedicated Diff view.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click is event-delegation for the non-focusable gutter; the toolbar's actions are also reachable in the keyboard-accessible Diff view.
    <div
      className="pid-editor-cm-wrap"
      ref={wrapRef}
      onClick={handleWrapClick}
      onMouseMove={handleWrapMouseMove}
      onMouseLeave={handleWrapMouseLeave}
    >
      <div className="pid-editor-cm" ref={containerRef} />
      {overview.hasBaseline && view ? (
        <PidDiffMinimap marks={overview.marks} onJumpToChunk={(i) => revealDiffChunk(view, i)} />
      ) : null}
      {overlay}
      {openChunk && view ? (
        <PidDiffBlockToolbar
          info={openChunk}
          rootRef={toolbarRef}
          wrapRef={wrapRef}
          onPrev={() => reanchor(view, gotoDiffChunk(view, openChunk.index, -1))}
          onNext={() => reanchor(view, gotoDiffChunk(view, openChunk.index, 1))}
          onRevert={() => {
            revertDiffChunk(view, openChunk.index);
            closeToolbar();
          }}
          onOpenDiff={() => {
            const tab = activeTabId ? useEditorStore.getState().tabs[activeTabId] : undefined;
            if (tab) {
              useNavStore.getState().openDiff({ projectId: tab.projectId, path: tab.relPath });
            }
            closeToolbar();
          }}
        />
      ) : null}
    </div>
  );
}

function renderOverlay(
  activeTabId: string | null,
  status: string | undefined,
  blocked: "binary" | "tooLarge" | undefined,
  errorMessage: string | undefined,
): React.ReactNode {
  if (!activeTabId) return null;
  if (status === "loading") {
    return <div className="pid-editor-overlay">Loading…</div>;
  }
  if (status === "error") {
    return <div className="pid-editor-overlay error">{errorMessage ?? "Failed to open file"}</div>;
  }
  if (blocked === "binary") {
    return <div className="pid-editor-overlay">Binary file — not shown.</div>;
  }
  if (blocked === "tooLarge") {
    return <div className="pid-editor-overlay">File is too large to open in the editor.</div>;
  }
  return null;
}
