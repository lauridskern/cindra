import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  LoaderCircle,
  Terminal,
  TriangleAlert,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import type { ActivityOperation, ChatThreadItem } from "./chatThreadModel";
import { ChatMarkdown } from "./ChatMarkdown";
import {
  buildGenericOutputText,
  formatOperationLabel,
  getShellDetail,
} from "./chatActivityUtils";
import { cn } from "../../lib/utils";

interface ChatActivityRowProps {
  item: Extract<ChatThreadItem, { kind: "activity" }>;
  workspacePath: string | null;
}

function ActivityStatusIcon({
  completed,
  isError,
}: Pick<ActivityOperation, "completed" | "isError">) {
  if (!completed) {
    return (
      <LoaderCircle className="size-3.5 animate-spin text-neutral-400 dark:text-neutral-500" />
    );
  }

  if (isError) {
    return (
      <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
    );
  }

  return <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />;
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
        "inline-flex shrink-0 text-neutral-400 dark:text-neutral-500",
        className,
      )}
    >
      {open ? (
        <ChevronDown className="size-4" />
      ) : (
        <ChevronRight className="size-4" />
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
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
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
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium tracking-[0.12em] text-neutral-500 transition hover:bg-neutral-200/70 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="block max-h-72 w-full max-w-full overflow-x-auto overflow-y-auto whitespace-pre px-4 py-3 text-xs leading-6 text-neutral-700 dark:text-neutral-200">
        <code className="inline-block min-w-full w-max align-top whitespace-pre">
          {previewText}
        </code>
      </pre>
      <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
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

function ThinkingOutputCard({ text }: { text: string }) {
  if (text.trim().length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/70">
      <div className="border-b border-neutral-200 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        Thinking
      </div>
      <div className="max-h-72 overflow-x-auto overflow-y-auto px-4 py-3">
        <ChatMarkdown
          text={text}
          className="text-xs leading-6 text-neutral-700 dark:text-neutral-200"
        />
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
      {isExpandable ? (
        <ActivityChevron open={open} className="mt-0.5" />
      ) : (
        <span className="mt-0.5 inline-flex shrink-0 text-neutral-300 dark:text-neutral-700">
          •
        </span>
      )}
      <span className="min-w-0 flex-1">
        {isCommand ? (
          <code className="rounded-full bg-neutral-100 px-2.5 py-0.5 font-mono text-[0.92em] text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
            {label}
          </code>
        ) : (
          label
        )}
      </span>
      <ActivityStatusIcon
        completed={operation.completed}
        isError={operation.isError}
      />
    </>
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="grid min-w-0 gap-2">
        {isExpandable ? (
          <CollapsibleTrigger className="flex min-w-0 items-start gap-2 text-left text-sm leading-6 text-neutral-500 transition hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
            {content}
          </CollapsibleTrigger>
        ) : (
          <div className="flex min-w-0 items-start gap-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
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
    if (previousRunningRef.current && !item.isRunning) {
      setOpen(false);
    } else if (!previousRunningRef.current && item.isRunning) {
      setOpen(true);
    }

    previousRunningRef.current = item.isRunning;
  }, [item.isRunning]);

  if (item.isThinking) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <article className="grid min-w-0 max-w-3xl gap-2">
          <CollapsibleTrigger className="inline-flex min-w-0 items-center gap-2 text-left text-sm leading-6 text-neutral-400 transition hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
            <ActivityChevron open={open} />
            {item.isRunning ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : null}
            <span>{item.summary}</span>
          </CollapsibleTrigger>
          {item.reasoningText ? (
            <CollapsibleContent className="min-w-0 max-w-full">
              <ThinkingOutputCard text={item.reasoningText} />
            </CollapsibleContent>
          ) : null}
        </article>
      </Collapsible>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <article className="grid min-w-0 max-w-3xl gap-2">
        <CollapsibleTrigger className="inline-flex min-w-0 items-center gap-2 text-left text-sm leading-6 text-neutral-400 transition hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
          <ActivityChevron open={open} />
          {item.isRunning ? <Terminal className="size-3.5" /> : null}
          <span>{item.summary}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="min-w-0 max-w-full">
          <div className="grid min-w-0 gap-3 border-l border-neutral-200 pl-4 dark:border-neutral-800">
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
