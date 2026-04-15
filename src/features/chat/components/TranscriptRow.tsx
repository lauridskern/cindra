import ReactMarkdown from 'react-markdown'

import { cn } from '../../../lib/cn'
import type { TranscriptMessage } from '../../../services/desktop/contracts'
import { statusToneClass } from '../../../styles/classes'

interface TranscriptRowProps {
  message: TranscriptMessage
}

export function TranscriptRow({ message }: TranscriptRowProps) {
  switch (message.kind) {
    case 'user':
      return (
        <article className="grid max-w-[720px] gap-2 select-text text-[clamp(1.06rem,1.3vw,1.46rem)] leading-[1.48] tracking-[-0.025em] text-neutral-900 dark:text-neutral-100">
          <p>{message.text}</p>
        </article>
      )
    case 'assistant':
      return (
        <article
          className="grid max-w-[720px] gap-2 select-text text-[15px] leading-[1.68] text-neutral-700 dark:text-neutral-200 [&_code]:font-mono [&_ol]:my-0 [&_ol]:pl-[18px] [&_p]:m-0 [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_ul]:my-0 [&_ul]:pl-[18px]"
          data-testid="assistant-message"
        >
          <ReactMarkdown>{message.text}</ReactMarkdown>
        </article>
      )
    case 'reasoning':
      return (
        <article className="grid max-w-[720px] gap-2 select-text text-[15px] leading-[1.68] text-neutral-500 dark:text-neutral-400">
          <p>{message.text}</p>
        </article>
      )
    case 'status':
      return (
        <article
          className={cn(
            'grid max-w-[720px] gap-2 select-text text-[13px] leading-6',
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
        <article className="max-w-[720px] select-text overflow-x-auto text-sm text-neutral-500 dark:text-neutral-400">
          <pre className="m-0 whitespace-pre-wrap break-words font-mono">
            {message.text}
          </pre>
        </article>
      )
    case 'tool_start':
      return (
        <article className="grid max-w-[720px] gap-2 select-text text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
          <p>Started `{message.name}`</p>
        </article>
      )
    case 'tool_end':
      return (
        <article
          className={cn(
            'grid max-w-[720px] gap-2 select-text text-[13px] leading-6',
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
          className="grid max-w-[720px] gap-2 select-text text-[13px] leading-6 text-red-700 dark:text-red-400"
          role="alert"
        >
          <p>{message.message}</p>
        </article>
      )
    default:
      return null
  }
}
