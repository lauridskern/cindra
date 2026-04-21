import { ChatInlineText } from "../chatInlineText";

function ContextCompactedIcon() {
  return (
    <span
      aria-hidden="true"
      className="relative size-4 shrink-0 text-neutral-400 dark:text-neutral-500"
    >
      <span className="absolute inset-x-[3px] top-[2px] h-[10px] rounded-[3px] border border-current bg-white/80 dark:bg-neutral-900/80" />
      <span className="absolute left-[1px] top-[4px] h-[10px] w-[8px] rounded-[3px] border border-current bg-white/55 dark:bg-neutral-900/55" />
      <span className="absolute right-[0px] top-[4px] h-[2px] w-[2px] rounded-full bg-current" />
      <span className="absolute right-[-1px] top-[7px] h-[2px] w-[4px] rounded-full bg-current" />
      <span className="absolute right-[0px] top-[10px] h-[2px] w-[3px] rounded-full bg-current" />
    </span>
  );
}

export function ChatContextCompactedRow({ text }: { text: string }) {
  return (
    <article className="flex max-w-3xl items-center gap-4 py-1 text-[13px] text-neutral-500 dark:text-neutral-400">
      <div className="h-px flex-1 bg-neutral-200/90 dark:bg-white/10" />
      <div className="inline-flex items-center gap-2 whitespace-nowrap">
        <ContextCompactedIcon />
        <ChatInlineText as="p" text={text} />
      </div>
      <div className="h-px flex-1 bg-neutral-200/90 dark:bg-white/10" />
    </article>
  );
}
