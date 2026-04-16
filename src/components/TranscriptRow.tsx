import ReactMarkdown from 'react-markdown'

import type { SessionMessage, StatusCategory } from '../services/desktop/contracts'
import { cn } from '../utils/cn'

interface TranscriptRowProps {
  message: SessionMessage
}

function statusToneClass(category: StatusCategory): string {
  switch (category) {
    case 'error':
      return 'text-red-700 dark:text-red-400'
    case 'warning':
      return 'text-amber-700 dark:text-amber-400'
    case 'completion':
      return 'text-emerald-700 dark:text-emerald-400'
    default:
      return 'text-neutral-500 dark:text-neutral-400'
  }
}

function UserMessage({ text }: { text: string }) {
  return (
    <article className="grid max-w-3xl gap-2 select-text text-xl leading-tight tracking-tight text-neutral-900 dark:text-neutral-100 md:text-2xl">
      <p>{text}</p>
    </article>
  )
}

function AssistantMessage({ text }: { text: string }) {
  return (
    <article
      className="grid max-w-3xl gap-2 select-text text-sm leading-6 text-neutral-700 dark:text-neutral-200 [&_code]:font-mono [&_ol]:my-0 [&_ol]:pl-5 [&_p]:m-0 [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_ul]:my-0 [&_ul]:pl-5]"
      data-testid="assistant-message"
    >
      <ReactMarkdown>{text}</ReactMarkdown>
    </article>
  )
}

function ReasoningMessage({ text }: { text: string }) {
  return (
    <article className="grid max-w-3xl gap-2 select-text text-sm leading-6 text-neutral-500 dark:text-neutral-400">
      <p>{text}</p>
    </article>
  )
}

function StatusMessage({
  category,
  subtitle,
  title,
}: {
  category: StatusCategory
  subtitle?: string | null
  title: string
}) {
  return (
    <article
      className={cn(
        'grid max-w-3xl gap-2 select-text text-xs leading-6',
        statusToneClass(category),
      )}
    >
      <p>{title}</p>
      {subtitle ? <p className="text-neutral-700 dark:text-neutral-200">{subtitle}</p> : null}
    </article>
  )
}

function StatusOutputMessage({ text }: { text: string }) {
  return (
    <article className="max-w-3xl select-text overflow-x-auto text-sm text-neutral-500 dark:text-neutral-400">
      <pre className="m-0 whitespace-pre-wrap break-words font-mono">{text}</pre>
    </article>
  )
}

function ToolStartMessage({ name }: { name: string }) {
  return (
    <article className="grid max-w-3xl gap-2 select-text text-xs leading-6 text-neutral-500 dark:text-neutral-400">
      <p>Started `{name}`</p>
    </article>
  )
}

function ToolEndMessage({
  isError,
  name,
  summary,
}: {
  isError: boolean
  name: string
  summary?: string | null
}) {
  return (
    <article
      className={cn(
        'grid max-w-3xl gap-2 select-text text-xs leading-6',
        isError
          ? 'text-red-700 dark:text-red-400'
          : 'text-emerald-700 dark:text-emerald-400',
      )}
    >
      <p>Finished `{name}`</p>
      {summary ? <p className="text-neutral-700 dark:text-neutral-200">{summary}</p> : null}
    </article>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <article
      className="grid max-w-3xl gap-2 select-text text-xs leading-6 text-red-700 dark:text-red-400"
      role="alert"
    >
      <p>{message}</p>
    </article>
  )
}

export function TranscriptRow({ message }: TranscriptRowProps) {
  switch (message.kind) {
    case 'user':
      return <UserMessage text={message.text} />
    case 'assistant':
      return <AssistantMessage text={message.text} />
    case 'reasoning':
      return <ReasoningMessage text={message.text} />
    case 'status':
      return (
        <StatusMessage
          category={message.category}
          subtitle={message.subtitle}
          title={message.title}
        />
      )
    case 'status_output':
      return <StatusOutputMessage text={message.text} />
    case 'tool_start':
      return <ToolStartMessage name={message.name} />
    case 'tool_end':
      return (
        <ToolEndMessage
          isError={message.isError}
          name={message.name}
          summary={message.summary}
        />
      )
    case 'error':
      return <ErrorMessage message={message.message} />
    default:
      return null
  }
}
