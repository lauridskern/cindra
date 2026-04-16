interface PromptInputCardProps {
  canCompose: boolean
  isSendingPrompt: boolean
  promptDraft: string
  setPromptDraft: (value: string) => void
  submitPrompt: () => Promise<void>
}

export function PromptInputCard({
  canCompose,
  isSendingPrompt,
  promptDraft,
  setPromptDraft,
  submitPrompt,
}: PromptInputCardProps) {
  return (
    <form
      className="mx-auto w-full max-w-3xl rounded-3xl border border-neutral-200/70 bg-white/90 px-4 pb-3.5 pt-4 shadow-xl shadow-neutral-950/5 backdrop-blur-lg dark:border-white/10 dark:bg-neutral-900/90 dark:shadow-black/20"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!canCompose || promptDraft.trim().length === 0) {
          return
        }

        await submitPrompt()
      }}
    >
      <label className="sr-only" htmlFor="prompt">
        Prompt
      </label>
      <textarea
        id="prompt"
        className="min-h-20 w-full resize-none bg-transparent text-base leading-6 text-neutral-900 outline-none placeholder:text-neutral-400 disabled:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:disabled:text-neutral-500"
        placeholder="Ask about this workspace…"
        value={promptDraft}
        onChange={(event) => setPromptDraft(event.target.value)}
        disabled={!canCompose}
        rows={3}
      />
      <div className="mt-2 flex items-center justify-between gap-4 max-md:flex-col max-md:items-stretch">
        <span className="text-sm text-neutral-400 dark:text-neutral-500">
          {isSendingPrompt ? 'Sending' : canCompose ? 'Ready' : 'Running'}
        </span>
        <button
          type="submit"
          className="appearance-none font-inherit transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
          aria-label="Send"
          disabled={!canCompose || promptDraft.trim().length === 0}
        >
          Send
        </button>
      </div>
    </form>
  )
}
