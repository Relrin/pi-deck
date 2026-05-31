import { useEffect } from "react";
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
  const fileCount = useReviewStore(selectPendingFileCount(sessionId));
  const turnCount = useReviewStore((s) => s.bySession[sessionId]?.turns.length ?? 0);
  const primeFor = useReviewStore((s) => s.primeFor);
  const openLatestTurn = useReviewStore((s) => s.openLatestTurn);

  useEffect(() => {
    void primeFor(sessionId);
  }, [sessionId, primeFor]);

  if (fileCount === 0) return null;

  const turnSuffix = turnCount > 1 ? ` · ${turnCount} turns` : "";

  return (
    <button type="button" className="pid-review-banner" onClick={() => openLatestTurn(sessionId)}>
      <span className="pid-review-banner-count">{fileCount}</span>
      <span className="pid-review-banner-label">
        file{fileCount === 1 ? "" : "s"} changed{turnSuffix}
      </span>
      <span className="pid-review-banner-cta">Review changes →</span>
    </button>
  );
}
