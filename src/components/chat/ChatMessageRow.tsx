import {
  CHAT_BODY_TONE_CLASS,
  CHAT_REASONING_TONE_CLASS,
} from "./constants/chatStyles";
import { ChatMarkdown } from "./ChatMarkdown";
import { ChatInlineText } from "./ChatInlineText";
import type {
  ChatMessageRowProps,
  MarkdownChatMessageProps,
  TextOnlyMessageProps,
} from "./types/chatComponents";

function UserChatMessage({ text }: TextOnlyMessageProps) {
  return (
    <article className="flex w-full justify-end select-text">
      <div
        className="w-fit rounded-3xl bg-neutral-200/60 px-5 py-3 text-sm/6 text-neutral-950 dark:bg-neutral-800/60 dark:text-neutral-100"
        style={{ maxWidth: "min(42rem, 85%)" }}
      >
        <ChatInlineText as="p" text={text} />
      </div>
    </article>
  );
}

function MarkdownChatMessage({
  text,
  toneClassName,
}: MarkdownChatMessageProps) {
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
          toneClassName={CHAT_BODY_TONE_CLASS}
        />
      );
    case "reasoning":
      return (
        <MarkdownChatMessage
          text={message.text}
          toneClassName={CHAT_REASONING_TONE_CLASS}
        />
      );
    default:
      return null;
  }
}
