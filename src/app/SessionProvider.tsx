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
  PromptDraftContext,
  SessionActionsContext,
  SidebarStateContext,
  type SessionActionsContextValue,
} from './SessionContext'
import {
  initialSessionState,
  sessionReducer,
  type AppState,
  type SessionAction,
} from './sessionReducer'
import {
  selectActiveWorkspaceLabel,
  selectEmptyDraftConversationId,
  selectIsConversationRunning,
  selectProjectSummaries,
  selectVisibleMessages,
} from './sessionSelectors'

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

interface PromptDraftEntry {
  value: string
  isPending: boolean
}

type PromptDraftStore = Record<string, PromptDraftEntry>

interface PromptDraftStoreApi {
  clearPromptDraft: (key: string) => void
  draftsRef: MutableRefObject<PromptDraftStore>
  isSendingPrompt: boolean
  movePromptDraft: (fromKey: string | null, toKey: string | null) => void
  promptDraft: string
  setPromptDraft: (value: string) => void
  setPromptDraftPending: (key: string, isPending: boolean) => void
}

interface WorkspaceActionsApi
  extends Pick<SessionActionsContextValue, 'openProject' | 'openWorkspacePicker'> {
  ensureWorkspaceIsOpen: (workspacePath: string) => Promise<boolean>
}

function getPromptDraftEntry(
  drafts: PromptDraftStore,
  key: string,
): PromptDraftEntry | null {
  return drafts[key] ?? null
}

function writePromptDraftEntry(
  drafts: PromptDraftStore,
  key: string,
  entry: PromptDraftEntry | null,
): PromptDraftStore {
  const current = drafts[key] ?? null
  const nextEntry =
    entry == null || (entry.value === '' && !entry.isPending) ? null : entry

  if (nextEntry == null) {
    if (current == null) {
      return drafts
    }

    const nextDrafts = { ...drafts }
    delete nextDrafts[key]
    return nextDrafts
  }

  if (
    current?.value === nextEntry.value &&
    current?.isPending === nextEntry.isPending
  ) {
    return drafts
  }

  return {
    ...drafts,
    [key]: nextEntry,
  }
}

function setPromptDraftEntryValue(
  drafts: PromptDraftStore,
  key: string,
  value: string,
): PromptDraftStore {
  const current = getPromptDraftEntry(drafts, key) ?? {
    value: '',
    isPending: false,
  }

  return writePromptDraftEntry(drafts, key, { ...current, value })
}

function setPromptDraftEntryPending(
  drafts: PromptDraftStore,
  key: string,
  isPending: boolean,
): PromptDraftStore {
  const current = getPromptDraftEntry(drafts, key) ?? {
    value: '',
    isPending: false,
  }

  return writePromptDraftEntry(drafts, key, { ...current, isPending })
}

function movePromptDraftEntry(
  drafts: PromptDraftStore,
  fromKey: string | null,
  toKey: string | null,
): PromptDraftStore {
  if (fromKey == null || toKey == null || fromKey === toKey) {
    return drafts
  }

  const draft = getPromptDraftEntry(drafts, fromKey)
  if (draft == null) {
    return drafts
  }

  const nextDrafts = {
    ...writePromptDraftEntry(drafts, toKey, draft),
  }
  delete nextDrafts[fromKey]
  return nextDrafts
}

function usePromptDraftStore(currentPromptDraftKey: string | null): PromptDraftStoreApi {
  const [drafts, setDrafts] = useState<PromptDraftStore>({})
  const draftsRef = useLatestRef(drafts)
  const currentEntry =
    currentPromptDraftKey == null ? null : getPromptDraftEntry(drafts, currentPromptDraftKey)

  const setPromptDraft = useCallback(
    (value: string) => {
      if (currentPromptDraftKey == null) {
        return
      }

      setDrafts((current) =>
        setPromptDraftEntryValue(current, currentPromptDraftKey, value),
      )
    },
    [currentPromptDraftKey],
  )

  const clearPromptDraft = useCallback((key: string) => {
    setDrafts((current) => setPromptDraftEntryValue(current, key, ''))
  }, [])

  const movePromptDraft = useCallback((fromKey: string | null, toKey: string | null) => {
    setDrafts((current) => movePromptDraftEntry(current, fromKey, toKey))
  }, [])

  const setPromptDraftPending = useCallback((key: string, isPending: boolean) => {
    setDrafts((current) => setPromptDraftEntryPending(current, key, isPending))
  }, [])

  return {
    clearPromptDraft,
    draftsRef,
    isSendingPrompt: currentEntry?.isPending ?? false,
    movePromptDraft,
    promptDraft: currentEntry?.value ?? '',
    setPromptDraft,
    setPromptDraftPending,
  }
}

function useWorkspaceActions({
  dispatch,
  sessionStateRef,
  setIsOpeningProject,
}: {
  dispatch: Dispatch<SessionAction>
  sessionStateRef: MutableRefObject<AppState>
  setIsOpeningProject: (isOpeningProject: boolean) => void
}): WorkspaceActionsApi {
  const refreshProjects = useCallback(async () => {
    const projects = await desktopClient.listProjects()
    dispatch({ type: 'projects_loaded', items: projects })
  }, [dispatch])

  const openProjectAndRefresh = useCallback(
    async (workspacePath: string) => {
      const status = await desktopClient.openWorkspace(workspacePath)
      dispatch({ type: 'workspace_opened', status })
      await refreshProjects()
    },
    [dispatch, refreshProjects],
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
    [openProjectAndRefresh, sessionStateRef, setIsOpeningProject],
  )

  const openProject = useCallback(
    async (workspacePath: string) => {
      try {
        await ensureWorkspaceIsOpen(workspacePath)
      } catch (error) {
        dispatchUiError(dispatch, error)
      }
    },
    [dispatch, ensureWorkspaceIsOpen],
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
  }, [dispatch, openProject])

  return {
    ensureWorkspaceIsOpen,
    openProject,
    openWorkspacePicker,
  }
}

function useConversationActions({
  clearPromptDraft,
  dispatch,
  draftsRef,
  ensureWorkspaceIsOpen,
  movePromptDraft,
  sessionStateRef,
  setPromptDraftPending,
}: {
  clearPromptDraft: (key: string) => void
  dispatch: Dispatch<SessionAction>
  draftsRef: MutableRefObject<PromptDraftStore>
  ensureWorkspaceIsOpen: (workspacePath: string) => Promise<boolean>
  movePromptDraft: (fromKey: string | null, toKey: string | null) => void
  sessionStateRef: MutableRefObject<AppState>
  setPromptDraftPending: (key: string, isPending: boolean) => void
}): Pick<
  SessionActionsContextValue,
  'selectConversation' | 'startNewChat' | 'submitFollowup' | 'submitPrompt'
> {
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
    [dispatch, ensureWorkspaceIsOpen, sessionStateRef],
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
          movePromptDraft(
            getPromptDraftKey(targetWorkspacePath, null),
            getPromptDraftKey(targetWorkspacePath, result.conversationId),
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
    [dispatch, ensureWorkspaceIsOpen, movePromptDraft, sessionStateRef],
  )

  const submitPrompt = useCallback(async () => {
    const state = sessionStateRef.current
    const currentRuntimeStatus = state.runtimeStatus
    const workspacePath = getCurrentWorkspacePath(state)
    const originConversationId = state.currentConversationId
    const draftKey = getPromptDraftKey(workspacePath, originConversationId)
    const draftEntry =
      draftKey == null ? null : getPromptDraftEntry(draftsRef.current, draftKey)
    const trimmedPrompt = draftEntry?.value.trim() ?? ''

    if (
      workspacePath == null ||
      draftKey == null ||
      trimmedPrompt === '' ||
      !currentRuntimeStatus?.configured ||
      selectIsConversationRunning(state, originConversationId) ||
      draftEntry?.isPending === true
    ) {
      return
    }

    setPromptDraftPending(draftKey, true)

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

      clearPromptDraft(draftKey)
    } catch (error) {
      dispatchUiError(dispatch, error)
    } finally {
      setPromptDraftPending(draftKey, false)
    }
  }, [clearPromptDraft, dispatch, draftsRef, sessionStateRef, setPromptDraftPending])

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
    [dispatch, sessionStateRef],
  )

  return {
    selectConversation,
    startNewChat,
    submitFollowup,
    submitPrompt,
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionState, dispatch] = useReducer(sessionReducer, initialSessionState)
  const [isOpeningProject, setIsOpeningProject] = useState(false)
  const sessionStateRef = useLatestRef<AppState>(sessionState)

  useSessionBootstrap({ dispatch })

  const runtimeStatus = sessionState.runtimeStatus
  const projectSummaries = selectProjectSummaries(sessionState)
  const messages = selectVisibleMessages(sessionState)
  const uiError = sessionState.uiError
  const followupRequest = sessionState.followup
  const hasCurrentWorkspace = runtimeStatus?.workspacePath != null
  const activeWorkspaceLabel = selectActiveWorkspaceLabel(sessionState)
  const currentPromptDraftKey = getPromptDraftKey(
    runtimeStatus?.workspacePath ?? null,
    sessionState.currentConversationId,
  )
  const {
    clearPromptDraft,
    draftsRef,
    isSendingPrompt,
    movePromptDraft,
    promptDraft,
    setPromptDraft,
    setPromptDraftPending,
  } = usePromptDraftStore(currentPromptDraftKey)
  const canCompose = Boolean(
    hasCurrentWorkspace &&
      runtimeStatus?.configured &&
      !selectIsConversationRunning(sessionState, sessionState.currentConversationId) &&
      !isSendingPrompt,
  )
  const { ensureWorkspaceIsOpen, openProject, openWorkspacePicker } = useWorkspaceActions({
    dispatch,
    sessionStateRef,
    setIsOpeningProject,
  })
  const { selectConversation, startNewChat, submitFollowup, submitPrompt } =
    useConversationActions({
      clearPromptDraft,
      dispatch,
      draftsRef,
      ensureWorkspaceIsOpen,
      movePromptDraft,
      sessionStateRef,
      setPromptDraftPending,
    })

  const conversationState = useMemo(
    () => ({
      activeWorkspaceLabel,
      hasCurrentWorkspace,
      isOpeningProject,
      messages,
      runtimeStatus,
      uiError,
    }),
    [
      activeWorkspaceLabel,
      hasCurrentWorkspace,
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

  const promptDraftState = useMemo(
    () => ({
      canCompose,
      followupRequest,
      isSendingPrompt,
      promptDraft,
      setPromptDraft,
    }),
    [canCompose, followupRequest, isSendingPrompt, promptDraft, setPromptDraft],
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
            {children}
          </PromptDraftContext.Provider>
        </ConversationStateContext.Provider>
      </SidebarStateContext.Provider>
    </SessionActionsContext.Provider>
  )
}
