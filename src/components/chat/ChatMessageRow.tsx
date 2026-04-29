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

interface UserChatMessageProps extends TextOnlyMessageProps {
  workspacePath: string | null;
}

function UserChatMessage({ text, workspacePath }: UserChatMessageProps) {
  return (
    <article className="flex w-full justify-end select-text">
      <div
        className="w-fit rounded-xl bg-neutral-200/60 px-3.5 py-1.5 text-sm text-neutral-950 dark:bg-neutral-800/60 dark:text-neutral-100"
        style={{ maxWidth: "min(42rem, 85%)" }}
      >
        <ChatInlineText as="p" text={text} workspacePath={workspacePath} />
      </div>
    </article>
  );
}

function MarkdownChatMessage({
  text,
  toneClassName,
  workspacePath,
}: MarkdownChatMessageProps) {
  return (
    <article className="max-w-3xl">
      <ChatMarkdown
        text={text}
        className={toneClassName}
        workspacePath={workspacePath}
      />
    </article>
  );
}

export function ChatMessageRow({ message, workspacePath }: ChatMessageRowProps) {
  switch (message.kind) {
    case "user":
      return <UserChatMessage text={message.text} workspacePath={workspacePath} />;
    case "assistant":
      return (
        <MarkdownChatMessage
          text={message.text}
          toneClassName={CHAT_BODY_TONE_CLASS}
          workspacePath={workspacePath}
        />
      );
    case "reasoning":
      return (
        <MarkdownChatMessage
          text={message.text}
          toneClassName={CHAT_REASONING_TONE_CLASS}
          workspacePath={workspacePath}
        />
      );
    default:
      return null;
  }
}
