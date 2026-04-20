import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  ConversationStateContext,
  PromptDraftContext,
  SessionActionsContext,
} from "@/app/SessionContext";
import { getPromptDraftKey } from "@/app/sessionSnapshot";
import { usePromptDraftStore } from "@/hooks/usePromptDraftStore";
import { useRuntimeStatus } from "@/hooks/useRuntimeStatus";
import { useSessionActions, useWorkspaceBoard } from "@/hooks/useSession";
import * as desktopClient from "@/services/desktop/client";
import type { ChatBinding, PromptSettings } from "@/services/desktop/contracts";

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
  const [promptSettings, setPromptSettings] = useState<PromptSettings | null>(
    null,
  );
  const { refreshRuntimeStatus, runtimeStatus, setRuntimeStatus } =
    useRuntimeStatus(binding.workspacePath);
  const workspaceRefreshCounter = useWorkspaceRefreshCounter(binding.workspacePath);

  useEffect(() => {
    void refreshRuntimeStatus();
  }, [refreshRuntimeStatus, workspaceRefreshCounter]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const settings = await desktopClient.getPromptSettings(binding.workspacePath);
        if (!cancelled) {
          setPromptSettings(settings);
        }
      } catch {
        if (!cancelled) {
          setPromptSettings(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [binding.workspacePath, workspaceRefreshCounter]);

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

  const scopedActions = useMemo(
    () => ({
      ...rootActions,
      checkoutBranch: async (branchName: string) => {
        const status = await desktopClient.checkoutGitBranch({
          workspacePath: binding.workspacePath,
          branchName,
        });
        setRuntimeStatus(status);
        emitWorkspaceMetaRefresh(binding.workspacePath);
      },
      commitChanges: async (message: string) => {
        const status = await desktopClient.commitGitChanges({
          workspacePath: binding.workspacePath,
          message,
        });
        setRuntimeStatus(status);
        emitWorkspaceMetaRefresh(binding.workspacePath);
      },
      createBranch: async (branchName: string) => {
        const status = await desktopClient.createGitBranch({
          workspacePath: binding.workspacePath,
          branchName,
        });
        setRuntimeStatus(status);
        emitWorkspaceMetaRefresh(binding.workspacePath);
      },
      openInTarget: async (targetId: string) => {
        await desktopClient.openInTarget(binding.workspacePath, targetId);
      },
      pushBranch: async () => {
        const status = await desktopClient.pushGitBranch(binding.workspacePath);
        setRuntimeStatus(status);
        emitWorkspaceMetaRefresh(binding.workspacePath);
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
        try {
          const snapshot = await desktopClient.sendPrompt({
            workspacePath: binding.workspacePath,
            conversationId: binding.conversationId,
            prompt,
          });
          applySessionSnapshot(snapshot);
          promptDraftStore.clearPromptDraft(promptDraftKey);
        } finally {
          promptDraftStore.setPromptDraftPending(promptDraftKey, false);
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
    }),
    [
      applySessionSnapshot,
      binding.conversationId,
      binding.workspacePath,
      followupRequest,
      promptDraftKey,
      promptDraftStore,
      rootActions,
      setRuntimeStatus,
    ],
  );

  const conversationState = useMemo(
    () => ({
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
    }),
    [
      activeWorkspaceConfigurationError,
      activeWorkspaceConfigured,
      binding.conversationId,
      binding.workspacePath,
      currentView?.activeRequestIds,
      currentView?.messages,
      currentView?.todos,
      requestTimingsByConversationId,
      runtimeStatus,
      sessionSnapshot?.uiError,
      workspace?.workspaceName,
    ],
  );

  const promptState = useMemo(
    () => ({
      canCompose,
      followupRequest,
      isSendingPrompt: promptDraftStore.isSendingPrompt,
      promptSettings,
      promptDraft: promptDraftStore.promptDraft,
      setPromptDraft: promptDraftStore.setPromptDraft,
    }),
    [
      canCompose,
      followupRequest,
      promptDraftStore.isSendingPrompt,
      promptDraftStore.promptDraft,
      promptDraftStore.setPromptDraft,
      promptSettings,
    ],
  );

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
