import { useCallback, useEffect } from "react";

import { useConversationActions } from "./useConversationActions";
import {
  getScopedConversationId,
  getScopedWorkspacePath,
  useConversationSession,
  usePromptDraft,
  useSessionStore,
} from "./useSession";
import { sessionStore } from "@/app/sessionStore";
import { getPromptDraftKey } from "@/app/sessionSnapshot";
import type { ChatBinding } from "@/services/desktop/types/contracts";

export function usePrompt(binding?: ChatBinding | null) {
  const { processQueuedPrompt, stopPrompt, submitPrompt, updatePromptSettings } =
    useConversationActions(binding);
  const { activeRequestIds } = useConversationSession(binding);
  const promptDraftState = usePromptDraft(binding);
  const promptDraftKey = useSessionStore((state) =>
    getPromptDraftKey(
      getScopedWorkspacePath(state, binding),
      getScopedConversationId(state, binding),
    ),
  );
  const isRequestActive = activeRequestIds.length > 0;
  const deleteQueuedPrompt = useCallback(
    (id: string) => {
      sessionStore.getState().deleteQueuedPrompt(promptDraftKey, id);
    },
    [promptDraftKey],
  );
  const editQueuedPrompt = useCallback(
    (id: string) => {
      sessionStore.getState().editQueuedPrompt(promptDraftKey, id);
    },
    [promptDraftKey],
  );
  const reorderQueuedPrompt = useCallback(
    (sourceId: string, targetId: string | null) => {
      sessionStore
        .getState()
        .reorderQueuedPrompt(promptDraftKey, sourceId, targetId);
    },
    [promptDraftKey],
  );

  useEffect(() => {
    if (isRequestActive || promptDraftState.isSendingPrompt) {
      return;
    }

    if (promptDraftState.queuedPromptCount === 0) {
      return;
    }

    void processQueuedPrompt();
  }, [
    isRequestActive,
    processQueuedPrompt,
    promptDraftState.isSendingPrompt,
    promptDraftState.queuedPromptCount,
  ]);

  return {
    ...promptDraftState,
    deleteQueuedPrompt,
    editQueuedPrompt,
    isRequestActive,
    reorderQueuedPrompt,
    stopPrompt,
    submitPrompt,
    updatePromptSettings,
  };
}
