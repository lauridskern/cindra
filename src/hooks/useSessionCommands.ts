import { useCallback, useMemo, type MutableRefObject } from 'react'

import * as desktopClient from '../services/desktop/client'
import type {
  FollowupResponse,
  SessionSnapshot,
} from '../services/desktop/contracts'
import { getPromptDraftKey, getWorkspaceDraftKey } from '../app/sessionSnapshot'
import type { SessionActionsContextValue } from '../app/SessionContext'
import type { PromptDraftStoreApi } from './usePromptDraftStore'

interface UseSessionCommandsOptions {
  promptDraftStore: Pick<
    PromptDraftStoreApi,
    'clearPromptDraft' | 'draftsRef' | 'movePromptDraft' | 'setPromptDraftPending'
  >
  sessionSnapshotRef: MutableRefObject<SessionSnapshot | null>
  setIsOpeningProject: (value: boolean) => void
  setSessionSnapshot: (snapshot: SessionSnapshot) => void
}

function applySnapshot(
  snapshot: SessionSnapshot,
  setSessionSnapshot: (snapshot: SessionSnapshot) => void,
) {
  setSessionSnapshot(snapshot)
}

export function useSessionCommands({
  promptDraftStore,
  sessionSnapshotRef,
  setIsOpeningProject,
  setSessionSnapshot,
}: UseSessionCommandsOptions): SessionActionsContextValue {
  const { clearPromptDraft, draftsRef, movePromptDraft, setPromptDraftPending } =
    promptDraftStore

  const openProject = useCallback(
    async (workspacePath: string) => {
      setIsOpeningProject(true)

      try {
        const snapshot = await desktopClient.openWorkspace(workspacePath)
        applySnapshot(snapshot, setSessionSnapshot)
      } catch {
        // The backend emits the error snapshot; the caller only needs the promise to settle.
      } finally {
        setIsOpeningProject(false)
      }
    },
    [setIsOpeningProject, setSessionSnapshot],
  )

  const openWorkspacePicker = useCallback(async () => {
    try {
      const selectedPath = await desktopClient.pickWorkspace()
      if (selectedPath == null) {
        return null
      }

      await openProject(selectedPath)
      return selectedPath
    } catch {
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
        applySnapshot(snapshot, setSessionSnapshot)
      } catch {
        // The backend emits the error snapshot; the caller only needs the promise to settle.
      }
    },
    [setSessionSnapshot],
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
        applySnapshot(snapshot, setSessionSnapshot)

        const nextDraftKey = getPromptDraftKey(
          snapshot.activeWorkspacePath,
          snapshot.activeConversationId,
        )
        movePromptDraft(originWorkspaceDraftKey, nextDraftKey)
      } catch {
        // The backend emits the error snapshot; the caller only needs the promise to settle.
      }
    },
    [movePromptDraft, sessionSnapshotRef, setSessionSnapshot],
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
        conversationId: conversationId ?? null,
        prompt,
      })
      applySnapshot(snapshot, setSessionSnapshot)

      nextDraftKey = getPromptDraftKey(
        snapshot.activeWorkspacePath,
        snapshot.activeConversationId,
      )
      movePromptDraft(draftKey, nextDraftKey)
      clearPromptDraft(nextDraftKey)
    } catch {
      // The backend emits the error snapshot; the caller only needs the promise to settle.
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
    setSessionSnapshot,
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
        text: input.text ?? null,
        selectedOptionIds: input.selectedOptionIds ?? null,
      }

      try {
        const snapshot = await desktopClient.respondFollowup(response)
        applySnapshot(snapshot, setSessionSnapshot)
      } catch {
        // The backend emits the error snapshot; the caller only needs the promise to settle.
      }
    },
    [sessionSnapshotRef, setSessionSnapshot],
  )

  return useMemo(
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
}
