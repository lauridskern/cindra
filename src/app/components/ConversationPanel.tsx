import type { ReactNode } from 'react'

import { cn, interactiveBaseClass } from '../ui'
import type { RuntimeStatus, TranscriptMessage } from '../contracts'
import { Transcript } from './Transcript'

interface ConversationPanelProps {
  bootError: string | null
  children: ReactNode
  hasCurrentWorkspace: boolean
  isOpeningWorkspace: boolean
  mainTitle: string
  messages: TranscriptMessage[]
  runtimeStatus: RuntimeStatus | null
  onPickWorkspace: () => void
}

export function ConversationPanel({
  bootError,
  children,
  hasCurrentWorkspace,
  isOpeningWorkspace,
  mainTitle,
  messages,
  runtimeStatus,
  onPickWorkspace,
}: ConversationPanelProps) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/80 shadow-xl shadow-neutral-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/78 dark:shadow-black/20">
      <header className="flex min-h-13 items-center px-6 pt-7 select-none max-[720px]:px-4">
        <span className="text-[0.82rem] font-semibold tracking-[-0.01em] text-neutral-500 dark:text-neutral-400">
          {mainTitle}
        </span>
      </header>

      {bootError ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-red-700 max-[720px]:mx-4 dark:text-red-400"
          role="alert"
        >
          {bootError}
        </div>
      ) : null}

      {runtimeStatus?.configured === false ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-amber-700 max-[720px]:mx-4 dark:text-amber-400"
          role="alert"
        >
          {runtimeStatus.configurationError ??
            'No Forge session is configured. Configure Forge in the terminal first.'}
        </div>
      ) : null}

      <section className="min-h-0 flex-1 overflow-hidden select-text">
        {hasCurrentWorkspace ? (
          <Transcript messages={messages} />
        ) : (
          <div className="grid h-full place-items-center p-6">
            <div className="grid justify-items-center gap-3.5 text-center text-[0.88rem] text-neutral-400 dark:text-neutral-500">
              <p>Select a project from the sidebar or open a new one.</p>
              <button
                type="button"
                className={cn(
                  interactiveBaseClass,
                  'rounded-full bg-white/90 px-4 py-2.5 text-sm text-neutral-950 shadow-lg shadow-neutral-950/5 hover:-translate-y-px dark:bg-neutral-800/90 dark:text-neutral-100 dark:shadow-black/20',
                )}
                onClick={onPickWorkspace}
                disabled={isOpeningWorkspace}
              >
                {isOpeningWorkspace ? 'Opening…' : 'Open project'}
              </button>
            </div>
          </div>
        )}
      </section>

      {children}
    </section>
  )
}
