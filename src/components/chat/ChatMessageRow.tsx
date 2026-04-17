import type { TranscriptMessage } from "../../services/desktop/contracts";
import { ChatMarkdown } from "./ChatMarkdown";
import { ChatInlineText } from "./chatInlineText";

type ChatContentMessage = Extract<
  TranscriptMessage,
  { kind: "user" | "assistant" | "reasoning" }
>;

interface ChatMessageRowProps {
  message: ChatContentMessage;
}

function UserChatMessage({ text }: { text: string }) {
  return (
    <article className="flex w-full justify-end select-text">
      <div className="max-w-[min(42rem,85%)] rounded-3xl bg-neutral-200/60 px-5 py-3 text-[13px] leading-[1.4rem] text-neutral-950 dark:bg-neutral-800/60 dark:text-neutral-100">
        <ChatInlineText as="p" text={text} />
      </div>
    </article>
  );
}

function MarkdownChatMessage({
  text,
  toneClassName,
}: {
  text: string;
  toneClassName: string;
}) {
  return (
    <article className="max-w-3xl">
      <ChatMarkdown text={text} className={toneClassName} />
    </article>
  );
}

export function ChatMessageRow({ message }: ChatMessageRowProps) {
  switch (message.kind) {
    case "user":
      return <UserChatMessage text={message.text} />;
    case "assistant":
      return (
        <MarkdownChatMessage
          text={message.text}
          toneClassName="text-[13px] leading-[1.4rem] text-neutral-950 dark:text-neutral-200"
        />
      );
    case "reasoning":
      return (
        <MarkdownChatMessage
          text={message.text}
          toneClassName="text-[13px] leading-[1.4rem] text-neutral-950 dark:text-neutral-300"
        />
      );
    default:
      return null;
  }
}
