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

import type {
  OutputPreview,
  ToolResultDetail,
} from "../services/desktop/contracts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import type { ActivityOperation, ChatThreadItem } from "./chat-thread-model";
import { cn } from "../lib/utils";

interface TranscriptActivityRowProps {
  item: Extract<ChatThreadItem, { kind: "activity" }>;
  workspacePath: string | null;
}

function formatPath(path: string, workspacePath: string | null): string {
  if (workspacePath == null || !path.startsWith(workspacePath)) {
    return path;
  }

  const trimmed = path.slice(workspacePath.length).replace(/^\/+/, "");
  return trimmed.length === 0 ? "." : trimmed;
}

function formatLineRange(startLine?: number, endLine?: number): string {
  if (startLine == null && endLine == null) {
    return "";
  }
  if (startLine != null && endLine != null) {
    return `:${startLine}-${endLine}`;
  }
  if (startLine != null) {
    return `:${startLine}`;
  }

  return `:1-${endLine}`;
}

function formatOperationLabel(
  operation: ActivityOperation,
  workspacePath: string | null,
): string {
  switch (operation.detail.kind) {
    case "file_read":
      return `Read ${formatPath(operation.detail.path, workspacePath)}${formatLineRange(operation.detail.startLine, operation.detail.endLine)}`;
    case "file_update": {
      const verb = (() => {
        switch (operation.detail.operation) {
          case "create":
            return "Created";
          case "overwrite":
            return "Overwrote";
          case "replace":
            return "Updated";
          case "remove":
            return "Removed";
          case "undo":
            return "Undid";
          default:
            return "Updated";
        }
      })();

      return `${verb} ${formatPath(operation.detail.path, workspacePath)}`;
    }
    case "shell":
      return operation.detail.command;
    case "search":
      return `Searched ${operation.detail.path ? formatPath(operation.detail.path, workspacePath) : "."} for ${operation.detail.pattern}`;
    case "codebase_search":
      return `Codebase search: ${operation.detail.queries.join(" · ")}`;
    case "fetch":
      return `Fetched ${operation.detail.url}`;
    case "followup":
      return `Asked follow-up: ${operation.detail.question}`;
    case "plan":
      return `Updated plan ${operation.detail.planName}`;
    case "skill":
      return `Loaded skill ${operation.detail.name}`;
    case "task":
      return `Delegated to ${operation.detail.agentId}`;
    case "todo_read":
      return "Read todos";
    case "todo_write":
      return `Updated ${operation.detail.count} todo item${operation.detail.count === 1 ? "" : "s"}`;
    case "unknown":
      return `Ran ${operation.detail.name}`;
    default:
      return operation.name;
  }
}

function buildPreviewText(
  command: string,
  stdout?: OutputPreview,
  stderr?: OutputPreview,
): string {
  const lines = [`$ ${command}`];

  if (stdout?.content) {
    lines.push("", stdout.content);
  }
  if (stderr?.content) {
    lines.push("", "[stderr]", stderr.content);
  }

  return lines.join("\n").trim();
}

function buildGenericOutputText(operation: ActivityOperation): string | null {
  const detail = operation.resultDetail;
  if (detail?.kind === "shell_output") {
    return buildPreviewText(detail.command, detail.stdout, detail.stderr);
  }

  const genericText =
    operation.outputText ??
    (detail?.kind === "text" ? detail.text : undefined) ??
    operation.summary;

  return genericText?.trim() ? genericText.trim() : null;
}

function getShellDetail(detail: ToolResultDetail | undefined) {
  return detail?.kind === "shell_output" ? detail : null;
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
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/70">
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
      <pre className="max-h-72 overflow-auto px-4 py-3 text-xs leading-6 text-neutral-700 dark:text-neutral-200">
        <code>{previewText}</code>
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
      <div className="grid gap-2">
        {isExpandable ? (
          <CollapsibleTrigger className="flex items-start gap-2 text-left text-sm leading-6 text-neutral-500 transition hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
            {content}
          </CollapsibleTrigger>
        ) : (
          <div className="flex items-start gap-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            {content}
          </div>
        )}
        {isExpandable ? (
          <CollapsibleContent>
            <OperationOutputCard operation={operation} />
          </CollapsibleContent>
        ) : null}
      </div>
    </Collapsible>
  );
}

export function TranscriptActivityRow({
  item,
  workspacePath,
}: TranscriptActivityRowProps) {
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
      <article className="grid max-w-3xl gap-2 text-sm leading-6 text-neutral-400 dark:text-neutral-500">
        <div className="inline-flex items-center gap-2">
          <LoaderCircle className="size-3.5 animate-spin" />
          <span>Thinking</span>
        </div>
      </article>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <article className="grid max-w-3xl gap-2">
        <CollapsibleTrigger className="inline-flex items-center gap-2 text-left text-sm leading-6 text-neutral-400 transition hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
          <ActivityChevron open={open} />
          {item.isRunning ? <Terminal className="size-3.5" /> : null}
          <span>{item.summary}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-3 border-l border-neutral-200 pl-4 dark:border-neutral-800">
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
