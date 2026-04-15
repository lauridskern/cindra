import { getCurrentWindow } from '@tauri-apps/api/window'
import type { MouseEvent } from 'react'

import type { StatusCategory } from './contracts'

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function handleWindowDragStart(event: MouseEvent<HTMLElement>): void {
  if (event.button !== 0) {
    return
  }

  void getCurrentWindow().startDragging()
}

export const interactiveBaseClass =
  'appearance-none font-inherit transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45'

export const navRowClass = cn(
  interactiveBaseClass,
  'flex min-h-[28px] items-center gap-2 rounded-md px-1.5 text-left text-[0.72rem] text-neutral-800 hover:bg-neutral-950/[0.045] dark:text-neutral-200 dark:hover:bg-white/[0.08]',
)

export const projectActionButtonClass = cn(
  interactiveBaseClass,
  'inline-flex size-7 items-center justify-center rounded-md bg-neutral-950/[0.045] text-neutral-500 hover:bg-neutral-950/[0.075] dark:bg-white/[0.09] dark:text-neutral-300 dark:hover:bg-white/[0.15]',
)

export const threadRowClass = cn(
  interactiveBaseClass,
  'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.74rem] leading-5 text-neutral-800 hover:bg-neutral-950/[0.045] dark:text-neutral-200 dark:hover:bg-white/[0.08]',
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
