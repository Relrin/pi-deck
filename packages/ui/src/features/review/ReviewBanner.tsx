import { useEffect } from "react";
import { useI18nContext } from "../../i18n/i18n-react.js";
import { selectPendingFileCount, useReviewStore } from "./useReviewStore.js";

interface ReviewBannerProps {
  sessionId: string;
}

/**
 * Slim banner mounted between `<MessageList>` and `<MessageInput>` in `ChatView`. Shows
 * a count of files awaiting review for the active session and opens the `ReviewPanel`
 * modal on click. Self-hides when there's nothing pending — no layout shift when the
 * store is empty.
 *
 * Primes the review store on mount so a renderer restart picks up turns the host
 * still has in memory. Event pushes (`review.available` / `review.cleared`) keep it
 * in sync afterwards.
 */
export function ReviewBanner({ sessionId }: ReviewBannerProps) {
  const { LL } = useI18nContext();
  const fileCount = useReviewStore(selectPendingFileCount(sessionId));
  const turnCount = useReviewStore((s) => s.bySession[sessionId]?.turns.length ?? 0);
  const primeFor = useReviewStore((s) => s.primeFor);
  const openLatestTurn = useReviewStore((s) => s.openLatestTurn);

  useEffect(() => {
    void primeFor(sessionId);
  }, [sessionId, primeFor]);

  if (fileCount === 0) return null;

  // Rendered as two siblings rather than one interpolated string: typesafe-i18n trims interpolated
  // argument values, so the suffix's leading " · " would be eaten if it were passed as a parameter.
  const turnSuffix = turnCount > 1 ? LL.chat.review.turnSuffix({ count: turnCount }) : "";

  return (
    <button type="button" className="pid-review-banner" onClick={() => openLatestTurn(sessionId)}>
      <span className="pid-review-banner-count">{fileCount}</span>
      <span className="pid-review-banner-label">
        {LL.chat.review.filesChanged({ count: fileCount })}
        {turnSuffix}
      </span>
      <span className="pid-review-banner-cta">Review changes →</span>
    </button>
  );
}
