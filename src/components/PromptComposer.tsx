import { useState } from 'react'

import type { FollowupRequest } from '../services/desktop/contracts'
import { useFollowupSession, usePromptDraft, useSessionActions } from '../hooks/useSession'
import {
  ghostButtonClass,
  primaryButtonClass,
} from '../styles/classes'
import { cn } from '../utils/cn'

export function PromptComposer() {
  const { followupRequest } = useFollowupSession()
  const { submitPrompt } = useSessionActions()
  const { canCompose, isSendingPrompt, promptDraft, setPromptDraft } = usePromptDraft()

  return (
    <div className="px-6 pb-6 pt-3.5 max-md:px-4">
      {followupRequest != null ? (
        <InlineFollowupComposer
          key={followupRequest.followupId}
          followupRequest={followupRequest}
        />
      ) : (
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
              className={cn(primaryButtonClass, 'px-4')}
              aria-label="Send"
              disabled={!canCompose || promptDraft.trim().length === 0}
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function InlineFollowupComposer({
  followupRequest,
}: {
  followupRequest: FollowupRequest
}) {
  const [followupText, setFollowupText] = useState('')
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([])
  const { submitFollowup } = useSessionActions()

  const canContinue =
    followupRequest.kind === 'text'
      ? followupText.trim().length > 0
      : selectedOptionIds.length > 0

  function toggleFollowupOption(optionId: string) {
    if (followupRequest.kind === 'single') {
      setSelectedOptionIds([optionId])
      return
    }

    setSelectedOptionIds((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    )
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-neutral-200/70 bg-white/90 px-4 pb-3.5 pt-4 shadow-xl shadow-neutral-950/5 backdrop-blur-lg dark:border-white/10 dark:bg-neutral-900/90 dark:shadow-black/20">
      <p className="mb-2.5 select-text text-xs uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
        Follow-up
      </p>
      <h2 className="select-text text-base font-semibold leading-6 text-neutral-900 dark:text-neutral-100">
        {followupRequest.question}
      </h2>

      {followupRequest.kind === 'text' ? (
        <textarea
          className="mt-4 min-h-28 w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50/80 p-3.5 text-base leading-6 text-neutral-900 outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-neutral-950/60 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          aria-label="Follow-up response"
          value={followupText}
          onChange={(event) => setFollowupText(event.target.value)}
          rows={4}
        />
      ) : (
        <div className="mt-4 grid gap-2.5">
          {followupRequest.options?.map((option) => {
            const checked = selectedOptionIds.includes(option.id)
            return (
              <label
                key={option.id}
                className="flex items-center gap-2.5 rounded-2xl border border-neutral-200 bg-neutral-50/80 px-3.5 py-3 text-sm text-neutral-700 dark:border-white/10 dark:bg-neutral-950/60 dark:text-neutral-200"
              >
                <input
                  type={followupRequest.kind === 'single' ? 'radio' : 'checkbox'}
                  name={`followup-option-${followupRequest.followupId}`}
                  checked={checked}
                  onChange={() => toggleFollowupOption(option.id)}
                />
                <span>{option.label}</span>
              </label>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-4 max-md:flex-col max-md:items-stretch">
        <button
          type="button"
          className={ghostButtonClass}
          onClick={() => void submitFollowup({ cancelled: true })}
        >
          Cancel
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() =>
            void submitFollowup({
              cancelled: false,
              text: followupText,
              selectedOptionIds,
            })
          }
          disabled={!canContinue}
        >
          Continue
        </button>
      </div>
    </section>
  )
}
