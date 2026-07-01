import { useState } from "react";
import { PidIconButton } from "../../../components/buttons/PidIconButton.js";
import { ConfirmDialog } from "../../../components/dialogs/ConfirmDialog.js";
import { Copy, GitBranch, Undo2 } from "../../../components/icons/index.js";
import { Tooltip } from "../../../components/ui/Tooltip.js";
import { writeClipboard } from "../../../lib/clipboard.js";
import { stripMarkdown } from "../../../lib/markdown-strip.js";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";
import { selectTurnInFlight, useMessagesStore } from "../useMessagesStore.js";

interface MessageActionsProps {
  sessionId: string;
  /** Raw message text copied by the Copy action (markdown stripped). */
  text: string;
  /**
   * 0-based index of the user message this bubble anchors to — its own for a user bubble, the
   * originating user message for an assistant bubble. `undefined` (e.g. an assistant reply
   * before any user turn) disables Rewind/Fork.
   */
  userMessageIndex?: number;
}

/**
 * Hover-revealed action row under a chat bubble: Copy always, plus Rewind/Fork which anchor to
 * the turn's user message. Rewind is destructive (discards later conversation + uncommitted file
 * edits) so it goes through a confirm dialog; both branch actions are disabled mid-stream because
 * pi's tree can't move while a turn is in flight.
 */
export function MessageActions({ sessionId, text, userMessageIndex }: MessageActionsProps) {
  const notifyError = useNotificationStore((s) => s.error);
  const streaming = useMessagesStore(selectTurnInFlight(sessionId));
  const rewindToMessage = useSessionsStore((s) => s.rewindToMessage);
  const forkFromMessage = useSessionsStore((s) => s.forkFromMessage);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasAnchor = userMessageIndex !== undefined;
  const canBranch = hasAnchor && !streaming;
  const branchHint = streaming
    ? "Unavailable while streaming"
    : !hasAnchor
      ? "No earlier point to branch from"
      : undefined;

  const onCopy = () => {
    writeClipboard(stripMarkdown(text)).catch(() => notifyError("Failed to copy"));
  };

  return (
    <>
      <div className="pid-msg-actions">
        <Tooltip content="Copy message">
          <PidIconButton icon={<Copy size={12} />} label="Copy message" onClick={onCopy} />
        </Tooltip>
        <Tooltip content={branchHint ?? "Rewind to here"}>
          <PidIconButton
            icon={<Undo2 size={12} />}
            label="Rewind to here"
            disabled={!canBranch}
            onClick={() => setConfirmOpen(true)}
          />
        </Tooltip>
        <Tooltip content={branchHint ?? "Fork from here"}>
          <PidIconButton
            icon={<GitBranch size={12} />}
            label="Fork from here"
            disabled={!canBranch}
            onClick={() => {
              if (userMessageIndex !== undefined) void forkFromMessage(sessionId, userMessageIndex);
            }}
          />
        </Tooltip>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Rewind to here?"
        description="The conversation and any file changes made after this message will be discarded. Later uncommitted edits can't be recovered."
        confirmLabel="Rewind"
        destructive
        onConfirm={() => {
          if (userMessageIndex !== undefined) return rewindToMessage(sessionId, userMessageIndex);
        }}
      />
    </>
  );
}
