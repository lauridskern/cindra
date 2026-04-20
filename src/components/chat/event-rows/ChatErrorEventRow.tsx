import { ChatInlineText } from "../chatInlineText";

export function ChatErrorEventRow({ message }: { message: string }) {
  return (
    <article
      className="grid max-w-3xl gap-1.5 select-text text-[13px] leading-[1.4rem] text-red-700 dark:text-red-400"
      role="alert"
    >
      <ChatInlineText as="p" text={message} />
    </article>
  );
}
