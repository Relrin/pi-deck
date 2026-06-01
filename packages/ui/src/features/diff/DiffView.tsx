import { type DiffLineAnnotation, PatchDiff, useWorkerPool } from "@pierre/diffs/react";
import { useEffect, useMemo, useState } from "react";
import {
  type DiffLayout,
  type DiffLineDiffType,
  usePreferencesStore,
} from "../../theme/usePreferencesStore.js";
import { usePierreTheme } from "./usePierreTheme.js";

export interface DiffViewProps {
  /** Unified diff text — i.e. the output of `git diff`. */
  unified: string;
  /** Optional Pierre annotations (one-per-line metadata used for review comments) */
  annotations?: DiffLineAnnotation<unknown>[];
  /** Force a specific Pierre/Shiki theme name */
  themeOverride?: string;
  /** Force a specific layout — used by the Settings → Git & GitHub preview cards where
   * we want a deterministic shape regardless of the user's current preference. */
  layoutOverride?: DiffLayout;
  /** Force a specific inline-highlight algorithm — same use case as `layoutOverride`. */
  lineDiffTypeOverride?: DiffLineDiffType;
  /**
   * When `true`, disable Pierre's shared worker pool and render the view
   * synchronously in-process.
   */
  forPreview?: boolean;
  className?: string;
}

/**
 * Thin React wrapper around `@pierre/diffs`'s `PatchDiff`. Maps the global diff
 * preferences (Settings → Git & GitHub + the per-screen toolbar) onto Pierre's
 * `options` shape. Layout, line-diff type, background, and the rest are pulled
 * directly from `usePreferencesStore`; only the patch text and (optional) per-call
 * overrides for preview cards arrive via props.
 *
 * The line-style preference maps onto Pierre's built-in `diffIndicators` /
 * `disableBackground` knobs (no custom CSS overrides needed):
 *
 *   - `bars`    → no backgrounds, thin coloured strip at the start of changed rows.
 *   - `classic` → coloured row backgrounds, `+`/`−` markers in the gutter.
 *   - `none`    → no backgrounds, no markers.
 */
export function DiffView({
  unified,
  annotations,
  themeOverride,
  layoutOverride,
  lineDiffTypeOverride,
  forPreview = false,
  className,
}: DiffViewProps) {
  const derivedTheme = usePierreTheme();
  const theme = themeOverride ?? derivedTheme;
  const indicators = usePreferencesStore((s) => s.diffIndicators);
  const background = usePreferencesStore((s) => s.diffBackground);
  const lineNumbers = usePreferencesStore((s) => s.diffLineNumbers);
  const lineWrap = usePreferencesStore((s) => s.diffLineWrap);
  const layoutPref = usePreferencesStore((s) => s.diffLayout);
  const lineDiffTypePref = usePreferencesStore((s) => s.diffLineDiffType);
  const layout = layoutOverride ?? layoutPref;
  const lineDiffType = lineDiffTypeOverride ?? lineDiffTypePref;

  const poolManager = useWorkerPool();
  useEffect(() => {
    if (forPreview || !poolManager) return;
    void poolManager.setRenderOptions({ theme: derivedTheme });
  }, [forPreview, poolManager, derivedTheme]);

  // Pierre's synchronous (no-worker-pool) render path lazy-loads the Shiki
  // highlighter but doesn't notify when the load completes — see DiffHunksRenderer
  // `hydrate()` calling `initializeHighlighter()` without an `await` or callback.
  const [retryToken, setRetryToken] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `theme` is the remount signal.
  useEffect(() => {
    if (!forPreview) return;
    const delays = [50, 200, 600];
    const timers = delays.map((ms) => setTimeout(() => setRetryToken((t) => t + 1), ms));
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [forPreview, theme]);

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
      lineDiffType,
      // Sticky file header inside the Pierre viewer; matches the mockup's "file path
      // pinned to the top of the diff column" look.
      stickyHeader: true,
      // Pierre's own header is redundant — DiffTab / ReviewPanel render their own.
      disableFileHeader: true,
    }),
    [theme, layout, indicators, background, lineNumbers, lineWrap, lineDiffType],
  );

  const themeKey = typeof theme === "string" ? theme : `${theme.light}|${theme.dark}`;

  return (
    <PatchDiff
      key={forPreview ? `preview-${retryToken}-${themeKey}` : undefined}
      patch={unified}
      options={options}
      lineAnnotations={annotations}
      disableWorkerPool={forPreview}
      className={className}
    />
  );
}
