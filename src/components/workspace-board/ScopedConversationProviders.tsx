import { useEffect, useState, type ReactNode } from "react";

import {
  ConversationStateContext,
  PromptDraftContext,
  SessionActionsContext,
} from "@/app/SessionContext";
import { getPromptDraftKey } from "@/app/sessionSnapshot";
import { usePromptDraftStore } from "@/hooks/usePromptDraftStore";
import { usePromptSettings } from "@/hooks/usePromptSettings";
import { useRuntimeStatus } from "@/hooks/useRuntimeStatus";
import { useSessionActions, useWorkspaceBoard } from "@/hooks/useSession";
import * as desktopClient from "@/services/desktop/client";
import type { ChatBinding, RuntimeStatus } from "@/services/desktop/contracts";

const WORKSPACE_META_REFRESH_EVENT = "agent-ui://workspace-meta-refresh";

export function ScopedConversationProviders({
  binding,
  children,
}: {
  binding: ChatBinding;
  children: ReactNode;
}) {
  const rootActions = useSessionActions();
  const {
    applySessionSnapshot,
    getConversationSummary,
    getConversationView,
    getWorkspace,
    requestTimingsByConversationId,
    sessionSnapshot,
  } = useWorkspaceBoard();
  const currentView = getConversationView(binding);
  const conversationSummary = getConversationSummary(binding);
  const workspace = getWorkspace(binding.workspacePath);
  const promptDraftKey = getPromptDraftKey(
    binding.workspacePath,
    binding.conversationId,
  );
  const promptDraftStore = usePromptDraftStore(promptDraftKey);
  const workspaceRefreshCounter = useWorkspaceRefreshCounter(
    binding.workspacePath,
  );
  const { promptSettings, setPromptSettings } = usePromptSettings(
    binding.workspacePath,
    workspaceRefreshCounter,
  );
  const { runtimeStatus, setRuntimeStatus } = useRuntimeStatus(
    binding.workspacePath,
    workspaceRefreshCounter,
  );

  const activeWorkspaceConfigured =
    runtimeStatus?.configured ?? workspace?.configured ?? true;
  const activeWorkspaceConfigurationError =
    runtimeStatus?.configurationError ?? workspace?.configurationError ?? null;
  const followupRequest = currentView?.followup ?? null;
  const canCompose =
    activeWorkspaceConfigured &&
    followupRequest == null &&
    promptDraftStore.isSendingPrompt === false &&
    (conversationSummary?.isRunning ?? false) === false;

  async function runWorkspaceStatusCommand(
    operation: () => Promise<RuntimeStatus>,
  ) {
    const status = await operation();
    setRuntimeStatus(status);
    emitWorkspaceMetaRefresh(binding.workspacePath);
  }

  const scopedActions = {
    ...rootActions,
    checkoutBranch: async (branchName: string) => {
      await runWorkspaceStatusCommand(() =>
        desktopClient.checkoutGitBranch({
          workspacePath: binding.workspacePath,
          branchName,
        }),
      );
    },
    commitChanges: async (message: string) => {
      await runWorkspaceStatusCommand(() =>
        desktopClient.commitGitChanges({
          workspacePath: binding.workspacePath,
          message,
        }),
      );
    },
    createBranch: async (branchName: string) => {
      await runWorkspaceStatusCommand(() =>
        desktopClient.createGitBranch({
          workspacePath: binding.workspacePath,
          branchName,
        }),
      );
    },
    openInTarget: async (targetId: string) => {
      await desktopClient.openInTarget(binding.workspacePath, targetId);
    },
    pushBranch: async () => {
      await runWorkspaceStatusCommand(() =>
        desktopClient.pushGitBranch(binding.workspacePath),
      );
    },
    submitFollowup: async (input: {
      cancelled: boolean;
      text?: string;
      selectedOptionIds?: string[];
    }) => {
      if (followupRequest == null) {
        return;
      }

      const snapshot = await desktopClient.respondFollowup({
        followupId: followupRequest.followupId,
        cancelled: input.cancelled,
        text: input.text ?? null,
        selectedOptionIds: input.selectedOptionIds ?? null,
      });
      applySessionSnapshot(snapshot);
    },
    submitPrompt: async () => {
      if (promptDraftKey == null) {
        return;
      }

      const prompt = promptDraftStore.promptDraft.trim();
      if (prompt.length === 0) {
        return;
      }

      promptDraftStore.setPromptDraftPending(promptDraftKey, true);
      const snapshot = await desktopClient
        .sendPrompt({
          workspacePath: binding.workspacePath,
          conversationId: binding.conversationId,
          prompt,
        })
        .catch(() => null);
      promptDraftStore.setPromptDraftPending(promptDraftKey, false);

      if (snapshot != null) {
        applySessionSnapshot(snapshot);
        promptDraftStore.clearPromptDraft(promptDraftKey);
      }
    },
    updatePromptSettings: async (input: {
      providerId: string;
      modelId: string;
      reasoningEffort?: string | null;
    }) => {
      const settings = await desktopClient.updatePromptSettings({
        workspacePath: binding.workspacePath,
        providerId: input.providerId,
        modelId: input.modelId,
        reasoningEffort: input.reasoningEffort ?? null,
      });
      setPromptSettings(settings);
      emitWorkspaceMetaRefresh(binding.workspacePath);
    },
  };

  const conversationState = {
    activeRequestIds: currentView?.activeRequestIds ?? [],
    activeWorkspaceConfigurationError,
    activeWorkspaceConfigured,
    activeWorkspaceLabel: workspace?.workspaceName ?? "Projects",
    hasCurrentWorkspace: true,
    isOpeningProject: false,
    messages: currentView?.messages ?? [],
    requestTimingsById:
      requestTimingsByConversationId[binding.conversationId] ?? {},
    runtimeStatus,
    todos: currentView?.todos ?? [],
    uiError: sessionSnapshot?.uiError ?? null,
    workspacePath: binding.workspacePath,
  };

  const promptState = {
    canCompose,
    followupRequest,
    isSendingPrompt: promptDraftStore.isSendingPrompt,
    promptSettings,
    promptDraft: promptDraftStore.promptDraft,
    setPromptDraft: promptDraftStore.setPromptDraft,
  };

  return (
    <SessionActionsContext.Provider value={scopedActions}>
      <ConversationStateContext.Provider value={conversationState}>
        <PromptDraftContext.Provider value={promptState}>
          {children}
        </PromptDraftContext.Provider>
      </ConversationStateContext.Provider>
    </SessionActionsContext.Provider>
  );
}

function useWorkspaceRefreshCounter(workspacePath: string) {
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ workspacePath?: string }>).detail;
      if (detail?.workspacePath !== workspacePath) {
        return;
      }

      setCounter((current) => current + 1);
    };

    window.addEventListener(WORKSPACE_META_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(WORKSPACE_META_REFRESH_EVENT, handleRefresh);
    };
  }, [workspacePath]);

  return counter;
}

function emitWorkspaceMetaRefresh(workspacePath: string) {
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_META_REFRESH_EVENT, {
      detail: { workspacePath },
    }),
  );
}
