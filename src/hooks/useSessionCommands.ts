import { useCallback, useMemo, type MutableRefObject } from 'react'

import * as desktopClient from '../services/desktop/client'
import type {
  FollowupResponse,
  PromptSettings,
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
  setPromptSettings: (settings: PromptSettings | null) => void
  refreshRuntimeStatus: () => Promise<RuntimeStatus | null>
  sessionSnapshotRef: MutableRefObject<SessionSnapshot | null>
  setIsOpeningProject: (value: boolean) => void
  setRuntimeStatus: (status: RuntimeStatus | null) => void
  setSessionSnapshot: (snapshot: SessionSnapshot) => void
}

export function useSessionCommands({
  promptDraftStore,
  setPromptSettings,
  refreshRuntimeStatus,
  sessionSnapshotRef,
  setIsOpeningProject,
  setRuntimeStatus,
  setSessionSnapshot,
}: UseSessionCommandsOptions): SessionActionsContextValue {
  const { clearPromptDraft, draftsRef, movePromptDraft, setPromptDraftPending } =
    promptDraftStore

  const runSnapshotCommand = useCallback(
    async (
      operation: () => Promise<SessionSnapshot>,
      options?: { refreshRuntimeStatus?: boolean },
    ) => {
      try {
        const snapshot = await operation()
        setSessionSnapshot(snapshot)

        if (options?.refreshRuntimeStatus) {
          await refreshRuntimeStatus()
        }

        return snapshot
      } catch {
        return null
      }
    },
    [refreshRuntimeStatus, setSessionSnapshot],
  )

  const runStatusCommand = useCallback(
    async (operation: () => Promise<RuntimeStatus>) => {
      try {
        const status = await operation()
        setRuntimeStatus(status)
        return status
      } catch {
        return null
      }
    },
    [setRuntimeStatus],
  )

  const openProject = useCallback(
    async (workspacePath: string) => {
      setIsOpeningProject(true)

      try {
        await runSnapshotCommand(
          () => desktopClient.openWorkspace(workspacePath),
          { refreshRuntimeStatus: true },
        )
      } finally {
        setIsOpeningProject(false)
      }
    },
    [runSnapshotCommand, setIsOpeningProject],
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
      await runSnapshotCommand(
        () => desktopClient.selectConversation(workspacePath, conversationId),
        { refreshRuntimeStatus: true },
      )
    },
    [runSnapshotCommand],
  )

  const startNewChat = useCallback(
    async (workspacePath?: string) => {
      const currentSnapshot = sessionSnapshotRef.current
      const targetWorkspacePath =
        workspacePath ?? currentSnapshot?.activeWorkspacePath ?? null

      if (targetWorkspacePath == null) {
        return null
      }

      const originWorkspaceDraftKey = getWorkspaceDraftKey(targetWorkspacePath)

      const snapshot = await runSnapshotCommand(
        () => desktopClient.startNewChat(targetWorkspacePath),
        { refreshRuntimeStatus: true },
      )
      if (snapshot == null) {
        return null
      }

      const nextDraftKey = getPromptDraftKey(
        snapshot.activeWorkspacePath,
        snapshot.activeConversationId,
      )
      movePromptDraft(originWorkspaceDraftKey, nextDraftKey)
      return snapshot
    },
    [movePromptDraft, runSnapshotCommand, sessionSnapshotRef],
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

    const snapshot = await runSnapshotCommand(() =>
      desktopClient.sendPrompt({
        workspacePath,
        conversationId: conversationId ?? null,
        prompt,
      }),
    )

    try {
      if (snapshot != null) {
        nextDraftKey = getPromptDraftKey(
          snapshot.activeWorkspacePath,
          snapshot.activeConversationId,
        )
        movePromptDraft(draftKey, nextDraftKey)
        clearPromptDraft(nextDraftKey)
      }
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
    runSnapshotCommand,
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
        text: input.text ?? null,
        selectedOptionIds: input.selectedOptionIds ?? null,
      }

      await runSnapshotCommand(() => desktopClient.respondFollowup(response))
    },
    [runSnapshotCommand, sessionSnapshotRef],
  )

  const checkoutBranch = useCallback(
    async (branchName: string) => {
      const workspacePath = sessionSnapshotRef.current?.activeWorkspacePath ?? null
      if (workspacePath == null) {
        return
      }

      await runStatusCommand(() =>
        desktopClient.checkoutGitBranch({ workspacePath, branchName }),
      )
    },
    [runStatusCommand, sessionSnapshotRef],
  )

  const createBranch = useCallback(
    async (branchName: string) => {
      const workspacePath = sessionSnapshotRef.current?.activeWorkspacePath ?? null
      if (workspacePath == null) {
        return
      }

      await runStatusCommand(() =>
        desktopClient.createGitBranch({ workspacePath, branchName }),
      )
    },
    [runStatusCommand, sessionSnapshotRef],
  )

  const commitChanges = useCallback(
    async (message: string) => {
      const workspacePath = sessionSnapshotRef.current?.activeWorkspacePath ?? null
      if (workspacePath == null) {
        return
      }

      await runStatusCommand(() =>
        desktopClient.commitGitChanges({ workspacePath, message }),
      )
    },
    [runStatusCommand, sessionSnapshotRef],
  )

  const pushBranch = useCallback(async () => {
    const workspacePath = sessionSnapshotRef.current?.activeWorkspacePath ?? null
    if (workspacePath == null) {
      return
    }

    await runStatusCommand(() => desktopClient.pushGitBranch(workspacePath))
  }, [runStatusCommand, sessionSnapshotRef])

  const openInTarget = useCallback(
    (targetId: string) => {
      const workspacePath = sessionSnapshotRef.current?.activeWorkspacePath ?? null
      if (workspacePath == null) {
        return Promise.resolve()
      }

      return desktopClient.openInTarget(workspacePath, targetId)
    },
    [sessionSnapshotRef],
  )

  const updatePromptSettings = useCallback(
    async (input: {
      providerId: string
      modelId: string
      reasoningEffort?: string | null
    }) => {
      try {
        const settings = await desktopClient.updatePromptSettings({
          workspacePath: sessionSnapshotRef.current?.activeWorkspacePath ?? null,
          providerId: input.providerId,
          modelId: input.modelId,
          reasoningEffort: input.reasoningEffort ?? null,
        })
        setPromptSettings(settings)
      } catch {
        return
      }
    },
    [sessionSnapshotRef, setPromptSettings],
  )

  return useMemo(
    () => ({
      checkoutBranch,
      commitChanges,
      createBranch,
      openInTarget,
      openWorkspacePicker,
      openProject,
      openSavedWorkspace: async () => {},
      pushBranch,
      selectConversation,
      startNewChat,
      submitPrompt,
      submitFollowup,
      updatePromptSettings,
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
      updatePromptSettings,
    ],
  )
}
