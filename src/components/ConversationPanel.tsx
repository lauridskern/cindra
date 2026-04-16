import {
  useConversationSession,
  useSessionActions,
} from '../hooks/useSession'
import { ChatThread } from './ChatThread'
import { PromptComposer } from './PromptComposer'

export function ConversationPanel() {
  const { openWorkspacePicker } = useSessionActions()
  const {
    activeWorkspaceLabel,
    activeWorkspaceConfigured,
    activeWorkspaceConfigurationError,
    hasCurrentWorkspace,
    isOpeningProject,
    messages,
    uiError,
  } = useConversationSession()

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-xl shadow-neutral-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/20">
      <header className="flex min-h-13 items-center px-6 pt-7 select-none max-md:px-4">
        <span className="text-sm font-semibold tracking-tight text-neutral-500 dark:text-neutral-400">
          {activeWorkspaceLabel}
        </span>
      </header>

      {uiError ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-red-700 max-md:mx-4 dark:text-red-400"
          role="alert"
        >
          {uiError}
        </div>
      ) : null}

      {activeWorkspaceConfigured === false ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-amber-700 max-md:mx-4 dark:text-amber-400"
          role="alert"
        >
          {activeWorkspaceConfigurationError ??
            'No session is configured. Configure the terminal session first.'}
        </div>
      ) : null}

      <section className="min-h-0 flex-1 overflow-hidden select-text">
        {hasCurrentWorkspace ? (
          <ChatThread messages={messages} />
        ) : (
          <div className="grid h-full place-items-center p-6">
            <div className="grid justify-items-center gap-3.5 text-center text-sm text-neutral-400 dark:text-neutral-500">
              <p>Select a project from the sidebar or open a new one.</p>
              <button
                type="button"
                className="appearance-none font-inherit transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 rounded-full bg-white/90 px-4 py-2.5 text-sm text-neutral-950 shadow-lg shadow-neutral-950/5 hover:-translate-y-px dark:bg-neutral-800/90 dark:text-neutral-100 dark:shadow-black/20"
                onClick={() => void openWorkspacePicker()}
                disabled={isOpeningProject}
              >
                {isOpeningProject ? 'Opening…' : 'Open project'}
              </button>
            </div>
          </div>
        )}
      </section>

      <PromptComposer />
    </section>
  )
}
