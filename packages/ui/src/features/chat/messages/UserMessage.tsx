import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import { Folder } from "../../../components/icons/index.js";
import type { UserMessageEntry } from "../types.js";
import { MessageContextMenu } from "./MessageContextMenu.js";
import { MessageSurface } from "./MessageSurface.js";
import { formatMessageTime } from "./time.js";

export function UserMessage({ message }: { message: UserMessageEntry }) {
  const attachments = message.attachments ?? [];
  return (
    <MessageSurface kind="user" timestamp={formatMessageTime(message.createdAt)}>
      {/* Chips live outside the context-menu trigger because Radix's asChild requires a
          single React child; keeping them as siblings also matches the design intent
          (chips are message metadata, not selectable text). */}
      {attachments.length > 0 ? <UserMessageAttachments attachments={attachments} /> : null}
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

function UserMessageAttachments({ attachments }: { attachments: PromptAttachment[] }) {
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
    </div>
  );
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
