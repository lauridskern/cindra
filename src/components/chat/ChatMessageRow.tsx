import type { TranscriptMessage } from "../../services/desktop/contracts";
import { ChatMarkdown } from "./ChatMarkdown";

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
      <div className="max-w-[min(42rem,85%)] rounded-3xl bg-neutral-100 px-6 py-4 text-sm leading-6 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
        <p>{text}</p>
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
          toneClassName="text-sm leading-6 text-neutral-700 dark:text-neutral-200"
        />
      );
    case "reasoning":
      return (
        <MarkdownChatMessage
          text={message.text}
          toneClassName="text-sm leading-6 text-neutral-500 dark:text-neutral-400"
        />
      );
    default:
      return null;
  }
}
