import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
} from 'react'

import * as desktopClient from '../services/desktop/client'
import type { FollowupResponse } from '../services/desktop/contracts'
import { useSessionBootstrap } from '../hooks/useSessionBootstrap'
import { formatError } from '../utils/errors'
import {
  ConversationStateContext,
  FollowupStateContext,
  PromptDraftContext,
  SessionActionsContext,
  SidebarStateContext,
} from './SessionContext'
import {
  initialSessionState,
  selectActiveWorkspaceLabel,
  selectEmptyDraftConversationId,
  selectIsConversationRunning,
  selectProjectSummaries,
  selectVisibleMessages,
  sessionReducer,
  type AppState,
  type SessionAction,
} from './sessionReducer'

function dispatchUiError(dispatch: Dispatch<SessionAction>, error: unknown) {
  dispatch({ type: 'ui_error', message: formatError(error) })
}

function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

function getCurrentWorkspacePath(state: AppState): string | null {
  return state.runtimeStatus?.workspacePath ?? null
}

function getConversationDraftKey(conversationId: string): string {
  return `conversation:${conversationId}`
}

function getWorkspaceDraftKey(workspacePath: string): string {
  return `workspace:${workspacePath}`
}

function getPromptDraftKey(
  workspacePath: string | null | undefined,
  conversationId: string | null,
): string | null {
  if (conversationId != null) {
    return getConversationDraftKey(conversationId)
  }

  if (workspacePath != null) {
    return getWorkspaceDraftKey(workspacePath)
  }

  return null
}

function setPromptDraftValue(
  drafts: Record<string, string>,
  key: string,
  value: string,
): Record<string, string> {
  if (value === '') {
    if (!(key in drafts)) {
      return drafts
    }

    const nextDrafts = { ...drafts }
    delete nextDrafts[key]
    return nextDrafts
  }

  if (drafts[key] === value) {
    return drafts
  }

  return {
    ...drafts,
    [key]: value,
  }
}

function clearPromptDraft(
  drafts: Record<string, string>,
  key: string,
): Record<string, string> {
  if (!(key in drafts)) {
    return drafts
  }

  const nextDrafts = { ...drafts }
  delete nextDrafts[key]
  return nextDrafts
}

function movePromptDraft(
  drafts: Record<string, string>,
  fromKey: string | null,
  toKey: string | null,
): Record<string, string> {
  if (fromKey == null || toKey == null || fromKey === toKey) {
    return drafts
  }

  const draft = drafts[fromKey]
  if (draft == null || draft === '') {
    return drafts
  }

  const nextDrafts = { ...drafts, [toKey]: draft }
  delete nextDrafts[fromKey]
  return nextDrafts
}

function setPromptDraftPending(
  pendingDrafts: Record<string, true>,
  key: string,
  isPending: boolean,
): Record<string, true> {
  if (isPending) {
    return key in pendingDrafts ? pendingDrafts : { ...pendingDrafts, [key]: true }
  }

  if (!(key in pendingDrafts)) {
    return pendingDrafts
  }

  const nextPendingDrafts = { ...pendingDrafts }
  delete nextPendingDrafts[key]
  return nextPendingDrafts
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionState, dispatch] = useReducer(sessionReducer, initialSessionState)
  const [isOpeningProject, setIsOpeningProject] = useState(false)
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({})
  const [pendingPromptDraftKeys, setPendingPromptDraftKeys] = useState<
    Record<string, true>
  >({})
  const sessionStateRef = useLatestRef<AppState>(sessionState)
  const promptDraftsRef = useLatestRef(promptDrafts)
  const pendingPromptDraftKeysRef = useLatestRef(pendingPromptDraftKeys)

  useSessionBootstrap({ dispatch })

  const runtimeStatus = sessionState.runtimeStatus
  const projectSummaries = selectProjectSummaries(sessionState)
  const messages = selectVisibleMessages(sessionState)
  const uiError = sessionState.uiError
  const followupRequest = sessionState.followup
  const isCurrentConversationRunning = selectIsConversationRunning(
    sessionState,
    sessionState.currentConversationId,
  )
  const hasCurrentWorkspace = runtimeStatus?.workspacePath != null
  const activeWorkspaceLabel = selectActiveWorkspaceLabel(sessionState)
  const currentPromptDraftKey = useMemo(
    () =>
      getPromptDraftKey(
        runtimeStatus?.workspacePath ?? null,
        sessionState.currentConversationId,
      ),
    [runtimeStatus?.workspacePath, sessionState.currentConversationId],
  )
  const promptDraft =
    currentPromptDraftKey == null ? '' : promptDrafts[currentPromptDraftKey] ?? ''
  const isSendingPrompt =
    currentPromptDraftKey != null && pendingPromptDraftKeys[currentPromptDraftKey] === true
  const canCompose = Boolean(
    hasCurrentWorkspace &&
      runtimeStatus?.configured &&
      !isCurrentConversationRunning &&
      !isSendingPrompt,
  )

  const setPromptDraft = useCallback(
    (value: string) => {
      if (currentPromptDraftKey == null) {
        return
      }

      setPromptDrafts((current) =>
        setPromptDraftValue(current, currentPromptDraftKey, value),
      )
    },
    [currentPromptDraftKey],
  )

  const refreshProjects = useCallback(async () => {
    const projects = await desktopClient.listProjects()
    dispatch({ type: 'projects_loaded', items: projects })
  }, [])

  const openProjectAndRefresh = useCallback(
    async (workspacePath: string) => {
      const status = await desktopClient.openWorkspace(workspacePath)
      dispatch({ type: 'workspace_opened', status })
      await refreshProjects()
    },
    [refreshProjects],
  )

  const ensureWorkspaceIsOpen = useCallback(
    async (workspacePath: string) => {
      if (getCurrentWorkspacePath(sessionStateRef.current) === workspacePath) {
        return false
      }

      setIsOpeningProject(true)

      try {
        await openProjectAndRefresh(workspacePath)
        return true
      } finally {
        setIsOpeningProject(false)
      }
    },
    [openProjectAndRefresh, sessionStateRef],
  )

  const openProject = useCallback(
    async (workspacePath: string) => {
      try {
        await ensureWorkspaceIsOpen(workspacePath)
      } catch (error) {
        dispatchUiError(dispatch, error)
      }
    },
    [ensureWorkspaceIsOpen],
  )

  const openWorkspacePicker = useCallback(async () => {
    let selectedPath: string | null

    try {
      selectedPath = await desktopClient.pickWorkspace()
    } catch (error) {
      dispatchUiError(dispatch, error)
      return null
    }

    if (selectedPath == null) {
      return null
    }

    await openProject(selectedPath)
    return selectedPath
  }, [openProject])

  const selectConversation = useCallback(
    async (workspacePath: string, conversationId: string) => {
      try {
        await ensureWorkspaceIsOpen(workspacePath)

        dispatch({ type: 'conversation_selected', conversationId })

        const latestState = sessionStateRef.current
        if (latestState.transcripts[conversationId] == null) {
          const transcript = await desktopClient.loadConversation(conversationId)
          dispatch({ type: 'conversation_loaded', item: transcript })
        }
      } catch (error) {
        dispatchUiError(dispatch, error)
      }
    },
    [ensureWorkspaceIsOpen, sessionStateRef],
  )

  const startNewChat = useCallback(
    async (workspacePath?: string) => {
      const state = sessionStateRef.current
      const targetWorkspacePath = workspacePath ?? getCurrentWorkspacePath(state)

      if (targetWorkspacePath == null) {
        return
      }

      try {
        await ensureWorkspaceIsOpen(targetWorkspacePath)

        const reusableDraftConversationId = selectEmptyDraftConversationId(
          sessionStateRef.current,
          targetWorkspacePath,
        )
        if (reusableDraftConversationId != null) {
          dispatch({
            type: 'conversation_selected',
            conversationId: reusableDraftConversationId,
          })
          return
        }

        const originConversationId = sessionStateRef.current.currentConversationId
        const result = await desktopClient.resetChat()

        if (originConversationId == null) {
          setPromptDrafts((current) =>
            movePromptDraft(
              current,
              getPromptDraftKey(targetWorkspacePath, null),
              getPromptDraftKey(targetWorkspacePath, result.conversationId),
            ),
          )
        }

        dispatch({
          type: 'chat_reset',
          workspacePath: targetWorkspacePath,
          originConversationId,
          conversationId: result.conversationId,
        })
      } catch (error) {
        dispatchUiError(dispatch, error)
      }
    },
    [ensureWorkspaceIsOpen, sessionStateRef],
  )

  const submitPrompt = useCallback(async () => {
    const state = sessionStateRef.current
    const currentRuntimeStatus = state.runtimeStatus
    const workspacePath = getCurrentWorkspacePath(state)
    const originConversationId = state.currentConversationId
    const draftKey = getPromptDraftKey(workspacePath, originConversationId)
    const trimmedPrompt =
      draftKey == null ? '' : (promptDraftsRef.current[draftKey] ?? '').trim()

    if (
      workspacePath == null ||
      draftKey == null ||
      trimmedPrompt === '' ||
      !currentRuntimeStatus?.configured ||
      selectIsConversationRunning(state, originConversationId) ||
      pendingPromptDraftKeysRef.current[draftKey] === true
    ) {
      return
    }

    setPendingPromptDraftKeys((current) => setPromptDraftPending(current, draftKey, true))

    try {
      const result = await desktopClient.sendPrompt({
        prompt: trimmedPrompt,
        conversationId: originConversationId ?? undefined,
      })

      dispatch({
        type: 'prompt_queued',
        workspacePath,
        originConversationId,
        conversationId: result.conversationId,
        requestId: result.requestId,
        prompt: trimmedPrompt,
      })

      if (draftKey != null) {
        setPromptDrafts((current) => clearPromptDraft(current, draftKey))
      }
    } catch (error) {
      dispatchUiError(dispatch, error)
    } finally {
      setPendingPromptDraftKeys((current) => setPromptDraftPending(current, draftKey, false))
    }
  }, [pendingPromptDraftKeysRef, promptDraftsRef, sessionStateRef])

  const submitFollowup = useCallback(
    async (input: {
      cancelled: boolean
      text?: string
      selectedOptionIds?: string[]
    }) => {
      const followup = sessionStateRef.current.followup
      if (followup == null) {
        return
      }

      const response: FollowupResponse = {
        followupId: followup.followupId,
        cancelled: input.cancelled,
      }

      if (!input.cancelled) {
        if (followup.kind === 'text') {
          response.text = input.text ?? ''
        } else {
          response.selectedOptionIds = input.selectedOptionIds ?? []
        }
      }

      try {
        await desktopClient.respondFollowup(response)
        dispatch({ type: 'followup_cleared' })
      } catch (error) {
        dispatchUiError(dispatch, error)
      }
    },
    [sessionStateRef],
  )

  const conversationState = useMemo(
    () => ({
      activeWorkspaceLabel,
      hasCurrentWorkspace,
      isBusy: isCurrentConversationRunning,
      isOpeningProject,
      messages,
      runtimeStatus,
      uiError,
    }),
    [
      activeWorkspaceLabel,
      hasCurrentWorkspace,
      isCurrentConversationRunning,
      isOpeningProject,
      messages,
      runtimeStatus,
      uiError,
    ],
  )

  const sidebarState = useMemo(
    () => ({
      hasCurrentWorkspace,
      isOpeningProject,
      projectSummaries,
    }),
    [hasCurrentWorkspace, isOpeningProject, projectSummaries],
  )

  const followupState = useMemo(
    () => ({
      followupRequest,
    }),
    [followupRequest],
  )

  const promptDraftState = useMemo(
    () => ({
      canCompose,
      isSendingPrompt,
      promptDraft,
      setPromptDraft,
    }),
    [canCompose, isSendingPrompt, promptDraft, setPromptDraft],
  )

  const actions = useMemo(
    () => ({
      openWorkspacePicker,
      openProject,
      selectConversation,
      startNewChat,
      submitPrompt,
      submitFollowup,
    }),
    [
      openWorkspacePicker,
      openProject,
      selectConversation,
      startNewChat,
      submitPrompt,
      submitFollowup,
    ],
  )

  return (
    <SessionActionsContext.Provider value={actions}>
      <SidebarStateContext.Provider value={sidebarState}>
        <ConversationStateContext.Provider value={conversationState}>
          <PromptDraftContext.Provider value={promptDraftState}>
            <FollowupStateContext.Provider value={followupState}>
              {children}
            </FollowupStateContext.Provider>
          </PromptDraftContext.Provider>
        </ConversationStateContext.Provider>
      </SidebarStateContext.Provider>
    </SessionActionsContext.Provider>
  )
}
