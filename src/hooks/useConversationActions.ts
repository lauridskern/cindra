import { useMemo } from "react";

import {
  openWorkspaceInTarget,
  runWorkspaceRuntimeStatusAction,
  submitFollowupResponse,
  updateWorkspacePromptSettings,
} from "@/app/sessionClientActions";
import {
  getConversationView,
  getPromptDraftState,
  sessionStore,
} from "@/app/sessionStore";
import { getPromptDraftKey } from "@/app/sessionSnapshot";
import * as desktopClient from "@/services/desktop/client";
import type { ChatBinding } from "@/services/desktop/types/contracts";

import { useSessionActions } from "./useSession";

function isNextQueuedPrompt(
  promptDraftKey: string,
  queuedInput: { isPlanningMode: boolean; prompt: string },
) {
  const nextQueuedPrompt = sessionStore.getState().promptQueuesByKey[
    promptDraftKey
  ]?.[0];
  return (
    nextQueuedPrompt != null &&
    nextQueuedPrompt.isPlanningMode === queuedInput.isPlanningMode &&
    nextQueuedPrompt.value === queuedInput.prompt
  );
}

export function useConversationActions(binding?: ChatBinding | null) {
  const rootActions = useSessionActions();

  return useMemo(() => {
    if (binding == null) {
      return rootActions;
    }

    const { conversationId, workspacePath } = binding;

    const submitPromptFromDraft = async (
      queuedInput?: {
        fromQueue: true;
        isPlanningMode: boolean;
        prompt: string;
      },
    ) => {
      const promptDraftKey = getPromptDraftKey(workspacePath, conversationId);
      if (promptDraftKey == null) {
        return;
      }

      const draftState = getPromptDraftState(promptDraftKey);
      const prompt = (queuedInput?.prompt ?? draftState.value).trim();
      if (prompt.length === 0) {
        return;
      }

      const conversationView = getConversationView(binding);
      const isRunning = (conversationView?.activeRequestIds.length ?? 0) > 0;
      if (isRunning && queuedInput == null) {
        sessionStore.getState().enqueuePrompt(promptDraftKey, {
          isPlanningMode: draftState.isPlanningMode,
          value: prompt,
        });
        sessionStore.getState().clearPromptDraft(promptDraftKey);
        return;
      }

      if (
        isRunning ||
        (queuedInput != null && !isNextQueuedPrompt(promptDraftKey, queuedInput))
      ) {
        return;
      }

      sessionStore.getState().setPromptDraftPending(promptDraftKey, true);
      try {
        const snapshot = await desktopClient.sendPrompt({
          agentId: (queuedInput?.isPlanningMode ?? draftState.isPlanningMode)
            ? "muse"
            : "forge",
          conversationId,
          prompt,
          workspacePath,
        });
        sessionStore.getState().applySessionSnapshot(snapshot);
        if (queuedInput == null) {
          sessionStore.getState().clearPromptDraft(promptDraftKey);
        } else {
          sessionStore.getState().shiftQueuedPrompt(promptDraftKey);
        }
      } catch {
        if (queuedInput != null) {
          sessionStore.getState().shiftQueuedPrompt(promptDraftKey);
        }
        return;
      } finally {
        sessionStore.getState().setPromptDraftPending(promptDraftKey, false);
      }
    };

    return {
      ...rootActions,
      checkoutBranch: async (branchName: string) => {
        await runWorkspaceRuntimeStatusAction(workspacePath, () =>
          desktopClient.checkoutGitBranch({
            branchName,
            workspacePath,
          }),
        );
      },
      commitChanges: async (message: string) => {
        await runWorkspaceRuntimeStatusAction(workspacePath, () =>
          desktopClient.commitGitChanges({
            message,
            workspacePath,
          }),
        );
      },
      createBranch: async (branchName: string) => {
        await runWorkspaceRuntimeStatusAction(workspacePath, () =>
          desktopClient.createGitBranch({
            branchName,
            workspacePath,
          }),
        );
      },
      openInTarget: async (targetId: string) => {
        await openWorkspaceInTarget(workspacePath, targetId);
      },
      pushBranch: async () => {
        await runWorkspaceRuntimeStatusAction(workspacePath, () =>
          desktopClient.pushGitBranch(workspacePath),
        );
      },
      submitFollowup: async (input: {
        cancelled: boolean;
        text?: string;
        selectedOptionIds?: string[];
      }) => {
        const followupRequest = getConversationView(binding)?.followup ?? null;
        if (followupRequest == null) {
          return;
        }

        await submitFollowupResponse({
          cancelled: input.cancelled,
          followupId: followupRequest.followupId,
          selectedOptionIds: input.selectedOptionIds,
          text: input.text,
        });
      },
      stopPrompt: async () => {
        await desktopClient
          .stopPrompt({
            conversationId,
            workspacePath,
          })
          .catch(() => null);
      },
      submitPrompt: async () => {
        await submitPromptFromDraft();
      },
      processQueuedPrompt: async () => {
        const promptDraftKey = getPromptDraftKey(workspacePath, conversationId);
        if (promptDraftKey == null) {
          return;
        }

        const queuedPrompt = sessionStore.getState().promptQueuesByKey[
          promptDraftKey
        ]?.[0];
        if (queuedPrompt == null) {
          return;
        }

        await submitPromptFromDraft({
          fromQueue: true,
          isPlanningMode: queuedPrompt.isPlanningMode,
          prompt: queuedPrompt.value,
        });
      },
      updatePromptSettings: async (input: {
        providerId: string;
        modelId: string;
        reasoningEffort?: string | null;
      }) => {
        await updateWorkspacePromptSettings(workspacePath, input);
      },
    };
  }, [binding, rootActions]);
}
