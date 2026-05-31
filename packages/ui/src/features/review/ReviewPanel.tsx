import type { CommandResponse } from "@pi-deck/core/protocol/commands.js";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PidButton } from "../../components/buttons/PidButton.js";
import { PidIconButton } from "../../components/buttons/PidIconButton.js";
import { PidChip } from "../../components/chip/PidChip.js";
import { DiffToolbar } from "../diff/DiffToolbar.js";
import { DiffView } from "../diff/DiffView.js";
import { useDiffSettingsStore } from "../diff/useDiffSettingsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { ReviewFileList } from "./ReviewFileList.js";
import { selectOpenTurn, useReviewStore } from "./useReviewStore.js";

interface ReviewPanelProps {
  sessionId: string;
}

type DiffPayload = CommandResponse<"diff.get">;

/**
 * A wide modal that PR-style reviews a single turn's changes. Mounted from
 * `ChatView` once per session — it self-hides when no turn is open. The two-column
 * layout puts the per-file list on the left and the Pierre-powered diff on the right;
 * the header carries Accept all / Reject all buttons that operate on the whole turn.
 *
 * The modal uses the existing `.pid-modal-backdrop` + `.pid-modal` chrome with a
 * `data-size="wide"` variant added in `components.css` because the default 720px width
 * is too narrow for side-by-side diff rendering.
 */
export function ReviewPanel({ sessionId }: ReviewPanelProps) {
  const turn = useReviewStore(selectOpenTurn(sessionId));
  const selectedPath = useReviewStore((s) => s.bySession[sessionId]?.selectedPath ?? null);
  const closePanel = useReviewStore((s) => s.closePanel);
  const selectFile = useReviewStore((s) => s.selectFile);
  const acceptTurn = useReviewStore((s) => s.acceptTurn);
  const rejectTurn = useReviewStore((s) => s.rejectTurn);
  const acceptFile = useReviewStore((s) => s.acceptFile);
  const rejectFile = useReviewStore((s) => s.rejectFile);

  const open = turn !== null;

  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closePanel(sessionId);
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="pid-modal-backdrop" />
        <RadixDialog.Content className="pid-modal" data-size="wide" aria-describedby={undefined}>
          {turn ? (
            <ReviewPanelBody
              sessionId={sessionId}
              turn={turn}
              selectedPath={selectedPath}
              onSelectFile={(path) => selectFile(sessionId, path)}
              onAcceptTurn={() => void acceptTurn(sessionId, turn.turnId)}
              onRejectTurn={() => void rejectTurn(sessionId, turn.turnId)}
              onAcceptFile={(path) => void acceptFile(sessionId, turn.turnId, path)}
              onRejectFile={(path) => void rejectFile(sessionId, turn.turnId, path)}
              onClose={() => closePanel(sessionId)}
            />
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

interface ReviewPanelBodyProps {
  sessionId: string;
  turn: NonNullable<ReturnType<ReturnType<typeof selectOpenTurn>>>;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onAcceptTurn: () => void;
  onRejectTurn: () => void;
  onAcceptFile: (path: string) => void;
  onRejectFile: (path: string) => void;
  onClose: () => void;
}

function ReviewPanelBody({
  turn,
  selectedPath,
  onSelectFile,
  onAcceptTurn,
  onRejectTurn,
  onAcceptFile,
  onRejectFile,
  onClose,
}: ReviewPanelBodyProps) {
  const client = useSessionsStore((s) => s.client);
  const layout = useDiffSettingsStore((s) => s.layout);
  const wordHighlight = useDiffSettingsStore((s) => s.wordHighlight);

  const [diff, setDiff] = useState<DiffPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !selectedPath) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setDiff(null);
    const baseline = turn.stashSha
      ? ({ kind: "stash", sha: turn.stashSha } as const)
      : ("HEAD" as const);
    client
      .call("diff.get", {
        projectId: turn.projectId,
        path: selectedPath,
        baseline,
      })
      .then((result) => {
        if (cancelled) return;
        setDiff(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [client, selectedPath, turn.projectId, turn.stashSha]);

  return (
    <>
      <div className="pid-modal-header pid-review-panel-header">
        <RadixDialog.Title className="pid-modal-title">Review changes</RadixDialog.Title>
        <PidChip>
          {turn.files.length} file{turn.files.length === 1 ? "" : "s"}
        </PidChip>
        <span className="pid-review-panel-header-spacer" />
        <PidButton variant="ghost" icon={<X size={12} />} onClick={onRejectTurn}>
          Reject all
        </PidButton>
        <PidButton variant="primary" icon={<Check size={12} />} onClick={onAcceptTurn}>
          Accept all
        </PidButton>
        <PidIconButton icon={<X size={14} />} label="Close review" onClick={onClose} />
      </div>
      <div className="pid-modal-body pid-review-panel-body">
        <ReviewFileList
          turn={turn}
          selectedPath={selectedPath}
          onSelect={onSelectFile}
          onAcceptFile={onAcceptFile}
          onRejectFile={onRejectFile}
        />
        <section className="pid-review-panel-diff">
          <div className="pid-review-panel-diff-head">
            {selectedPath ? (
              <span className="pid-diff-tab-path" title={selectedPath}>
                {selectedPath}
              </span>
            ) : (
              <span className="pid-mono-label">select a file</span>
            )}
            <span className="pid-review-panel-header-spacer" />
            <DiffToolbar />
          </div>
          <div className="pid-review-panel-diff-body">
            {!selectedPath ? null : error ? (
              <div className="pid-route-placeholder">
                <span>{error}</span>
              </div>
            ) : diff === null ? (
              <div className="pid-route-placeholder">
                <span>Loading diff…</span>
              </div>
            ) : (
              <DiffView unified={diff.unified} layout={layout} wordHighlight={wordHighlight} />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
