import { cn } from "@/utils/cn";
import {
  CHAT_BODY_TEXT_CLASS,
  CHAT_BODY_TONE_CLASS,
} from "../constants/chatStyles";
import { ChatInlineText } from "../ChatInlineText";
import type {
  ChatStatusEventRowProps,
  StatusOutputRowProps,
  StatusRowProps,
} from "../types/chatComponents";
import { getStatusToneClass } from "../utils/statusTone";

function StatusRow({
  category,
  subtitle,
  title,
}: StatusRowProps) {
  if (
    (category === "action" || category === "info" || category === "debug") &&
    subtitle
  ) {
    return (
      <article className={`grid max-w-3xl gap-1.5 select-text ${CHAT_BODY_TONE_CLASS}`}>
        <ChatInlineText as="p" text={subtitle} />
      </article>
    );
  }

  if (category === "action" || category === "info" || category === "debug") {
    return null;
  }

  return (
    <article
      className={cn(
        `grid max-w-3xl gap-1.5 select-text ${CHAT_BODY_TEXT_CLASS}`,
        getStatusToneClass(category),
      )}
    >
      <ChatInlineText as="p" text={title} />
      {subtitle ? (
        <ChatInlineText
          as="p"
          className="text-neutral-950 dark:text-neutral-200"
          text={subtitle}
        />
      ) : null}
    </article>
  );
}

function StatusOutputRow({ text }: StatusOutputRowProps) {
  return (
    <article className={`max-w-3xl min-w-0 select-text overflow-x-auto ${CHAT_BODY_TEXT_CLASS} text-neutral-950 dark:text-neutral-400`}>
      <pre className="m-0 max-w-full overflow-x-auto whitespace-pre font-mono leading-6">
        {text}
      </pre>
    </article>
  );
}

function RetryStatusRow({ subtitle }: Pick<StatusRowProps, "subtitle">) {
  const parsed = parseRetryStatusDetail(subtitle);

  return (
    <article
      className={cn(
        "grid max-w-3xl gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2.5 text-sm leading-6 text-amber-950 shadow-sm select-text dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100",
      )}
    >
      <div className="font-medium">Connection issue, retrying automatically</div>
      <p className="m-0 text-amber-900/85 dark:text-amber-100/80">
        {parsed.summary}
      </p>
      {parsed.details ? (
        <details className="group grid gap-1">
          <summary className="cursor-pointer text-xs font-medium text-amber-800 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-100">
            Technical details
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-amber-200/70 bg-white/70 p-2 text-xs leading-5 whitespace-pre-wrap text-amber-950 dark:border-amber-500/25 dark:bg-black/20 dark:text-amber-100">
            {parsed.details}
          </pre>
        </details>
      ) : null}
    </article>
  );
}

function parseRetryStatusDetail(subtitle: string | null | undefined): {
  summary: string;
  details: string | null;
} {
  const fallbackSummary = "A temporary network or service problem occurred. The request is still running and will retry automatically.";
  if (subtitle == null || subtitle.trim().length === 0) {
    return { summary: fallbackSummary, details: null };
  }

  const [summary, details] = subtitle.split(/\n\nTechnical details:\n/, 2);
  return {
    summary: summary.trim() || fallbackSummary,
    details: details?.trim() ? details.trim() : null,
  };
}

export function ChatStatusEventRow({ message }: ChatStatusEventRowProps) {
  switch (message.kind) {
    case "status":
      if (message.title === "Connection issue, retrying...") {
        return <RetryStatusRow subtitle={message.subtitle} />;
      }

      return (
        <StatusRow
          category={message.category}
          subtitle={message.subtitle}
          title={message.title}
        />
      );
    case "status_output":
      return <StatusOutputRow text={message.text} />;
    default:
      return null;
  }
}
