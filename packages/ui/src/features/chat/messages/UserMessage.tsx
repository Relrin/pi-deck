import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import { useState } from "react";
import { Folder } from "../../../components/icons/index.js";
import { ImagePreviewDialog } from "../composer/ImagePreviewDialog.js";
import type { UserMessageEntry, UserMessageImage } from "../types.js";
import { MessageActions } from "./MessageActions.js";
import { MessageContextMenu } from "./MessageContextMenu.js";
import { MessageSurface } from "./MessageSurface.js";
import { formatMessageTime, formatMessageTimestampFull } from "./time.js";

export function UserMessage({
  message,
  sessionId,
  userMessageIndex,
}: {
  message: UserMessageEntry;
  sessionId: string;
  userMessageIndex?: number;
}) {
  const attachments = message.attachments ?? [];
  const images = message.images ?? [];
  return (
    <MessageSurface
      kind="user"
      timestamp={formatMessageTime(message.createdAt)}
      timestampTitle={formatMessageTimestampFull(message.createdAt)}
      actions={
        <MessageActions
          sessionId={sessionId}
          text={message.text}
          userMessageIndex={userMessageIndex}
        />
      }
    >
      {/* Chips live outside the context-menu trigger because Radix's asChild requires a
          single React child; keeping them as siblings also matches the design intent
          (chips are message metadata, not selectable text). */}
      {attachments.length + images.length > 0 ? (
        <UserMessageAttachments attachments={attachments} images={images} />
      ) : null}
      <MessageContextMenu rawText={message.text}>
        <pre
          className="whitespace-pre-wrap font-sans m-0 select-text"
          data-selectable-message
          data-message-raw={message.text}
        >
          {message.text}
        </pre>
      </MessageContextMenu>
    </MessageSurface>
  );
}

function UserMessageAttachments({
  attachments,
  images,
}: {
  attachments: PromptAttachment[];
  images: UserMessageImage[];
}) {
  const [preview, setPreview] = useState<UserMessageImage | null>(null);
  return (
    <div className="pid-composer-attachments pid-user-attachments">
      {attachments.map((a) => (
        <span key={`${a.kind}|${a.path}`} className="pid-composer-attachment">
          {a.kind === "folder" ? <Folder size={11} aria-hidden /> : null}
          <span className="pid-composer-attachment-path" title={a.path}>
            {basename(a.path)}
          </span>
        </span>
      ))}
      {images.map((img) => (
        // Key off the thumbnail's first slice — unique per image and stable across renders
        // since the entry is immutable once rendered (no add/remove on a sent message).
        <button
          key={`${img.name}|${img.thumbnailDataUrl.slice(0, 64)}`}
          type="button"
          className="pid-composer-attachment pid-composer-attachment-image"
          title={img.name}
          aria-label={`Preview ${img.name}`}
          onClick={() => setPreview(img)}
        >
          <img src={img.thumbnailDataUrl} alt={img.name} draggable={false} />
        </button>
      ))}
      {preview && (
        <ImagePreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          src={preview.thumbnailDataUrl}
          name={preview.name}
        />
      )}
    </div>
  );
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
