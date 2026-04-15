import type { FollowupRequest } from '../contracts'
import { ghostButtonClass, primaryButtonClass } from '../ui'

interface FollowupDialogProps {
  followup: FollowupRequest | null
  followupText: string
  selectedIds: string[]
  onTextChange: (value: string) => void
  onToggleOption: (optionId: string) => void
  onCancel: () => void
  onContinue: () => void
}

export function FollowupDialog({
  followup,
  followupText,
  selectedIds,
  onTextChange,
  onToggleOption,
  onCancel,
  onContinue,
}: FollowupDialogProps) {
  if (!followup) {
    return null
  }

  const canContinue =
    followup.kind === 'text'
      ? followupText.trim().length > 0
      : selectedIds.length > 0

  return (
    <div
      className="fixed inset-0 grid place-items-center bg-neutral-950/10 p-6 backdrop-blur-sm dark:bg-black/35"
      role="presentation"
    >
      <section
        className="w-full max-w-[440px] rounded-[24px] border border-white/60 bg-white/95 p-5 shadow-2xl shadow-neutral-950/10 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/94 dark:shadow-black/25"
        role="dialog"
        aria-modal="true"
        aria-labelledby="followup-title"
      >
        <p className="mb-2.5 select-text text-[0.74rem] uppercase tracking-[0.08em] text-neutral-400 dark:text-neutral-500">
          Follow-up
        </p>
        <h2
          id="followup-title"
          className="select-text text-base font-semibold leading-6 text-neutral-900 dark:text-neutral-100"
        >
          {followup.question}
        </h2>

        {followup.kind === 'text' ? (
          <textarea
            className="mt-4 min-h-[120px] w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50/80 p-3.5 text-[0.97rem] leading-[1.55] text-neutral-900 outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-neutral-950/60 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            value={followupText}
            onChange={(event) => onTextChange(event.target.value)}
            rows={4}
          />
        ) : (
          <div className="mt-4 grid gap-2.5">
            {followup.options?.map((option) => {
              const checked = selectedIds.includes(option.id)
              return (
                <label
                  key={option.id}
                  className="flex items-center gap-2.5 rounded-2xl border border-neutral-200 bg-neutral-50/80 px-3.5 py-3 text-sm text-neutral-700 dark:border-white/10 dark:bg-neutral-950/60 dark:text-neutral-200"
                >
                  <input
                    type={followup.kind === 'single' ? 'radio' : 'checkbox'}
                    name="followup-option"
                    checked={checked}
                    onChange={() => onToggleOption(option.id)}
                  />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch">
          <button
            type="button"
            className={ghostButtonClass}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={onContinue}
            disabled={!canContinue}
          >
            Continue
          </button>
        </div>
      </section>
    </div>
  )
}
