import { Chunk } from "@codemirror/merge";
import {
  type EditorState,
  type Extension,
  type RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
  Text,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  gutterLineClass,
} from "@codemirror/view";

/**
 * Live "dirty diff" gutter - add/modified/deleted line markers against the git HEAD
 * baseline, recomputed as the user types, plus a hover affordance: hovering a change
 * block's gutter thickens its bar and surfaces a floating toolbar (prev/next change,
 * revert, open Diff).
 *
 * The baseline (HEAD content) is set per document via `setDiffBaseline`. `null` means "no
 * baseline" (untracked file / not a repo) — no tints, no hover.
 */
export const setDiffBaseline = StateEffect.define<Text | null>();
const setActiveChunk = StateEffect.define<number | null>();

export type DiffKind = "add" | "mod" | "del";

export interface DiffChunk {
  kind: DiffKind;
  /** Replace range in the current doc (offsets). */
  fromB: number;
  toB: number;
  /** Source range in the baseline (offsets) — the content `revert` restores. */
  fromA: number;
  toA: number;
  /** Line-start offsets in the current doc this chunk decorates (its marker line for a deletion). */
  lineFroms: number[];
}

/** Geometry + identity handed to the React toolbar when a block is hovered. */
export interface DiffHoverInfo {
  index: number;
  kind: DiffKind;
  /** Client-space top of the *hovered* line (the toolbar tracks the pointer's line). */
  clientTop: number;
  /** Client-space left edge of the editor content. */
  clientLeft: number;
  /** True when the pointer is over the gutter strip (left of the content) — the trigger zone. */
  overGutter: boolean;
}

const baselineField = StateField.define<Text | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setDiffBaseline)) return e.value;
    }
    return value;
  },
});

function buildChunks(doc: Text, baseline: Text | null): DiffChunk[] {
  if (!baseline) return [];
  // A = baseline (HEAD), B = current document.
  const out: DiffChunk[] = [];
  for (const ch of Chunk.build(baseline, doc)) {
    const addedInB = ch.toB > ch.fromB;
    const removedFromA = ch.toA > ch.fromA;
    const kind: DiffKind = !addedInB && removedFromA ? "del" : removedFromA ? "mod" : "add";
    const lineFroms: number[] = [];
    if (!addedInB) {
      // Pure deletion — flag the line at the deletion point.
      lineFroms.push(doc.lineAt(Math.min(ch.fromB, doc.length)).from);
    } else {
      let pos = ch.fromB;
      const end = Math.min(ch.endB, doc.length);
      while (pos <= end) {
        const line = doc.lineAt(pos);
        lineFroms.push(line.from);
        if (line.to >= end) break;
        pos = line.to + 1;
      }
    }
    out.push({ kind, fromB: ch.fromB, toB: ch.toB, fromA: ch.fromA, toA: ch.toA, lineFroms });
  }
  return out;
}

const chunksField = StateField.define<DiffChunk[]>({
  create: (s) => buildChunks(s.doc, s.field(baselineField)),
  update(value, tr) {
    if (tr.docChanged || tr.effects.some((e) => e.is(setDiffBaseline))) {
      return buildChunks(tr.state.doc, tr.state.field(baselineField));
    }
    return value;
  },
});

const activeChunkField = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setActiveChunk)) return e.value;
    }
    // The chunk list is rebuilt on edits, so a held index would be stale.
    return tr.docChanged ? null : value;
  },
});

/**
 * Map each decorated line-start to its CSS class. One class per line-start; first chunk wins a
 * shared line (chunks don't normally overlap). The same class drives the content-line row tint
 * (via `decoField`) and the change bar in the line-number gutter (via `diffGutterMarkers`).
 */
function classByLine(chunks: readonly DiffChunk[], active: number | null): Map<number, string> {
  const byLine = new Map<number, string>();
  chunks.forEach((c, i) => {
    const cls = `pid-cm-diff-${c.kind}${i === active ? " pid-cm-diff-active" : ""}`;
    for (const from of c.lineFroms) {
      if (!byLine.has(from)) byLine.set(from, cls);
    }
  });
  return byLine;
}

function buildDeco(chunks: readonly DiffChunk[], active: number | null): DecorationSet {
  if (chunks.length === 0) return Decoration.none;
  const byLine = classByLine(chunks, active);
  const builder = new RangeSetBuilder<Decoration>();
  for (const from of [...byLine.keys()].sort((a, b) => a - b)) {
    const cls = byLine.get(from);
    if (cls) builder.add(from, from, Decoration.line({ class: cls }));
  }
  return builder.finish();
}

/** Gutter marker that tags a line-number gutter element with a diff class (drives the `::after`
 * change bar). The bar is anchored to the gutter's right edge so it thickens toward the number. */
class DiffGutterMarker extends GutterMarker {
  override elementClass: string;
  constructor(cls: string) {
    super();
    this.elementClass = cls;
  }
}

function buildGutterMarkers(
  chunks: readonly DiffChunk[],
  active: number | null,
): RangeSet<GutterMarker> {
  const byLine = classByLine(chunks, active);
  const builder = new RangeSetBuilder<GutterMarker>();
  for (const from of [...byLine.keys()].sort((a, b) => a - b)) {
    const cls = byLine.get(from);
    if (cls) builder.add(from, from, new DiffGutterMarker(cls));
  }
  return builder.finish();
}

/** Adds the diff class to the *line-number gutter* element of each changed line, so the change
 * bar renders inside the gutter (the clickable hover/trigger zone) rather than over the code. */
const diffGutterMarkers = gutterLineClass.compute([chunksField, activeChunkField], (state) =>
  buildGutterMarkers(state.field(chunksField), state.field(activeChunkField)),
);

const decoField = StateField.define<DecorationSet>({
  create: (s) => buildDeco(s.field(chunksField), s.field(activeChunkField)),
  update(value, tr) {
    const touched = tr.effects.some((e) => e.is(setDiffBaseline) || e.is(setActiveChunk));
    if (tr.docChanged || touched) {
      return buildDeco(tr.state.field(chunksField), tr.state.field(activeChunkField));
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Revert a chunk in the buffer (undoable): replace its current lines with the HEAD version. */
export function revertDiffChunk(view: EditorView, index: number): void {
  const chunks = view.state.field(chunksField);
  const baseline = view.state.field(baselineField);
  const c = chunks[index];
  if (!c || !baseline) return;
  const docLen = view.state.doc.length;
  const insert = baseline.sliceString(
    Math.min(c.fromA, baseline.length),
    Math.min(c.toA, baseline.length),
  );
  view.dispatch({
    changes: { from: Math.min(c.fromB, docLen), to: Math.min(c.toB, docLen), insert },
    userEvent: "revert",
  });
}

/** Select + centre-scroll to a specific chunk and mark it active (no-op for a bad index). */
export function revealDiffChunk(view: EditorView, index: number): void {
  const c = view.state.field(chunksField)[index];
  if (!c) return;
  const pos = c.lineFroms[0] ?? c.fromB;
  view.dispatch({
    selection: { anchor: pos },
    effects: [setActiveChunk.of(index), EditorView.scrollIntoView(pos, { y: "center" })],
  });
}

/** Move selection + scroll to the prev/next chunk (wrapping). Returns the new chunk index. */
export function gotoDiffChunk(view: EditorView, fromIndex: number, dir: -1 | 1): number {
  const chunks = view.state.field(chunksField);
  if (chunks.length === 0) return -1;
  let idx = fromIndex + dir;
  if (idx < 0) idx = chunks.length - 1;
  if (idx >= chunks.length) idx = 0;
  revealDiffChunk(view, idx);
  return idx;
}

/** Current geometry of a chunk for positioning the toolbar, or null if off-screen. */
export function diffChunkInfo(view: EditorView, index: number): DiffHoverInfo | null {
  const chunks = view.state.field(chunksField);
  const c = chunks[index];
  if (!c) return null;
  const pos = c.lineFroms[0] ?? c.fromB;
  const coords = view.coordsAtPos(pos);
  if (!coords) return null;
  const contentRect = view.contentDOM.getBoundingClientRect();
  return {
    index,
    kind: c.kind,
    clientTop: coords.top,
    clientLeft: contentRect.left,
    overGutter: false,
  };
}

/** Mark a chunk as hovered (thickens its bar), or clear with `null`. Cheap to call repeatedly —
 * dispatch only when the value actually changes (the caller guards this). */
export function setActiveDiffChunk(view: EditorView, index: number | null): void {
  view.dispatch({ effects: setActiveChunk.of(index) });
}

/**
 * Resolve the chunk under a pointer position for the React hover handler. Returns the chunk whose
 * *row* the pointer's Y is on (so the toolbar can be reached by moving horizontally along the
 * row), the hovered line's top (the toolbar tracks the pointer's line), and whether the pointer is
 * over the gutter strip (the trigger zone). `null` when no baseline or not on a changed line.
 */
export function diffHoverAt(
  view: EditorView,
  clientX: number,
  clientY: number,
): DiffHoverInfo | null {
  const chunks = view.state.field(chunksField);
  if (chunks.length === 0) return null;
  const contentRect = view.contentDOM.getBoundingClientRect();
  // Map by Y only (probe just inside the content) so any X on the row resolves the same line.
  const pos = view.posAtCoords({ x: contentRect.left + 1, y: clientY });
  if (pos == null) return null;
  const line = view.state.doc.lineAt(pos);
  const index = chunks.findIndex((c) => c.lineFroms.includes(line.from));
  if (index < 0) return null;
  const coords = view.coordsAtPos(line.from);
  return {
    index,
    kind: chunks[index]?.kind ?? "mod",
    clientTop: coords ? coords.top : clientY,
    clientLeft: contentRect.left,
    overGutter: clientX < contentRect.left,
  };
}

/** One change block, projected onto a 0..1 vertical axis for the diff overview ruler (minimap). */
export interface DiffOverviewMark {
  index: number;
  kind: DiffKind;
  /** Fraction [0,1] down the document where the block starts (by line number). */
  top: number;
  /** Fraction of the document the block spans; tiny blocks are floored by the ruler's CSS. */
  size: number;
}

/** Snapshot for the diff overview ruler: whether the file is tracked (has a HEAD baseline) and
 * the per-block marks. Line-based (not pixel-based) so it's independent of scroll + wrapping. */
export interface DiffOverview {
  hasBaseline: boolean;
  marks: DiffOverviewMark[];
}

/** Project the current chunk set onto document-fraction marks for the overview ruler. */
export function diffOverview(state: EditorState): DiffOverview {
  const hasBaseline = state.field(baselineField) !== null;
  const { doc } = state;
  const total = Math.max(doc.lines, 1);
  const marks = state.field(chunksField).map((c, index): DiffOverviewMark => {
    const startLine = doc.lineAt(c.lineFroms[0] ?? Math.min(c.fromB, doc.length)).number;
    const lineCount = Math.max(c.lineFroms.length, 1);
    return { index, kind: c.kind, top: (startLine - 1) / total, size: lineCount / total };
  });
  return { hasBaseline, marks };
}

/** Assemble the diff extension. Field order matters: baseline → chunks → active → deco. */
export function diffGutter(): Extension {
  return [baselineField, chunksField, activeChunkField, decoField, diffGutterMarkers];
}

/** Build a CodeMirror `Text` from LF-separated HEAD content (or `null` when there's no baseline). */
export function baselineText(content: string | null): Text | null {
  return content === null ? null : Text.of(content.split("\n"));
}
