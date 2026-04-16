import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'

import * as desktopClient from '../services/desktop/client'
import type {
  FollowupResponse,
  SessionSnapshot,
  WorkspaceSession,
} from '../services/desktop/contracts'
import { useSessionBootstrap } from '../hooks/useSessionBootstrap'
import { formatError } from '../utils/errors'
import {
  ConversationStateContext,
  PromptDraftContext,
  SessionActionsContext,
  SidebarStateContext,
  type SessionActionsContextValue,
} from './SessionContext'

function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

function getConversationDraftKey(conversationId: string): string {
  return `conversation:${conversationId}`
}

function getWorkspaceDraftKey(workspacePath: string): string {
  return `workspace:${workspacePath}`
}

function getPromptDraftKey(
  workspacePath: string | null | undefined,
  conversationId: string | null | undefined,
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
  clearPromptDraft: (key: string | null) => void
  draftsRef: MutableRefObject<PromptDraftStore>
  isSendingPrompt: boolean
  movePromptDraft: (fromKey: string | null, toKey: string | null) => void
  promptDraft: string
  setPromptDraft: (value: string) => void
  setPromptDraftPending: (key: string | null, isPending: boolean) => void
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

  const clearPromptDraft = useCallback((key: string | null) => {
    if (key == null) {
      return
    }

    setDrafts((current) => setPromptDraftEntryValue(current, key, ''))
  }, [])

  const movePromptDraft = useCallback((fromKey: string | null, toKey: string | null) => {
    setDrafts((current) => movePromptDraftEntry(current, fromKey, toKey))
  }, [])

  const setPromptDraftPending = useCallback(
    (key: string | null, isPending: boolean) => {
      if (key == null) {
        return
      }

      setDrafts((current) => setPromptDraftEntryPending(current, key, isPending))
    },
    [],
  )

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

function getActiveWorkspace(
  snapshot: SessionSnapshot | null,
): WorkspaceSession | null {
  if (snapshot == null || snapshot.activeWorkspacePath == null) {
    return null
  }

  return (
    snapshot.workspaces.find(
      (workspace) => workspace.workspacePath === snapshot.activeWorkspacePath,
    ) ?? null
  )
}

function getActiveConversation(snapshot: SessionSnapshot | null) {
  const activeWorkspace = getActiveWorkspace(snapshot)
  if (activeWorkspace == null || snapshot?.activeConversationId == null) {
    return null
  }

  return (
    activeWorkspace.conversations.find(
      (conversation) => conversation.conversationId === snapshot.activeConversationId,
    ) ?? null
  )
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionSnapshot, setSessionSnapshot] = useState<SessionSnapshot | null>(null)
  const [localUiError, setLocalUiError] = useState<string | null>(null)
  const [isOpeningProject, setIsOpeningProject] = useState(false)
  const sessionSnapshotRef = useLatestRef(sessionSnapshot)

  const currentPromptDraftKey = getPromptDraftKey(
    sessionSnapshot?.activeWorkspacePath,
    sessionSnapshot?.activeConversationId,
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

  useSessionBootstrap({
    setSessionSnapshot,
    setUiError: setLocalUiError,
  })

  const openProject = useCallback(async (workspacePath: string) => {
    setIsOpeningProject(true)

    try {
      const snapshot = await desktopClient.openWorkspace(workspacePath)
      setSessionSnapshot(snapshot)
      setLocalUiError(null)
    } catch (error) {
      setLocalUiError(formatError(error))
    } finally {
      setIsOpeningProject(false)
    }
  }, [])

  const openWorkspacePicker = useCallback(async () => {
    try {
      const selectedPath = await desktopClient.pickWorkspace()
      if (selectedPath == null) {
        return null
      }

      await openProject(selectedPath)
      return selectedPath
    } catch (error) {
      setLocalUiError(formatError(error))
      return null
    }
  }, [openProject])

  const selectConversation = useCallback(
    async (workspacePath: string, conversationId: string) => {
      try {
        const snapshot = await desktopClient.selectConversation(
          workspacePath,
          conversationId,
        )
        setSessionSnapshot(snapshot)
        setLocalUiError(null)
      } catch (error) {
        setLocalUiError(formatError(error))
      }
    },
    [],
  )

  const startNewChat = useCallback(
    async (workspacePath?: string) => {
      const currentSnapshot = sessionSnapshotRef.current
      const targetWorkspacePath =
        workspacePath ?? currentSnapshot?.activeWorkspacePath ?? null

      if (targetWorkspacePath == null) {
        return
      }

      const originWorkspaceDraftKey = getWorkspaceDraftKey(targetWorkspacePath)

      try {
        const snapshot = await desktopClient.startNewChat(targetWorkspacePath)
        setSessionSnapshot(snapshot)
        setLocalUiError(null)

        const nextDraftKey = getPromptDraftKey(
          snapshot.activeWorkspacePath,
          snapshot.activeConversationId,
        )
        movePromptDraft(originWorkspaceDraftKey, nextDraftKey)
      } catch (error) {
        setLocalUiError(formatError(error))
      }
    },
    [movePromptDraft, sessionSnapshotRef],
  )

  const submitPrompt = useCallback(async () => {
    const currentSnapshot = sessionSnapshotRef.current
    const workspacePath = currentSnapshot?.activeWorkspacePath ?? null
    const conversationId = currentSnapshot?.activeConversationId ?? undefined
    const draftKey = getPromptDraftKey(workspacePath, conversationId ?? null)

    if (workspacePath == null || draftKey == null) {
      return
    }

    const prompt = draftsRef.current[draftKey]?.value?.trim() ?? ''
    if (prompt.length === 0) {
      return
    }

    let nextDraftKey: string | null = draftKey
    setPromptDraftPending(draftKey, true)

    try {
      const snapshot = await desktopClient.sendPrompt({
        workspacePath,
        conversationId,
        prompt,
      })
      setSessionSnapshot(snapshot)
      setLocalUiError(null)

      nextDraftKey = getPromptDraftKey(
        snapshot.activeWorkspacePath,
        snapshot.activeConversationId,
      )
      movePromptDraft(draftKey, nextDraftKey)
      clearPromptDraft(nextDraftKey)
    } catch (error) {
      setLocalUiError(formatError(error))
    } finally {
      setPromptDraftPending(draftKey, false)
      if (nextDraftKey !== draftKey) {
        setPromptDraftPending(nextDraftKey, false)
      }
    }
  }, [
    clearPromptDraft,
    draftsRef,
    movePromptDraft,
    sessionSnapshotRef,
    setPromptDraftPending,
  ])

  const submitFollowup = useCallback(
    async (input: {
      cancelled: boolean
      text?: string
      selectedOptionIds?: string[]
    }) => {
      const followupRequest = sessionSnapshotRef.current?.visibleFollowup ?? null
      if (followupRequest == null) {
        return
      }

      const response: FollowupResponse = {
        followupId: followupRequest.followupId,
        cancelled: input.cancelled,
        text: input.text,
        selectedOptionIds: input.selectedOptionIds,
      }

      try {
        const snapshot = await desktopClient.respondFollowup(response)
        setSessionSnapshot(snapshot)
        setLocalUiError(null)
      } catch (error) {
        setLocalUiError(formatError(error))
      }
    },
    [sessionSnapshotRef],
  )

  const hasCurrentWorkspace = sessionSnapshot?.activeWorkspacePath != null
  const activeWorkspace = getActiveWorkspace(sessionSnapshot)
  const activeConversation = getActiveConversation(sessionSnapshot)
  const followupRequest = sessionSnapshot?.visibleFollowup ?? null
  const canCompose =
    hasCurrentWorkspace &&
    (activeWorkspace?.configured ?? true) &&
    followupRequest == null &&
    !isSendingPrompt &&
    !(activeConversation?.isRunning ?? false)

  const conversationState = useMemo(
    () => ({
      activeWorkspaceLabel: sessionSnapshot?.activeWorkspaceLabel ?? 'Projects',
      activeWorkspaceConfigured: activeWorkspace?.configured ?? true,
      activeWorkspaceConfigurationError: activeWorkspace?.configurationError ?? null,
      hasCurrentWorkspace,
      isOpeningProject,
      messages: sessionSnapshot?.visibleMessages ?? [],
      uiError: localUiError ?? sessionSnapshot?.uiError ?? null,
    }),
    [
      activeWorkspace?.configurationError,
      activeWorkspace?.configured,
      hasCurrentWorkspace,
      isOpeningProject,
      localUiError,
      sessionSnapshot,
    ],
  )

  const sidebarState = useMemo(
    () => ({
      hasCurrentWorkspace,
      isOpeningProject,
      workspaces: sessionSnapshot?.workspaces ?? [],
    }),
    [hasCurrentWorkspace, isOpeningProject, sessionSnapshot?.workspaces],
  )

  const promptState = useMemo(
    () => ({
      canCompose,
      followupRequest,
      isSendingPrompt,
      promptDraft,
      setPromptDraft,
    }),
    [canCompose, followupRequest, isSendingPrompt, promptDraft, setPromptDraft],
  )

  const actionState = useMemo<SessionActionsContextValue>(
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
      submitFollowup,
      submitPrompt,
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
