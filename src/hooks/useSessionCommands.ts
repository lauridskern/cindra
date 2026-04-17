import { useCallback, useMemo, type MutableRefObject } from 'react'

import * as desktopClient from '../services/desktop/client'
import type {
  FollowupResponse,
  RuntimeStatus,
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
  setRuntimeStatus: (status: RuntimeStatus | null) => void
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
  setRuntimeStatus,
  setSessionSnapshot,
}: UseSessionCommandsOptions): SessionActionsContextValue {
  const { clearPromptDraft, draftsRef, movePromptDraft, setPromptDraftPending } =
    promptDraftStore

  const refreshRuntimeStatus = useCallback(async () => {
    try {
      const status = await desktopClient.getRuntimeStatus()
      setRuntimeStatus(status)
      return status
    } catch {
      setRuntimeStatus(null)
      return null
    }
  }, [setRuntimeStatus])

  const openProject = useCallback(
    async (workspacePath: string) => {
      setIsOpeningProject(true)

      try {
        const snapshot = await desktopClient.openWorkspace(workspacePath)
        applySnapshot(snapshot, setSessionSnapshot)
        await refreshRuntimeStatus()
      } catch {
        // The backend emits the error snapshot; the caller only needs the promise to settle.
      } finally {
        setIsOpeningProject(false)
      }
    },
    [refreshRuntimeStatus, setIsOpeningProject, setSessionSnapshot],
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
        await refreshRuntimeStatus()
      } catch {
        // The backend emits the error snapshot; the caller only needs the promise to settle.
      }
    },
    [refreshRuntimeStatus, setSessionSnapshot],
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
        await refreshRuntimeStatus()

        const nextDraftKey = getPromptDraftKey(
          snapshot.activeWorkspacePath,
          snapshot.activeConversationId,
        )
        movePromptDraft(originWorkspaceDraftKey, nextDraftKey)
      } catch {
        // The backend emits the error snapshot; the caller only needs the promise to settle.
      }
    },
    [movePromptDraft, refreshRuntimeStatus, sessionSnapshotRef, setSessionSnapshot],
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

  const checkoutBranch = useCallback(
    async (branchName: string) => {
      try {
        const status = await desktopClient.checkoutGitBranch({ branchName })
        setRuntimeStatus(status)
      } catch {
        // The backend emits the error snapshot; the caller only needs the promise to settle.
      }
    },
    [setRuntimeStatus],
  )

  const createBranch = useCallback(
    async (branchName: string) => {
      try {
        const status = await desktopClient.createGitBranch({ branchName })
        setRuntimeStatus(status)
      } catch {
        // The backend emits the error snapshot; the caller only needs the promise to settle.
      }
    },
    [setRuntimeStatus],
  )

  const commitChanges = useCallback(
    async (message: string) => {
      try {
        const status = await desktopClient.commitGitChanges({ message })
        setRuntimeStatus(status)
      } catch {
        // The backend emits the error snapshot; the caller only needs the promise to settle.
      }
    },
    [setRuntimeStatus],
  )

  const pushBranch = useCallback(async () => {
    try {
      const status = await desktopClient.pushGitBranch()
      setRuntimeStatus(status)
    } catch {
      // The backend emits the error snapshot; the caller only needs the promise to settle.
    }
  }, [setRuntimeStatus])

  const openInTarget = useCallback(async (targetId: string) => {
    try {
      await desktopClient.openInTarget(targetId)
    } catch {
      // The backend emits the error snapshot; the caller only needs the promise to settle.
    }
  }, [])

  return useMemo(
    () => ({
      checkoutBranch,
      commitChanges,
      createBranch,
      openInTarget,
      openWorkspacePicker,
      openProject,
      pushBranch,
      selectConversation,
      startNewChat,
      submitPrompt,
      submitFollowup,
    }),
    [
      checkoutBranch,
      commitChanges,
      createBranch,
      openInTarget,
      openWorkspacePicker,
      openProject,
      pushBranch,
      selectConversation,
      startNewChat,
      submitFollowup,
      submitPrompt,
    ],
  )
}
