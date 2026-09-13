/**
 * Strings for `features/diff/`.
 *
 * Pierre's own diff chrome and the theme names in `features/diff/diffThemes.ts` are **not** here:
 * the first is third-party UI (a documented English island) and the second are proper nouns.
 */
const diff = {
  /** Commit button label once files are selected. */
  commitFiles: "commit · {count:number} {{file|files}}",
  revertAllConfirm:
    "This reverts {count:number} {{file|files}} to HEAD (untracked files are removed). This can't be undone.",

  /** `DiffTab.tsx`'s three states before a diff can be shown. */
  tab: {
    pickFile: "Pick a file in the git sidebar to view its diff.",
    loading: "Loading diff…",
    noChanges: "No changes vs HEAD.",
  },

  /** `DiffNavToolbar.tsx`. Each control's tooltip and accessible name are the same string. */
  nav: {
    label: "Diff navigation",
    prevDiff: "Previous diff",
    nextDiff: "Next diff",
    jumpToSource: "Jump to source",
    prevFile: "Compare previous file",
    nextFile: "Compare next file",
  },

  /**
   * `DiffToolbar.tsx`.
   *
   * The layout and background toggles each carry **two whole keys** rather than one key with the
   * mode spliced in. The English read naturally as `Switch to {unified} layout`, but a translation
   * that has to decline or reorder the mode word cannot work from a substituted fragment — and the
   * resulting English is byte-identical either way, so a passing test proves nothing here.
   */
  toolbar: {
    label: "Diff display options",
    switchToUnified: "Switch to unified layout",
    switchToSplit: "Switch to side-by-side layout",
    layoutSplitTitle: "Side-by-side layout · click for unified",
    layoutUnifiedTitle: "Unified layout · click for side-by-side",
    backgroundDisable: "Disable row backgrounds",
    backgroundEnable: "Enable row backgrounds",
    backgroundOnTitle: "Row backgrounds on · click to hide",
    backgroundOffTitle: "Row backgrounds off · click to show",
    highlight: "Inline change highlight algorithm",
    /** Pierre's wire value `char` surfaces as "Character"; `value` stays the wire value. */
    lineDiff: {
      wordAlt: { label: "Word-Alt", description: "Highlight entire words with enhanced algorithm" },
      word: { label: "Word", description: "Highlight changed words within lines" },
      char: { label: "Character", description: "Highlight individual character changes" },
      none: { label: "None", description: "Show line-level changes only" },
    },
  },

  /** `DiffChangesetHeader.tsx` — the ad-hoc review route's header. */
  changeset: {
    eyebrow: "review · changeset",
    fileCount: "{count:number} {{file|files}}",
    revertAll: "revert all",
    revertAllNothing: "Nothing to revert",
    revertAllTitle: "Discard every working-tree change against HEAD",
    stageHunks: "stage hunks",
    stageNothing: "Nothing to stage",
    stageTitle: "Select every changed file for the next commit",
    commit: "commit",
    commitNothing: "No changes to commit",
    commitTitle: "Jump to the commit composer",
    confirmTitle: "Discard all working-tree changes?",
    confirmLabel: "Discard all",
  },
} as const;

export default diff;
