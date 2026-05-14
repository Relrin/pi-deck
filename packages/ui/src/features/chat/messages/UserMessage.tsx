import type { UserMessageEntry } from "../types.js";
import { MessageSurface } from "./MessageSurface.js";

export function UserMessage({ message }: { message: UserMessageEntry }) {
  return (
    <MessageSurface align="right">
      <pre className="whitespace-pre-wrap font-sans m-0">{message.text}</pre>
    </MessageSurface>
  );
}
