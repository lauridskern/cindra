import { cn } from "@/utils/cn";
import { CHAT_BODY_TEXT_CLASS } from "../constants/chatStyles";
import { ChatInlineText } from "../ChatInlineText";
import type {
  ChatToolEventRowProps,
  ToolEndRowProps,
  ToolStartRowProps,
} from "../types/chatComponents";

function ToolStartRow({ name }: ToolStartRowProps) {
  return (
    <article className={`grid max-w-3xl gap-1.5 select-text ${CHAT_BODY_TEXT_CLASS} text-neutral-950 dark:text-neutral-400`}>
      <ChatInlineText as="p" text={`Started ${name}`} />
    </article>
  );
}

function ToolEndRow({
  isError,
  name,
  summary,
}: ToolEndRowProps) {
  return (
    <article
      className={cn(
        `grid max-w-3xl gap-1.5 select-text ${CHAT_BODY_TEXT_CLASS}`,
        isError
          ? "text-red-700 dark:text-red-400"
          : "text-emerald-700 dark:text-emerald-400",
      )}
    >
      <ChatInlineText as="p" text={`Finished ${name}`} />
      {summary ? (
        <ChatInlineText
          as="p"
          className="text-neutral-950 dark:text-neutral-200"
          text={summary}
        />
      ) : null}
    </article>
  );
}

export function ChatToolEventRow({ message }: ChatToolEventRowProps) {
  switch (message.kind) {
    case "tool_start":
      return <ToolStartRow name={message.name} />;
    case "tool_end":
      return (
        <ToolEndRow
          isError={message.isError}
          name={message.name}
          summary={message.summary}
        />
      );
    default:
      return null;
  }
}
