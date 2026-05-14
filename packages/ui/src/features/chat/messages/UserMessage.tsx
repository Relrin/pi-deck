import type { UserMessageEntry } from "../types.js";
import { MessageSurface } from "./MessageSurface.js";

export function UserMessage({ message }: { message: UserMessageEntry }) {
  return (
    <MessageSurface align="right">
      <pre
        className="whitespace-pre-wrap font-sans m-0 select-text"
        data-selectable-message
        data-message-raw={message.text}
      >
        {message.text}
      </pre>
    </MessageSurface>
  );
}
