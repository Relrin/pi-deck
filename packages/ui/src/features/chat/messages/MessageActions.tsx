import { useState } from "react";
import { PidIconButton } from "../../../components/buttons/PidIconButton.js";
import { ConfirmDialog } from "../../../components/dialogs/ConfirmDialog.js";
import { Copy, GitBranch, Undo2 } from "../../../components/icons/index.js";
import { Tooltip } from "../../../components/ui/Tooltip.js";
import { useI18nContext } from "../../../i18n/i18n-react.js";
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
  const { LL } = useI18nContext();
  const notifyError = useNotificationStore((s) => s.error);
  const streaming = useMessagesStore(selectTurnInFlight(sessionId));
  const rewindToMessage = useSessionsStore((s) => s.rewindToMessage);
  const forkFromMessage = useSessionsStore((s) => s.forkFromMessage);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasAnchor = userMessageIndex !== undefined;
  const canBranch = hasAnchor && !streaming;
  const copy = LL.chat.messageActions;
  const branchHint = streaming ? copy.streamingHint() : !hasAnchor ? copy.noAnchor() : undefined;

  const onCopy = () => {
    writeClipboard(stripMarkdown(text)).catch(() => notifyError(LL.chat.errors.copy()));
  };

  return (
    <>
      <div className="pid-msg-actions">
        <Tooltip content={copy.copy()}>
          <PidIconButton icon={<Copy size={12} />} label={copy.copy()} onClick={onCopy} />
        </Tooltip>
        <Tooltip content={branchHint ?? copy.rewind()}>
          <PidIconButton
            icon={<Undo2 size={12} />}
            label={copy.rewind()}
            disabled={!canBranch}
            onClick={() => setConfirmOpen(true)}
          />
        </Tooltip>
        <Tooltip content={branchHint ?? copy.fork()}>
          <PidIconButton
            icon={<GitBranch size={12} />}
            label={copy.fork()}
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
        title={copy.confirmTitle()}
        description={copy.confirmDescription()}
        confirmLabel={copy.confirmLabel()}
        destructive
        onConfirm={() => {
          if (userMessageIndex !== undefined) return rewindToMessage(sessionId, userMessageIndex);
        }}
      />
    </>
  );
}
