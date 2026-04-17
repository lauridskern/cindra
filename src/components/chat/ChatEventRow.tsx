import type {
  StatusCategory,
  TranscriptMessage,
} from "../../services/desktop/contracts";
import { cn } from "../../lib/utils";

type ChatEventMessage = Extract<
  TranscriptMessage,
  { kind: "status" | "status_output" | "tool_start" | "tool_end" | "error" }
>;

interface ChatEventRowProps {
  message: ChatEventMessage;
}

function statusToneClass(category: StatusCategory): string {
  switch (category) {
    case "error":
      return "text-red-700 dark:text-red-400";
    case "warning":
      return "text-amber-700 dark:text-amber-400";
    case "completion":
      return "text-emerald-700 dark:text-emerald-400";
    default:
      return "text-neutral-500 dark:text-neutral-400";
  }
}

function StatusRow({
  category,
  subtitle,
  title,
}: {
  category: StatusCategory;
  subtitle?: string | null;
  title: string;
}) {
  if (
    (category === "action" || category === "info" || category === "debug") &&
    subtitle
  ) {
    return (
      <article className="grid max-w-3xl gap-2 select-text text-sm leading-6 text-neutral-700 dark:text-neutral-200">
        <p>{subtitle}</p>
      </article>
    );
  }

  if (category === "action" || category === "info" || category === "debug") {
    return null;
  }

  return (
    <article
      className={cn(
        "grid max-w-3xl gap-2 select-text text-xs leading-6",
        statusToneClass(category),
      )}
    >
      <p>{title}</p>
      {subtitle ? (
        <p className="text-neutral-700 dark:text-neutral-200">{subtitle}</p>
      ) : null}
    </article>
  );
}

function StatusOutputRow({ text }: { text: string }) {
  return (
    <article className="max-w-3xl min-w-0 select-text overflow-x-auto text-sm text-neutral-500 dark:text-neutral-400">
      <pre className="m-0 max-w-full overflow-x-auto whitespace-pre font-mono">
        {text}
      </pre>
    </article>
  );
}

function ToolStartRow({ name }: { name: string }) {
  return (
    <article className="grid max-w-3xl gap-2 select-text text-xs leading-6 text-neutral-500 dark:text-neutral-400">
      <p>Started `{name}`</p>
    </article>
  );
}

function ToolEndRow({
  isError,
  name,
  summary,
}: {
  isError: boolean;
  name: string;
  summary?: string | null;
}) {
  return (
    <article
      className={cn(
        "grid max-w-3xl gap-2 select-text text-xs leading-6",
        isError
          ? "text-red-700 dark:text-red-400"
          : "text-emerald-700 dark:text-emerald-400",
      )}
    >
      <p>Finished `{name}`</p>
      {summary ? (
        <p className="text-neutral-700 dark:text-neutral-200">{summary}</p>
      ) : null}
    </article>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <article
      className="grid max-w-3xl gap-2 select-text text-xs leading-6 text-red-700 dark:text-red-400"
      role="alert"
    >
      <p>{message}</p>
    </article>
  );
}

export function ChatEventRow({ message }: ChatEventRowProps) {
  switch (message.kind) {
    case "status":
      return (
        <StatusRow
          category={message.category}
          subtitle={message.subtitle}
          title={message.title}
        />
      );
    case "status_output":
      return <StatusOutputRow text={message.text} />;
    case "tool_start":
      return <ToolStartRow name={message.name} />;
    case "tool_end":
      return (
        <ToolEndRow
          isError={message.isError}
          name={message.name}
          summary={message.summary}
        />
      );
    case "error":
      return <ErrorRow message={message.message} />;
    default:
      return null;
  }
}
