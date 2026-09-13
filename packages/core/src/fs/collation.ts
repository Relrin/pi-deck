/**
 * Ordering for file and directory names, shared by every surface that sorts them.
 *
 * **The locale is pinned to "en" on purpose, and must stay pinned.** Path ordering is a stable-sort
 * concern, not a presentation one. With the platform default (`undefined`, which is what
 * `String.prototype.localeCompare` and `new Intl.Collator()` fall back to) the comparator follows
 * whatever locale the *process* happens to run in — so the git changes list and the diff navigator
 * would silently reshuffle mid-review the moment the user switches interface language.
 *
 * It also keeps the host and the renderer in agreement. `fs/walker.ts` produces the initial tree
 * order in the host process while `features/files/useFileTreeStore.ts` re-sorts it in the renderer,
 * and `host/fs-watch-manager.ts` splices watch events into that order. If the host's OS locale and
 * the UI locale disagreed, an inserted node would land in a different slot than a full re-walk puts
 * it, and the tree would visibly jitter.
 *
 * `numeric` gives natural order (`file2` before `file10`); `sensitivity: "base"` makes it
 * case-insensitive, matching the conventional explorer layout.
 *
 * This module deliberately imports nothing — it is bundled into the renderer.
 */
export const PATH_COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** `PATH_COLLATOR.compare`, pre-bound for use directly as a sort comparator. */
export const comparePaths: (a: string, b: string) => number =
  PATH_COLLATOR.compare.bind(PATH_COLLATOR);
