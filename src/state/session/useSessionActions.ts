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

  const openWorkspacePicker = useCallback(async () => {
    try {
      const selectedPath = await desktopClient.pickWorkspace()
      if (selectedPath == null) {
        return
      }

      await openProjectWorkflow(
        {
          client: desktopClient,
          dispatch: dispatchSession,
          sessionState: store.get(sessionStateAtom),
          ensureProjectExpanded,
          toggleProjectExpanded,
          setIsOpeningProject,
        },
        selectedPath,
      )
    } catch (error) {
      dispatchSession({ type: 'ui_error', message: formatError(error) })
    }
  }, [
    dispatchSession,
    ensureProjectExpanded,
    setIsOpeningProject,
    store,
    toggleProjectExpanded,
  ])

  const openProject = useCallback(
    async (workspacePath: string) => {
      await openProjectWorkflow(
        {
          client: desktopClient,
          dispatch: dispatchSession,
          sessionState: store.get(sessionStateAtom),
          ensureProjectExpanded,
          toggleProjectExpanded,
          setIsOpeningProject,
        },
        workspacePath,
      )
    },
    [
      dispatchSession,
      ensureProjectExpanded,
      setIsOpeningProject,
      store,
      toggleProjectExpanded,
    ],
  )

  const startNewChat = useCallback(
    async (workspacePath?: string) => {
      await startNewChatWorkflow(
        {
          client: desktopClient,
          dispatch: dispatchSession,
          sessionState: store.get(sessionStateAtom),
          ensureProjectExpanded,
          toggleProjectExpanded,
          setIsOpeningProject,
        },
        workspacePath,
      )
    },
    [
      dispatchSession,
      ensureProjectExpanded,
      setIsOpeningProject,
      store,
      toggleProjectExpanded,
    ],
  )

  const selectConversation = useCallback(
    async (workspacePath: string, conversationId: string) => {
      await selectConversationWorkflow(
        {
          client: desktopClient,
          dispatch: dispatchSession,
          sessionState: store.get(sessionStateAtom),
          ensureProjectExpanded,
          toggleProjectExpanded,
          setIsOpeningProject,
        },
        workspacePath,
        conversationId,
      )
    },
    [
      dispatchSession,
      ensureProjectExpanded,
      setIsOpeningProject,
      store,
      toggleProjectExpanded,
    ],
  )

  const submitPrompt = useCallback(async () => {
    await submitPromptWorkflow(
      {
        client: desktopClient,
        dispatch: dispatchSession,
        sessionState: store.get(sessionStateAtom),
        isSubmitting: store.get(isSubmittingAtom),
        clearPromptInput,
        setIsSubmitting,
      },
      store.get(promptInputAtom),
    )
  }, [clearPromptInput, dispatchSession, setIsSubmitting, store])

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
      await submitFollowupWorkflow(
        {
          client: desktopClient,
          dispatch: dispatchSession,
          sessionState: store.get(sessionStateAtom),
          followupText: store.get(followupTextAtom),
          selectedOptionIds: store.get(selectedOptionIdsAtom),
        },
        cancelled,
      )
    },
    [dispatchSession, store],
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
