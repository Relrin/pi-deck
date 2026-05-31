import type { DiffLineAnnotation } from "@pierre/diffs/react";
import { PatchDiff } from "@pierre/diffs/react";
import { useMemo } from "react";
import { usePreferencesStore } from "../../theme/usePreferencesStore.js";
import type { DiffLayout } from "./useDiffSettingsStore.js";
import { usePierreTheme } from "./usePierreTheme.js";

export interface DiffViewProps {
  /** Unified diff text — i.e. the output of `git diff`. */
  unified: string;
  layout: DiffLayout;
  wordHighlight: boolean;
  /** Optional Pierre annotations (one-per-line metadata used for review comments) */
  annotations?: DiffLineAnnotation<unknown>[];
  /** Force a specific Pierre/Shiki theme name */
  themeOverride?: string;
  className?: string;
}

/**
 * Thin React wrapper around `@pierre/diffs`'s `PatchDiff`. Maps toolbar/preference
 * state onto Pierre's options shape and forwards the rest verbatim. The wrapper is
 * intentionally pure — it doesn't fetch its own data, doesn't own the toolbar, and
 * doesn't read from a session store. Callers in `DiffTab` and `ReviewPanel` pass in
 * what they want rendered; this component is the single place Pierre is configured.
 *
 * The line-style preference maps onto Pierre's built-in `diffIndicators` /
 * `disableBackground` knobs (no custom CSS overrides needed):
 *
 *   - `filled`  → coloured row backgrounds, `+`/`−` markers in the gutter.
 *   - `markers` → no backgrounds, classic gutter markers carry all the signal.
 *   - `bar`     → no backgrounds, thin coloured strip at the start of changed rows.
 */
export function DiffView({
  unified,
  layout,
  wordHighlight,
  annotations,
  themeOverride,
  className,
}: DiffViewProps) {
  const derivedTheme = usePierreTheme();
  const theme = themeOverride ?? derivedTheme;
  const indicators = usePreferencesStore((s) => s.diffIndicators);
  const background = usePreferencesStore((s) => s.diffBackground);
  const lineNumbers = usePreferencesStore((s) => s.diffLineNumbers);
  const lineWrap = usePreferencesStore((s) => s.diffLineWrap);

  const options = useMemo(
    () => ({
      theme,
      diffStyle: layout,
      // Forward Pierre's own vocabulary verbatim for the gutter style; the row
      // background is an independent preference (Settings → Git & GitHub).
      diffIndicators: indicators,
      disableBackground: !background,
      disableLineNumbers: !lineNumbers,
      overflow: lineWrap ? ("wrap" as const) : ("scroll" as const),
      lineDiffType: wordHighlight ? ("word" as const) : ("none" as const),
      // Sticky file header inside the Pierre viewer; matches the mockup's "file path
      // pinned to the top of the diff column" look.
      stickyHeader: true,
      // Pierre's own header is redundant — DiffTab / ReviewPanel render their own.
      disableFileHeader: true,
    }),
    [theme, layout, indicators, background, lineNumbers, lineWrap, wordHighlight],
  );

  return (
    <PatchDiff
      patch={unified}
      options={options}
      lineAnnotations={annotations}
      className={className}
    />
  );
}
