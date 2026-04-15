import { useCallback } from 'react'
import { useStore } from 'jotai'

import * as desktopClient from '../../services/desktop/client'
import { formatError } from '../../lib/errors'
import type { SessionAction } from './reducer'
import {
  expandedProjectPathsAtom,
  followupRequestAtom,
  followupTextAtom,
  isSubmittingAtom,
  isOpeningProjectAtom,
  promptInputAtom,
  selectedOptionIdsAtom,
  sessionStateAtom,
} from './atoms'
import {
  openProject as openProjectWorkflow,
  selectConversation as selectConversationWorkflow,
  startNewChat as startNewChatWorkflow,
  submitFollowup as submitFollowupWorkflow,
  submitPrompt as submitPromptWorkflow,
} from './workflows'

export function useSessionActions() {
  const store = useStore()

  const getSessionState = useCallback(() => store.get(sessionStateAtom), [store])

  const dispatchSession = useCallback(
    (action: SessionAction) => {
      store.set(sessionStateAtom, action)
    },
    [store],
  )

  const ensureProjectExpanded = useCallback(
    (workspacePath: string) => {
      const current = store.get(expandedProjectPathsAtom)
      if (!current.includes(workspacePath)) {
        store.set(expandedProjectPathsAtom, [...current, workspacePath])
      }
    },
    [store],
  )

  const toggleProjectExpanded = useCallback(
    (workspacePath: string) => {
      const current = store.get(expandedProjectPathsAtom)
      store.set(
        expandedProjectPathsAtom,
        current.includes(workspacePath)
          ? current.filter((path) => path !== workspacePath)
          : [...current, workspacePath],
      )
    },
    [store],
  )

  const setIsOpeningProject = useCallback(
    (value: boolean) => {
      store.set(isOpeningProjectAtom, value)
    },
    [store],
  )

  const setIsSubmitting = useCallback(
    (value: boolean) => {
      store.set(isSubmittingAtom, value)
    },
    [store],
  )

  const clearPromptInput = useCallback(() => {
    store.set(promptInputAtom, '')
  }, [store])

  const createProjectWorkflowContext = useCallback(
    () => ({
      client: desktopClient,
      dispatch: dispatchSession,
      sessionState: getSessionState(),
      ensureProjectExpanded,
      toggleProjectExpanded,
      setIsOpeningProject,
    }),
    [
      dispatchSession,
      ensureProjectExpanded,
      getSessionState,
      setIsOpeningProject,
      toggleProjectExpanded,
    ],
  )

  const createPromptWorkflowContext = useCallback(
    () => ({
      client: desktopClient,
      dispatch: dispatchSession,
      sessionState: getSessionState(),
      isSubmitting: store.get(isSubmittingAtom),
      clearPromptInput,
      setIsSubmitting,
    }),
    [
      clearPromptInput,
      dispatchSession,
      getSessionState,
      setIsSubmitting,
      store,
    ],
  )

  const createFollowupWorkflowContext = useCallback(
    () => ({
      client: desktopClient,
      dispatch: dispatchSession,
      sessionState: getSessionState(),
      followupText: store.get(followupTextAtom),
      selectedOptionIds: store.get(selectedOptionIdsAtom),
    }),
    [dispatchSession, getSessionState, store],
  )

  const openWorkspacePicker = useCallback(async () => {
    try {
      const selectedPath = await desktopClient.pickWorkspace()
      if (selectedPath == null) {
        return
      }

      await openProjectWorkflow(createProjectWorkflowContext(), selectedPath)
    } catch (error) {
      dispatchSession({ type: 'ui_error', message: formatError(error) })
    }
  }, [createProjectWorkflowContext, dispatchSession])

  const openProject = useCallback(
    async (workspacePath: string) => {
      await openProjectWorkflow(createProjectWorkflowContext(), workspacePath)
    },
    [createProjectWorkflowContext],
  )

  const startNewChat = useCallback(
    async (workspacePath?: string) => {
      await startNewChatWorkflow(createProjectWorkflowContext(), workspacePath)
    },
    [createProjectWorkflowContext],
  )

  const selectConversation = useCallback(
    async (workspacePath: string, conversationId: string) => {
      await selectConversationWorkflow(
        createProjectWorkflowContext(),
        workspacePath,
        conversationId,
      )
    },
    [createProjectWorkflowContext],
  )

  const submitPrompt = useCallback(async () => {
    await submitPromptWorkflow(
      createPromptWorkflowContext(),
      store.get(promptInputAtom),
    )
  }, [createPromptWorkflowContext, store])

  const toggleFollowupOption = useCallback(
    (optionId: string) => {
      const followupRequest = store.get(followupRequestAtom)
      if (followupRequest == null) {
        return
      }

      if (followupRequest.kind === 'single') {
        store.set(selectedOptionIdsAtom, [optionId])
        return
      }

      const current = store.get(selectedOptionIdsAtom)
      store.set(
        selectedOptionIdsAtom,
        current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      )
    },
    [store],
  )

  const submitFollowup = useCallback(
    async (cancelled: boolean) => {
      await submitFollowupWorkflow(createFollowupWorkflowContext(), cancelled)
    },
    [createFollowupWorkflowContext],
  )

  return {
    openWorkspacePicker,
    openProject,
    startNewChat,
    selectConversation,
    submitPrompt,
    toggleFollowupOption,
    submitFollowup,
  }
}
