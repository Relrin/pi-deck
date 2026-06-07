import { Chunk } from "@codemirror/merge";
import { type Extension, RangeSetBuilder, StateEffect, StateField, Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

/**
 * Live "dirty diff" gutter tints - add/modified/deleted line markers against the git HEAD
 * baseline, recomputed as the user types. Unlike `@codemirror/merge`'s merge views we
 * don't render the original content inline; we only borrow its `Chunk` diff primitive and paint
 * our own line decorations (a left bar + a faint row tint, using the `--add/--mod/--del` tokens).
 *
 * The baseline (HEAD content) is set per document via `setDiffBaseline`. `null` means "no
 * baseline" (untracked file / not a repo) — we show no tints rather than flooding the gutter.
 */
export const setDiffBaseline = StateEffect.define<Text | null>();

type LineKind = "add" | "mod" | "del";

const lineDeco: Record<LineKind, Decoration> = {
  add: Decoration.line({ class: "pid-cm-diff-add" }),
  mod: Decoration.line({ class: "pid-cm-diff-mod" }),
  del: Decoration.line({ class: "pid-cm-diff-del" }),
};

const baselineField = StateField.define<Text | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setDiffBaseline)) return e.value;
    }
    return value;
  },
});

function computeDeco(doc: Text, baseline: Text | null): DecorationSet {
  if (!baseline) return Decoration.none;
  // A = baseline (HEAD), B = current document.
  const chunks = Chunk.build(baseline, doc);
  // Collapse to one kind per line of the current doc; dedupe keeps the RangeSetBuilder ordering
  // happy and avoids stacking a deletion + change marker on the same line.
  const byLineStart = new Map<number, LineKind>();
  const mark = (from: number, kind: LineKind): void => {
    const existing = byLineStart.get(from);
    // Precedence mod > add > del so a changed line wins over an adjacent deletion marker.
    if (existing === "mod") return;
    if (existing === "add" && kind === "del") return;
    byLineStart.set(from, kind);
  };

  for (const ch of chunks) {
    const addedInB = ch.toB > ch.fromB;
    const removedFromA = ch.toA > ch.fromA;
    if (!addedInB) {
      // Pure deletion — nothing occupies these lines in the current doc. Flag the line at the
      // deletion point so the gutter shows where content was removed.
      if (removedFromA) {
        const line = doc.lineAt(Math.min(ch.fromB, doc.length));
        mark(line.from, "del");
      }
      continue;
    }
    const kind: LineKind = removedFromA ? "mod" : "add";
    let pos = ch.fromB;
    const end = Math.min(ch.endB, doc.length);
    while (pos <= end) {
      const line = doc.lineAt(pos);
      mark(line.from, kind);
      if (line.to >= end) break;
      pos = line.to + 1;
    }
  }

  const builder = new RangeSetBuilder<Decoration>();
  for (const from of [...byLineStart.keys()].sort((a, b) => a - b)) {
    const kind = byLineStart.get(from);
    if (kind) builder.add(from, from, lineDeco[kind]);
  }
  return builder.finish();
}

const diffField = StateField.define<DecorationSet>({
  create(state) {
    return computeDeco(state.doc, state.field(baselineField));
  },
  update(value, tr) {
    const baselineChanged = tr.effects.some((e) => e.is(setDiffBaseline));
    if (tr.docChanged || baselineChanged) {
      return computeDeco(tr.state.doc, tr.state.field(baselineField));
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** The diff extension. `baselineField` must precede `diffField` so it updates first. */
export function diffGutter(): Extension {
  return [baselineField, diffField];
}

/** Build a CodeMirror `Text` from LF-separated HEAD content (or `null` when there's no baseline). */
export function baselineText(content: string | null): Text | null {
  return content === null ? null : Text.of(content.split("\n"));
}
