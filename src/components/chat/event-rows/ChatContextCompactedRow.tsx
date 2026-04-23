import { CHAT_MUTED_TEXT_CLASS } from "../constants/chatStyles";
import { ChatInlineText } from "../ChatInlineText";
import type { ChatContextCompactedRowProps } from "../types/chatComponents";

function ContextCompactedIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500"
    >
      <rect
        x="3"
        y="2"
        width="10"
        height="10"
        rx="2"
        className="fill-white/80 stroke-current dark:fill-neutral-900/80"
      />
      <rect
        x="1"
        y="4"
        width="8"
        height="10"
        rx="2"
        className="fill-white/55 stroke-current dark:fill-neutral-900/55"
      />
      <circle cx="13" cy="5" r="1" className="fill-current" />
      <rect x="11" y="7" width="4" height="2" rx="1" className="fill-current" />
      <rect x="12" y="10" width="3" height="2" rx="1" className="fill-current" />
    </svg>
  );
}

export function ChatContextCompactedRow({ text }: ChatContextCompactedRowProps) {
  return (
    <article className={`flex max-w-3xl items-center gap-4 py-1 ${CHAT_MUTED_TEXT_CLASS}`}>
      <div className="h-px flex-1 bg-neutral-200/90 dark:bg-white/10" />
      <div className="inline-flex items-center gap-2 whitespace-nowrap">
        <ContextCompactedIcon />
        <ChatInlineText as="p" text={text} />
      </div>
      <div className="h-px flex-1 bg-neutral-200/90 dark:bg-white/10" />
    </article>
  );
}
