import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Terminal } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import type { ActivityItem, ActivityOperation } from "./chatThreadModel";
import { ChatMarkdown } from "./ChatMarkdown";
import { formatOperationLabel } from "./chatActivityUtils";
import { ChatInlineText } from "./chatInlineText";
import { ChatStatusLabel } from "./ChatStatusLabel";
import { ActivityResultRenderer } from "./activity-results/ActivityResultRenderer";
import { getActivityResultModel } from "./activity-results/activityResultModel";
import { cn } from "../../lib/utils";

interface ChatActivityRowProps {
  item: ActivityItem;
  workspacePath: string | null;
}

function ActivityChevron({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 text-current transition-opacity",
        className,
      )}
    >
      {open ? (
        <ChevronDown className="size-3.5" />
      ) : (
        <ChevronRight className="size-3.5" />
      )}
    </span>
  );
}

function ActivityOperationRow({
  operation,
  workspacePath,
}: {
  operation: ActivityOperation;
  workspacePath: string | null;
}) {
  const [open, setOpen] = useState(operation.isError);
  const result = getActivityResultModel(operation);
  const isExpandable = result != null;
  const label = formatOperationLabel(operation, workspacePath);
  const isCommand = operation.detail.kind === "shell";

  const content = (
    <>
      <span className="min-w-0">
        {isCommand ? (
          <code className="rounded-md bg-neutral-200/60 px-1.5 py-0.5 font-mono text-[0.95em] text-neutral-900 dark:bg-neutral-800/60 dark:text-neutral-100">
            {label}
          </code>
        ) : (
          <ChatInlineText text={label} />
        )}
      </span>
      {isExpandable ? (
        <ActivityChevron
          open={open}
          className="self-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      ) : null}
    </>
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="grid min-w-0 gap-1">
        {isExpandable ? (
          <CollapsibleTrigger className="group inline-flex min-w-0 items-center gap-1.5 text-left text-[13px] leading-[1.4rem] text-neutral-500 transition hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
            {content}
          </CollapsibleTrigger>
        ) : (
          <div className="inline-flex min-w-0 items-center text-[13px] leading-[1.4rem] text-neutral-500 dark:text-neutral-400">
            {content}
          </div>
        )}
        {result ? (
          <CollapsibleContent className="min-w-0 max-w-full">
            <ActivityResultRenderer
              result={result}
              workspacePath={workspacePath}
            />
          </CollapsibleContent>
        ) : null}
      </div>
    </Collapsible>
  );
}

export function ChatActivityRow({ item, workspacePath }: ChatActivityRowProps) {
  const [open, setOpen] = useState(item.isRunning || item.hasError);
  const previousRunningRef = useRef(item.isRunning);

  useEffect(() => {
    if (previousRunningRef.current && item.isRunning === false) {
      setOpen(item.hasError);
    } else if (previousRunningRef.current === false && item.isRunning) {
      setOpen(true);
    }

    previousRunningRef.current = item.isRunning;
  }, [item.hasError, item.isRunning]);

  if (item.isThinking) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <article className="grid min-w-0 max-w-3xl gap-1">
          <CollapsibleTrigger className="group inline-flex min-w-0 items-center gap-1.5 text-left text-[13px] leading-[1.4rem] text-neutral-500 transition hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
            <ChatStatusLabel active={item.isRunning} text={item.summary} />
            <ActivityChevron
              open={open}
              className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </CollapsibleTrigger>
          {item.reasoningText ? (
            <CollapsibleContent className="min-w-0 max-w-full">
              <article className="max-w-3xl">
                <ChatMarkdown
                  text={item.reasoningText}
                  className="text-[13px] leading-[1.4rem] text-neutral-950 dark:text-neutral-200"
                />
              </article>
            </CollapsibleContent>
          ) : null}
        </article>
      </Collapsible>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <article className="grid min-w-0 max-w-3xl gap-1">
        <CollapsibleTrigger className="group inline-flex min-w-0 items-center gap-1.5 text-left text-[13px] leading-[1.4rem] text-neutral-500 transition hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
          <ChatStatusLabel active={item.isRunning} text={item.summary} />
          {item.isRunning ? (
            <Terminal className="size-3.5 text-current" />
          ) : null}
          <ActivityChevron
            open={open}
            className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="min-w-0 max-w-full">
          <div className="grid min-w-0 gap-1">
            {item.operations.map((operation) => (
              <ActivityOperationRow
                key={operation.id}
                operation={operation}
                workspacePath={workspacePath}
              />
            ))}
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}
