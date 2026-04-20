import { type MutableRefObject } from "react";

import * as desktopClient from "../services/desktop/client";
import type {
  FollowupResponse,
  PromptSettings,
  RuntimeStatus,
  SessionSnapshot,
} from "../services/desktop/contracts";
import {
  getPromptDraftKey,
  getWorkspaceDraftKey,
} from "../app/sessionSnapshot";
import type { SessionActionsContextValue } from "../app/SessionContext";
import type { PromptDraftStoreApi } from "./usePromptDraftStore";

interface UseSessionCommandsOptions {
  promptDraftStore: Pick<
    PromptDraftStoreApi,
    | "clearPromptDraft"
    | "draftsRef"
    | "movePromptDraft"
    | "setPromptDraftPending"
  >;
  setPromptSettings: (settings: PromptSettings | null) => void;
  refreshRuntimeStatus: () => Promise<RuntimeStatus | null>;
  sessionSnapshotRef: MutableRefObject<SessionSnapshot | null>;
  setIsOpeningProject: (value: boolean) => void;
  setRuntimeStatus: (status: RuntimeStatus | null) => void;
  setSessionSnapshot: (snapshot: SessionSnapshot) => void;
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
  const {
    clearPromptDraft,
    draftsRef,
    movePromptDraft,
    setPromptDraftPending,
  } = promptDraftStore;

  async function runSnapshotCommand(
    operation: () => Promise<SessionSnapshot>,
    options?: { refreshRuntimeStatus?: boolean },
  ) {
    try {
      const snapshot = await operation();
      setSessionSnapshot(snapshot);

      if (options?.refreshRuntimeStatus) {
        await refreshRuntimeStatus();
      }

      return snapshot;
    } catch {
      return null;
    }
  }

  async function runStatusCommand(operation: () => Promise<RuntimeStatus>) {
    try {
      const status = await operation();
      setRuntimeStatus(status);
      return status;
    } catch {
      return null;
    }
  }

  function getActiveWorkspacePath() {
    return sessionSnapshotRef.current?.activeWorkspacePath ?? null;
  }

  async function runActiveWorkspaceStatusCommand(
    operation: (workspacePath: string) => Promise<RuntimeStatus>,
  ) {
    const workspacePath = getActiveWorkspacePath();
    if (workspacePath == null) {
      return null;
    }

    return await runStatusCommand(() => operation(workspacePath));
  }

  async function openProject(workspacePath: string) {
    setIsOpeningProject(true);

    try {
      await runSnapshotCommand(
        () => desktopClient.openWorkspace(workspacePath),
        { refreshRuntimeStatus: true },
      );
    } finally {
      setIsOpeningProject(false);
    }
  }

  async function openWorkspacePicker() {
    try {
      const selectedPath = await desktopClient.pickWorkspace();
      if (selectedPath == null) {
        return null;
      }

      await openProject(selectedPath);
      return selectedPath;
    } catch {
      return null;
    }
  }

  async function selectConversation(
    workspacePath: string,
    conversationId: string,
  ) {
    await runSnapshotCommand(
      () => desktopClient.selectConversation(workspacePath, conversationId),
      { refreshRuntimeStatus: true },
    );
  }

  async function startNewChat(workspacePath?: string) {
    const targetWorkspacePath = workspacePath ?? getActiveWorkspacePath();

    if (targetWorkspacePath == null) {
      return null;
    }

    const originWorkspaceDraftKey = getWorkspaceDraftKey(targetWorkspacePath);

    const snapshot = await runSnapshotCommand(
      () => desktopClient.startNewChat(targetWorkspacePath),
      { refreshRuntimeStatus: true },
    );
    if (snapshot == null) {
      return null;
    }

    const nextDraftKey = getPromptDraftKey(
      snapshot.activeWorkspacePath,
      snapshot.activeConversationId,
    );
    movePromptDraft(originWorkspaceDraftKey, nextDraftKey);
    return snapshot;
  }

  async function submitPrompt() {
    const workspacePath = getActiveWorkspacePath();
    const conversationId =
      sessionSnapshotRef.current?.activeConversationId ?? undefined;
    const draftKey = getPromptDraftKey(workspacePath, conversationId ?? null);

    if (workspacePath == null || draftKey == null) {
      return;
    }

    const prompt = draftsRef.current[draftKey]?.value?.trim() ?? "";
    if (prompt.length === 0) {
      return;
    }

    let nextDraftKey: string | null = draftKey;
    setPromptDraftPending(draftKey, true);

    const snapshot = await runSnapshotCommand(() =>
      desktopClient.sendPrompt({
        workspacePath,
        conversationId: conversationId ?? null,
        prompt,
      }),
    );

    try {
      if (snapshot != null) {
        nextDraftKey = getPromptDraftKey(
          snapshot.activeWorkspacePath,
          snapshot.activeConversationId,
        );
        movePromptDraft(draftKey, nextDraftKey);
        clearPromptDraft(nextDraftKey);
      }
    } finally {
      setPromptDraftPending(draftKey, false);
      if (nextDraftKey !== draftKey) {
        setPromptDraftPending(nextDraftKey, false);
      }
    }
  }

  async function submitFollowup(input: {
    cancelled: boolean;
    text?: string;
    selectedOptionIds?: string[];
  }) {
    const followupRequest = sessionSnapshotRef.current?.visibleFollowup ?? null;
    if (followupRequest == null) {
      return;
    }

    const response: FollowupResponse = {
      followupId: followupRequest.followupId,
      cancelled: input.cancelled,
      text: input.text ?? null,
      selectedOptionIds: input.selectedOptionIds ?? null,
    };

    await runSnapshotCommand(() => desktopClient.respondFollowup(response));
  }

  async function checkoutBranch(branchName: string) {
    await runActiveWorkspaceStatusCommand((workspacePath) =>
      desktopClient.checkoutGitBranch({ workspacePath, branchName }),
    );
  }

  async function createBranch(branchName: string) {
    await runActiveWorkspaceStatusCommand((workspacePath) =>
      desktopClient.createGitBranch({ workspacePath, branchName }),
    );
  }

  async function commitChanges(message: string) {
    await runActiveWorkspaceStatusCommand((workspacePath) =>
      desktopClient.commitGitChanges({ workspacePath, message }),
    );
  }

  async function pushBranch() {
    await runActiveWorkspaceStatusCommand((workspacePath) =>
      desktopClient.pushGitBranch(workspacePath),
    );
  }

  function openInTarget(targetId: string) {
    const workspacePath = getActiveWorkspacePath();
    if (workspacePath == null) {
      return Promise.resolve();
    }

    return desktopClient.openInTarget(workspacePath, targetId);
  }

  async function updatePromptSettings(input: {
    providerId: string;
    modelId: string;
    reasoningEffort?: string | null;
  }) {
    try {
      const settings = await desktopClient.updatePromptSettings({
        workspacePath: sessionSnapshotRef.current?.activeWorkspacePath ?? null,
        providerId: input.providerId,
        modelId: input.modelId,
        reasoningEffort: input.reasoningEffort ?? null,
      });
      setPromptSettings(settings);
    } catch {
      return;
    }
  }

  return {
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
  };
}
