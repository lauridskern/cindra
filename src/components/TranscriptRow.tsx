import ReactMarkdown from 'react-markdown'

import { cn } from '../utils/cn'
import type { TranscriptMessage } from '../services/desktop/contracts'
import { statusToneClass } from '../styles/classes'

interface TranscriptRowProps {
  message: TranscriptMessage
}

export function TranscriptRow({ message }: TranscriptRowProps) {
  switch (message.kind) {
    case 'user':
      return (
        <article className="grid max-w-3xl gap-2 select-text text-xl leading-tight tracking-tight text-neutral-900 dark:text-neutral-100 md:text-2xl">
          <p>{message.text}</p>
        </article>
      )
    case 'assistant':
      return (
        <article
          className="grid max-w-3xl gap-2 select-text text-sm leading-6 text-neutral-700 dark:text-neutral-200 [&_code]:font-mono [&_ol]:my-0 [&_ol]:pl-5 [&_p]:m-0 [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_ul]:my-0 [&_ul]:pl-5]"
          data-testid="assistant-message"
        >
          <ReactMarkdown>{message.text}</ReactMarkdown>
        </article>
      )
    case 'reasoning':
      return (
        <article className="grid max-w-3xl gap-2 select-text text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          <p>{message.text}</p>
        </article>
      )
    case 'status':
      return (
        <article
          className={cn(
            'grid max-w-3xl gap-2 select-text text-xs leading-6',
            statusToneClass(message.category),
          )}
        >
          <p>{message.title}</p>
          {message.subtitle ? (
            <p className="text-neutral-700 dark:text-neutral-200">
              {message.subtitle}
            </p>
          ) : null}
        </article>
      )
    case 'status_output':
      return (
        <article className="max-w-3xl select-text overflow-x-auto text-sm text-neutral-500 dark:text-neutral-400">
          <pre className="m-0 whitespace-pre-wrap break-words font-mono">
            {message.text}
          </pre>
        </article>
      )
    case 'tool_start':
      return (
        <article className="grid max-w-3xl gap-2 select-text text-xs leading-6 text-neutral-500 dark:text-neutral-400">
          <p>Started `{message.name}`</p>
        </article>
      )
    case 'tool_end':
      return (
        <article
          className={cn(
            'grid max-w-3xl gap-2 select-text text-xs leading-6',
            message.isError
              ? 'text-red-700 dark:text-red-400'
              : 'text-emerald-700 dark:text-emerald-400',
          )}
        >
          <p>Finished `{message.name}`</p>
          {message.summary ? (
            <p className="text-neutral-700 dark:text-neutral-200">
              {message.summary}
            </p>
          ) : null}
        </article>
      )
    case 'error':
      return (
        <article
          className="grid max-w-3xl gap-2 select-text text-xs leading-6 text-red-700 dark:text-red-400"
          role="alert"
        >
          <p>{message.message}</p>
        </article>
      )
    default:
      return null
  }
}
