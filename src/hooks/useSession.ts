import { useContext, type Context } from 'react'

import {
  ConversationStateContext,
  PromptDraftContext,
  SessionActionsContext,
  SidebarStateContext,
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
