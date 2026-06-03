import type { FileDiffMetadata } from "@pierre/diffs";
import { type DiffLineAnnotation, FileDiff, PatchDiff } from "@pierre/diffs/react";
import { useEffect, useMemo, useState } from "react";
import {
  type DiffLayout,
  type DiffLineDiffType,
  usePreferencesStore,
} from "../../theme/usePreferencesStore.js";
import { usePierreTheme } from "./usePierreTheme.js";

export interface DiffViewProps {
  /** Unified diff text — i.e. the output of `git diff`. Mutually exclusive with `fileDiff`. */
  unified?: string;
  /**
   * Pre-parsed diff metadata (e.g. from `parseDiffFromFile`) — used when the source is two
   * file contents rather than a patch string, as for the chat edit/write cards. Mutually
   * exclusive with `unified`.
   */
  fileDiff?: FileDiffMetadata;
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
   * The prop for the Settings preview cards keep type-checking.
   */
  forPreview?: boolean;
  className?: string;
}

/**
 * Thin React wrapper around `@pierre/diffs`'s `PatchDiff` / `FileDiff`. Maps the global diff
 * preferences (Settings → Git & GitHub + the per-screen toolbar) onto Pierre's `options`
 * shape. Layout, line-diff type, background, and the rest are pulled directly from
 * `usePreferencesStore`; only the diff source and (optional) per-call overrides for preview
 * cards arrive via props.
 */
export function DiffView({
  unified,
  fileDiff,
  annotations,
  themeOverride,
  layoutOverride,
  lineDiffTypeOverride,
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

  // The Shiki highlighter loads its theme + each language grammar lazily and doesn't notify
  // when a load finishes, so the first render of a not-yet-loaded language paints plain. Bump
  // a token a few times over the warm-up window; combined with the `key` below it remounts the
  // viewer, and the remount that lands after the load renders coloured. Once a language is
  // loaded these remounts are no-ops (the highlighter is cached process-wide).
  const [retryToken, setRetryToken] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `theme` is the remount/reset signal.
  useEffect(() => {
    const delays = [50, 200, 600, 1200];
    const timers = delays.map((ms) => setTimeout(() => setRetryToken((t) => t + 1), ms));
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [theme]);

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
  const key = `diff-${retryToken}-${themeKey}`;

  // `fileDiff` (parsed from two file contents) and `unified` (a patch string) are two ways to
  // feed the same viewer; both share the option/annotation plumbing above. The worker pool is
  // disabled for both — see the component doc comment.
  if (fileDiff) {
    return (
      <FileDiff
        key={key}
        fileDiff={fileDiff}
        options={options}
        lineAnnotations={annotations}
        disableWorkerPool
        className={className}
      />
    );
  }

  return (
    <PatchDiff
      key={key}
      patch={unified ?? ""}
      options={options}
      lineAnnotations={annotations}
      disableWorkerPool
      className={className}
    />
  );
}
