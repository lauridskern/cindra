import { cn } from '../../../lib/cn'
import { primaryButtonClass } from '../../../styles/classes'

interface PromptComposerProps {
  canCompose: boolean
  isBusy: boolean
  promptInput: string
  onPromptInputChange: (value: string) => void
  onSubmit: () => void
}

export function PromptComposer({
  canCompose,
  isBusy,
  promptInput,
  onPromptInputChange,
  onSubmit,
}: PromptComposerProps) {
  return (
    <div className="px-6 pb-6 pt-3.5 max-[720px]:px-4">
      <form
        className="mx-auto w-full max-w-[760px] rounded-[24px] border border-neutral-200/70 bg-white/90 px-[18px] pb-3.5 pt-4 shadow-xl shadow-neutral-950/5 backdrop-blur-lg dark:border-white/10 dark:bg-neutral-900/88 dark:shadow-black/20"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <label className="sr-only" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          className="min-h-[74px] w-full resize-none bg-transparent text-[0.97rem] leading-[1.55] text-neutral-900 outline-none placeholder:text-neutral-400 disabled:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:disabled:text-neutral-500"
          placeholder="Ask Forge to inspect or change this workspace…"
          value={promptInput}
          onChange={(event) => onPromptInputChange(event.target.value)}
          disabled={!canCompose}
          rows={3}
        />
        <div className="mt-2 flex items-center justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch">
          <span className="text-sm text-neutral-400 dark:text-neutral-500">
            {isBusy ? 'Running' : 'Ready'}
          </span>
          <button
            type="submit"
            className={cn(primaryButtonClass, 'px-[15px]')}
            aria-label="Send"
            disabled={!canCompose || promptInput.trim().length === 0}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
