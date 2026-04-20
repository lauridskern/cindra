import type { TranscriptMessage } from "../../../services/desktop/contracts";
import { cn } from "../../../lib/utils";
import { ChatInlineText } from "../chatInlineText";

type ChatToolMessage = Extract<
  TranscriptMessage,
  { kind: "tool_start" | "tool_end" }
>;

function ToolStartRow({ name }: { name: string }) {
  return (
    <article className="grid max-w-3xl gap-1.5 select-text text-[13px] leading-[1.4rem] text-neutral-950 dark:text-neutral-400">
      <ChatInlineText as="p" text={`Started ${name}`} />
    </article>
  );
}

function ToolEndRow({
  isError,
  name,
  summary,
}: {
  isError: boolean;
  name: string;
  summary?: string | null;
}) {
  return (
    <article
      className={cn(
        "grid max-w-3xl gap-1.5 select-text text-[13px] leading-[1.4rem]",
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

export function ChatToolEventRow({ message }: { message: ChatToolMessage }) {
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
