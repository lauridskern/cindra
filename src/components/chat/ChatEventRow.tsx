import type { TranscriptMessage } from "../../services/desktop/contracts";
import {
  ChatContextCompactedRow,
  ChatErrorEventRow,
  ChatStatusEventRow,
  ChatToolEventRow,
} from "./event-rows";

type ChatEventMessage = Extract<
  TranscriptMessage,
  | { kind: "context_compacted" }
  | { kind: "status" | "status_output" | "tool_start" | "tool_end" | "error" }
>;

interface ChatEventRowProps {
  message: ChatEventMessage;
}

export function ChatEventRow({ message }: ChatEventRowProps) {
  switch (message.kind) {
    case "context_compacted":
      return <ChatContextCompactedRow text={message.text} />;
    case "status":
    case "status_output":
      return <ChatStatusEventRow message={message} />;
    case "tool_start":
    case "tool_end":
      return <ChatToolEventRow message={message} />;
    case "error":
      return <ChatErrorEventRow message={message.message} />;
    default:
      return null;
  }
}
