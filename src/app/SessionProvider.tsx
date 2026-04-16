import { useMemo, useState, type ReactNode } from 'react'

import type { SessionSnapshot } from '../services/desktop/contracts'
import {
  getActiveConversation,
  getActiveWorkspace,
  getActiveWorkspaceLabel,
  getPromptDraftKey,
} from './sessionSnapshot'
import { usePromptDraftStore } from '../hooks/usePromptDraftStore'
import { useLatestRef } from '../hooks/useLatestRef'
import { useSessionBootstrap } from '../hooks/useSessionBootstrap'
import { useSessionCommands } from '../hooks/useSessionCommands'
import {
  ConversationStateContext,
  PromptDraftContext,
  SessionActionsContext,
  SidebarStateContext,
} from './SessionContext'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionSnapshot, setSessionSnapshot] = useState<SessionSnapshot | null>(null)
  const [isOpeningProject, setIsOpeningProject] = useState(false)
  const sessionSnapshotRef = useLatestRef(sessionSnapshot)

  const currentPromptDraftKey = getPromptDraftKey(
    sessionSnapshot?.activeWorkspacePath,
    sessionSnapshot?.activeConversationId,
  )
  const promptDraftStore = usePromptDraftStore(currentPromptDraftKey)

  useSessionBootstrap({ setSessionSnapshot })

  const actionState = useSessionCommands({
    promptDraftStore,
    sessionSnapshotRef,
    setIsOpeningProject,
    setSessionSnapshot,
  })

  const hasCurrentWorkspace = sessionSnapshot?.activeWorkspacePath != null
  const activeWorkspace = getActiveWorkspace(sessionSnapshot)
  const activeConversation = getActiveConversation(sessionSnapshot)
  const followupRequest = sessionSnapshot?.visibleFollowup ?? null
  const canCompose =
    hasCurrentWorkspace &&
    (activeWorkspace?.configured ?? true) &&
    followupRequest == null &&
    !promptDraftStore.isSendingPrompt &&
    !(activeConversation?.isRunning ?? false)

  const conversationState = useMemo(
    () => ({
      activeWorkspaceLabel: getActiveWorkspaceLabel(sessionSnapshot),
      activeWorkspaceConfigured: activeWorkspace?.configured ?? true,
      activeWorkspaceConfigurationError: activeWorkspace?.configurationError ?? null,
      hasCurrentWorkspace,
      isOpeningProject,
      messages: sessionSnapshot?.visibleMessages ?? [],
      uiError: sessionSnapshot?.uiError ?? null,
    }),
    [
      activeWorkspace?.configurationError,
      activeWorkspace?.configured,
      hasCurrentWorkspace,
      isOpeningProject,
      sessionSnapshot,
    ],
  )

  const sidebarState = useMemo(
    () => ({
      activeWorkspacePath: sessionSnapshot?.activeWorkspacePath ?? null,
      hasCurrentWorkspace,
      isOpeningProject,
      workspaces: sessionSnapshot?.workspaces ?? [],
    }),
    [
      hasCurrentWorkspace,
      isOpeningProject,
      sessionSnapshot?.activeWorkspacePath,
      sessionSnapshot?.workspaces,
    ],
  )

  const promptState = useMemo(
    () => ({
      canCompose,
      followupRequest,
      isSendingPrompt: promptDraftStore.isSendingPrompt,
      promptDraft: promptDraftStore.promptDraft,
      setPromptDraft: promptDraftStore.setPromptDraft,
    }),
    [
      canCompose,
      followupRequest,
      promptDraftStore.isSendingPrompt,
      promptDraftStore.promptDraft,
      promptDraftStore.setPromptDraft,
    ],
  )

  return (
    <SessionActionsContext.Provider value={actionState}>
      <ConversationStateContext.Provider value={conversationState}>
        <SidebarStateContext.Provider value={sidebarState}>
          <PromptDraftContext.Provider value={promptState}>
            {children}
          </PromptDraftContext.Provider>
        </SidebarStateContext.Provider>
      </ConversationStateContext.Provider>
    </SessionActionsContext.Provider>
  )
}
