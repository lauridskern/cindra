import { useContext, useMemo, useSyncExternalStore, type Context } from 'react'

import {
  ConversationStateContext,
  PromptDraftContext,
  SessionActionsContext,
  SidebarStateContext,
  WorkspaceBoardContext,
  WorkspaceBoardSelectionContext,
} from '../app/SessionContext'

function useRequiredContext<T>(context: Context<T | null>, name: string): T {
  const value = useContext(context)

  if (value == null) {
    throw new Error(`${name} must be used within a SessionProvider`)
  }

  return value
}

export function useConversationSession() {
  return useRequiredContext(ConversationStateContext, 'useConversationSession')
}

export function useSidebarSession() {
  return useRequiredContext(SidebarStateContext, 'useSidebarSession')
}

export function usePromptDraft() {
  return useRequiredContext(PromptDraftContext, 'usePromptDraft')
}

export function useSessionActions() {
  return useRequiredContext(SessionActionsContext, 'useSessionActions')
}

export function useWorkspaceBoard() {
  return useRequiredContext(WorkspaceBoardContext, 'useWorkspaceBoard')
}

export function useWorkspaceBoardSelection() {
  const store = useRequiredContext(
    WorkspaceBoardSelectionContext,
    'useWorkspaceBoardSelection',
  )

  const selection = useSyncExternalStore(
    store.subscribe,
    store.getSelection,
    store.getSelection,
  )

  return useMemo(
    () => ({
      selection,
      setSelection: store.setSelection,
    }),
    [selection, store],
  )
}
