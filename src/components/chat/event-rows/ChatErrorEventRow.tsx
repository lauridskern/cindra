import { CHAT_BODY_TEXT_CLASS } from "../constants/chatStyles";
import { ChatInlineText } from "../ChatInlineText";

export function ChatErrorEventRow({ message }: { message: string }) {
  return (
    <article
      className={`grid max-w-3xl gap-1.5 select-text ${CHAT_BODY_TEXT_CLASS} text-red-700 dark:text-red-400`}
      role="alert"
    >
      <ChatInlineText as="p" text={message} />
    </article>
  );
}
