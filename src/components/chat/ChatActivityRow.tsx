import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Terminal,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import type { ActivityItem, ActivityOperation } from "./chatThreadModel";
import { ChatMarkdown } from "./ChatMarkdown";
import {
  buildGenericOutputText,
  formatOperationLabel,
  getShellDetail,
} from "./chatActivityUtils";
import { ChatInlineText } from "./chatInlineText";
import { ChatStatusLabel } from "./ChatStatusLabel";
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

function OperationOutputCard({ operation }: { operation: ActivityOperation }) {
  const [copied, setCopied] = useState(false);
  const resetCopyTimeoutRef = useRef<number | null>(null);
  const shellDetail = getShellDetail(operation.resultDetail);
  const previewText = buildGenericOutputText(operation);

  useEffect(() => {
    return () => {
      if (resetCopyTimeoutRef.current != null) {
        window.clearTimeout(resetCopyTimeoutRef.current);
      }
    };
  }, []);

  if (previewText == null) {
    return null;
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/70">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 text-[13px] leading-[1.4rem] text-neutral-950 dark:border-neutral-800 dark:text-neutral-400">
        <span>{shellDetail ? "Shell" : "Output"}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(previewText);
            setCopied(true);
            if (resetCopyTimeoutRef.current != null) {
              window.clearTimeout(resetCopyTimeoutRef.current);
            }
            resetCopyTimeoutRef.current = window.setTimeout(() => {
              setCopied(false);
              resetCopyTimeoutRef.current = null;
            }, 1200);
          }}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] leading-[1.4rem] text-neutral-950 transition hover:bg-neutral-200/70 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="block max-h-72 w-full max-w-full overflow-x-auto overflow-y-auto whitespace-pre px-3 py-2.5 text-[13px] leading-[1.4rem] text-neutral-950 dark:text-neutral-200">
        <code className="inline-block min-w-full w-max align-top whitespace-pre">
          {previewText}
        </code>
      </pre>
      <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2 text-[13px] leading-[1.4rem] text-neutral-950 dark:border-neutral-800 dark:text-neutral-400">
        <span>
          {shellDetail?.stdout?.tailDisplayLines != null ||
          shellDetail?.stderr?.tailDisplayLines != null
            ? "Showing Forge’s truncated output preview"
            : operation.isError
              ? "Exited with an error"
              : "Completed"}
        </span>
        {shellDetail?.exitCode != null ? (
          <span>exit {shellDetail.exitCode}</span>
        ) : operation.isError ? (
          <span>Error</span>
        ) : (
          <span>Success</span>
        )}
      </div>
    </div>
  );
}

function ActivityOperationRow({
  operation,
  workspacePath,
}: {
  operation: ActivityOperation;
  workspacePath: string | null;
}) {
  const [open, setOpen] = useState(false);
  const outputText = buildGenericOutputText(operation);
  const isExpandable = outputText != null;
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
        {isExpandable ? (
          <CollapsibleContent className="min-w-0 max-w-full">
            <OperationOutputCard operation={operation} />
          </CollapsibleContent>
        ) : null}
      </div>
    </Collapsible>
  );
}

export function ChatActivityRow({ item, workspacePath }: ChatActivityRowProps) {
  const [open, setOpen] = useState(item.isRunning);
  const previousRunningRef = useRef(item.isRunning);

  useEffect(() => {
    if (previousRunningRef.current && item.isRunning === false) {
      setOpen(false);
    } else if (previousRunningRef.current === false && item.isRunning) {
      setOpen(true);
    }

    previousRunningRef.current = item.isRunning;
  }, [item.isRunning]);

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
