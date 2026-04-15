import { atom } from 'jotai'
import { atomWithReducer } from 'jotai/utils'

import { initialSessionState, sessionReducer } from './reducer'
import {
  selectActiveWorkspaceLabel,
  selectProjectSummaries,
  selectVisibleMessages,
} from './selectors'

export const sessionStateAtom = atomWithReducer(
  initialSessionState,
  sessionReducer,
)

export const promptInputAtom = atom('')
export const isOpeningProjectAtom = atom(false)
export const isSubmittingAtom = atom(false)
export const followupTextAtom = atom('')
export const selectedOptionIdsAtom = atom<string[]>([])
export const expandedProjectPathsAtom = atom<string[]>([])

export const runtimeStatusAtom = atom((get) => get(sessionStateAtom).runtimeStatus)
export const followupRequestAtom = atom((get) => get(sessionStateAtom).followup)
export const uiErrorAtom = atom((get) => get(sessionStateAtom).uiError)
export const isBusyAtom = atom(
  (get) => get(sessionStateAtom).activeRequestId != null,
)
export const hasCurrentWorkspaceAtom = atom(
  (get) => get(runtimeStatusAtom)?.workspacePath != null,
)
export const visibleMessagesAtom = atom((get) =>
  selectVisibleMessages(get(sessionStateAtom)),
)
export const projectSummariesAtom = atom((get) =>
  selectProjectSummaries(get(sessionStateAtom)),
)
export const activeWorkspaceLabelAtom = atom((get) =>
  selectActiveWorkspaceLabel(get(sessionStateAtom)),
)
export const canComposeAtom = atom((get) => {
  const runtimeStatus = get(runtimeStatusAtom)
  return Boolean(
    get(hasCurrentWorkspaceAtom) &&
      runtimeStatus?.configured &&
      !get(isBusyAtom) &&
      !get(isSubmittingAtom),
  )
})
