import { useEffect } from "react";

import { useConversationActions } from "./useConversationActions";
import {
  useConversationSession,
  usePromptDraft,
} from "./useSession";
import type { ChatBinding } from "@/services/desktop/types/contracts";

export function usePrompt(binding?: ChatBinding | null) {
  const { processQueuedPrompt, stopPrompt, submitPrompt, updatePromptSettings } =
    useConversationActions(binding);
  const { activeRequestIds } = useConversationSession(binding);
  const promptDraftState = usePromptDraft(binding);
  const isRequestActive = activeRequestIds.length > 0;

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
    isRequestActive,
    stopPrompt,
    submitPrompt,
    updatePromptSettings,
  };
}
