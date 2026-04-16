import type { StatusCategory } from '../services/desktop/contracts'

import { cn } from '../utils/cn'

export const interactiveBaseClass =
  'appearance-none font-inherit transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45'

export const navRowClass = cn(
  interactiveBaseClass,
  'flex min-h-7 items-center gap-2 rounded-md px-1.5 text-left text-xs text-neutral-800 hover:bg-neutral-950/5 dark:text-neutral-200 dark:hover:bg-white/10',
)

export const projectActionButtonClass = cn(
  interactiveBaseClass,
  'inline-flex size-7 items-center justify-center rounded-md bg-neutral-950/5 text-neutral-500 hover:bg-neutral-950/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15',
)

export const threadRowClass = cn(
  interactiveBaseClass,
  'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs leading-5 text-neutral-800 hover:bg-neutral-950/5 dark:text-neutral-200 dark:hover:bg-white/10',
)

export const primaryButtonClass = cn(
  interactiveBaseClass,
  'rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900',
)

export const ghostButtonClass = cn(
  interactiveBaseClass,
  'rounded-full border border-neutral-200 bg-white/85 px-4 py-2.5 text-sm text-neutral-700 dark:border-white/10 dark:bg-neutral-900/80 dark:text-neutral-200',
)

export function statusToneClass(category: StatusCategory): string {
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
