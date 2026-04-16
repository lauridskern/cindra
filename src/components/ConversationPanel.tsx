import {
  ChevronRight,
  ChevronsUpDown,
  GitFork,
} from 'lucide-react'

import {
  useConversationSession,
} from '../hooks/useSession'
import { ChatThread } from './ChatThread'
import { LandingScreen } from './LandingScreen'
import { PromptComposer } from './PromptComposer'

export function ConversationPanel() {
  const {
    activeWorkspaceLabel,
    hasCurrentWorkspace,
    isOpeningProject,
    messages,
    runtimeStatus,
    uiError,
  } = useConversationSession()

  if (!hasCurrentWorkspace) {
    return (
      <LandingScreen
        isOpeningProject={isOpeningProject}
        runtimeStatus={runtimeStatus}
        uiError={uiError}
      />
    )
  }

  const repoName = runtimeStatus?.gitRepoName
  const branchName = runtimeStatus?.gitBranchName

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-white/60 bg-white/80 shadow-xl shadow-neutral-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/20">
      <header className="flex h-10 items-center border-b border-black/5 px-4.5 select-none dark:border-white/5 max-md:px-4">
        {repoName ? (
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium tracking-tight">
            <div className="flex min-w-0 items-center gap-1.5 text-neutral-800 dark:text-neutral-100">
              <GitFork
                strokeWidth={2.5}
                className="size-3 shrink-0 text-neutral-500 dark:text-neutral-400"
              />
              <span className="truncate">{repoName}</span>
            </div>

            {branchName ? (
              <>
                <ChevronRight
                  strokeWidth={2.5}
                  className="size-2.5 shrink-0 text-neutral-400 dark:text-neutral-500"
                />
                <div className="flex min-w-0 items-center gap-0.5 text-neutral-500 dark:text-neutral-400">
                  <span className="truncate">{branchName}</span>
                  <ChevronsUpDown
                    strokeWidth={2.5}
                    className="size-2.5 shrink-0 text-neutral-400 dark:text-neutral-500"
                  />
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <span className="text-xs font-medium tracking-tight text-neutral-500 dark:text-neutral-400">
            {activeWorkspaceLabel}
          </span>
        )}
      </header>

      {uiError ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-red-700 max-md:mx-4 dark:text-red-400"
          role="alert"
        >
          {uiError}
        </div>
      ) : null}

      {runtimeStatus?.configured === false ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-amber-700 max-md:mx-4 dark:text-amber-400"
          role="alert"
        >
          {runtimeStatus.configurationError ??
            'No session is configured. Configure the terminal session first.'}
        </div>
      ) : null}

      <section className="min-h-0 flex-1 overflow-hidden select-text">
        <ChatThread messages={messages} />
      </section>

      <PromptComposer />
    </section>
  )
}
