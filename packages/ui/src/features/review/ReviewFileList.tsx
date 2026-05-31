import type { ReviewTurn } from "@pi-deck/core/protocol/commands.js";
import { Check, X } from "lucide-react";
import { PidIconButton } from "../../components/buttons/PidIconButton.js";

interface ReviewFileListProps {
  turn: ReviewTurn;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onAcceptFile: (path: string) => void;
  onRejectFile: (path: string) => void;
}

/**
 * Left column inside the `ReviewPanel` modal. One row per file in the turn with the
 * status pill (A/M/D), repo-relative path, and hover-revealed per-file accept/reject
 * icon buttons. Rows are clickable as a whole so keyboard users land on the file
 * straight away; the inline accept/reject buttons stop propagation so a stray click
 * doesn't both reject and re-select the row.
 */
export function ReviewFileList({
  turn,
  selectedPath,
  onSelect,
  onAcceptFile,
  onRejectFile,
}: ReviewFileListProps) {
  return (
    <aside className="pid-review-files" aria-label="Files in this turn">
      {turn.files.map((file) => {
        const isActive = file.path === selectedPath;
        return (
          <div
            key={file.path}
            className="pid-review-file-row"
            data-status={file.status}
            data-active={isActive || undefined}
          >
            <button
              type="button"
              className="pid-review-file-button"
              onClick={() => onSelect(file.path)}
            >
              <span className="pid-review-file-status">{file.status}</span>
              <span className="pid-review-file-path" title={file.path}>
                {file.path}
              </span>
            </button>
            <span className="pid-review-file-actions">
              <PidIconButton
                icon={<X size={12} />}
                label={`Reject ${file.path}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRejectFile(file.path);
                }}
              />
              <PidIconButton
                icon={<Check size={12} />}
                label={`Accept ${file.path}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onAcceptFile(file.path);
                }}
              />
            </span>
          </div>
        );
      })}
    </aside>
  );
}
