import type { UserMessageEntry } from "../types.js";
import { MessageContextMenu } from "./MessageContextMenu.js";
import { MessageSurface } from "./MessageSurface.js";
import { formatMessageTime } from "./time.js";

export function UserMessage({ message }: { message: UserMessageEntry }) {
  return (
    <MessageSurface kind="user" timestamp={formatMessageTime(message.createdAt)}>
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
