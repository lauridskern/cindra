import { useMemo, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../ui/Collapsible";
import { CHAT_BODY_TEXT_CLASS } from "../constants/chatStyles";
import { ChatInlineText } from "../ChatInlineText";
import type {
  ChatErrorEventRowProps,
  ChatToolFailureLimitMessage,
} from "../types/chatComponents";

const TOOL_FAILURE_LIMIT_PATTERN =
  /^Stopped after reaching the tool failure limit \((\d+)\)\.\s*(.*)$/i;
const TOOL_FAILURE_DETAIL_PATTERN = /([^:,]+):\s*(\d+)/g;

export function parseToolFailureLimitMessage(
  message: string,
): ChatToolFailureLimitMessage | null {
  const match = message.trim().match(TOOL_FAILURE_LIMIT_PATTERN);
  if (match == null) {
    return null;
  }

  const limit = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(limit)) {
    return null;
  }

  const failures: ChatToolFailureLimitMessage["failures"] = [];
  const details = match[2] ?? "";
  for (const detailMatch of details.matchAll(TOOL_FAILURE_DETAIL_PATTERN)) {
    const name = detailMatch[1]?.trim();
    const count = Number.parseInt(detailMatch[2] ?? "", 10);
    if (name && Number.isFinite(count)) {
      failures.push({ count, name });
    }
  }

  return { failures, limit };
}

function formatToolFailureSummary(parsed: ChatToolFailureLimitMessage): string {
  if (parsed.failures.length === 0) {
    return `The agent stopped because a tool failed ${parsed.limit} times.`;
  }

  const topFailure = parsed.failures[0];
  const toolLabel = `${topFailure.name} failed ${topFailure.count} time${
    topFailure.count === 1 ? "" : "s"
  }`;

  return `The agent stopped because ${toolLabel}.`;
}

function ChatToolFailureLimitRow({ message }: ChatErrorEventRowProps) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseToolFailureLimitMessage(message), [message]);

  if (parsed == null) {
    return null;
  }

  const summary = formatToolFailureSummary(parsed);

  return (
    <article
      className={`grid max-w-3xl gap-2 select-text ${CHAT_BODY_TEXT_CLASS} text-red-700 dark:text-red-400`}
      role="alert"
    >
      <div className="grid gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-3 dark:border-red-400/20 dark:bg-red-400/10">
        <p className="font-medium">Tool failure limit reached</p>
        <ChatInlineText as="p" text={summary} />
        <p className="text-neutral-700 dark:text-neutral-300">
          Try again, adjust the request, or continue with the available context.
        </p>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="w-fit text-left text-xs font-medium text-red-800 underline-offset-4 hover:underline dark:text-red-300">
            {open ? "Hide technical details" : "Show technical details"}
          </CollapsibleTrigger>
          {open ? (
            <CollapsibleContent>
              <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-red-950/10 p-2 font-mono text-xs text-red-950 dark:bg-red-950/40 dark:text-red-100">
                {message}
              </pre>
            </CollapsibleContent>
          ) : null}
        </Collapsible>
      </div>
    </article>
  );
}

export function ChatErrorEventRow({ message }: ChatErrorEventRowProps) {
  const parsedToolFailureLimit = parseToolFailureLimitMessage(message);

  if (parsedToolFailureLimit != null) {
    return <ChatToolFailureLimitRow message={message} />;
  }

  return (
    <article
      className={`grid max-w-3xl gap-1.5 select-text ${CHAT_BODY_TEXT_CLASS} text-red-700 dark:text-red-400`}
      role="alert"
    >
      <ChatInlineText as="p" text={message} />
    </article>
  );
}
