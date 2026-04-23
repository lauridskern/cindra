import {
  useConversationSession,
} from "../hooks/useSession";
import { usePrompt } from "../hooks/usePrompt";
import { FollowupComposer } from "./FollowupComposer";
import { PromptInputCard } from "./PromptInputCard";
import { SessionTodoDock } from "./conversation-panel/SessionTodoDock";
import type { PromptComposerProps } from "./types/prompt";

export function PromptComposer({ binding }: PromptComposerProps) {
  const {
    canCompose,
    followupRequest,
    isPlanningMode,
    isRequestActive,
    isSendingPrompt,
    promptSettings,
    promptDraft,
    setPlanningMode,
    setPromptDraft,
    stopPrompt,
    submitPrompt,
    updatePromptSettings,
  } = usePrompt(binding);
  const { todos } = useConversationSession(binding);

  return (
    <div className="px-6 pb-6">
      <SessionTodoDock
        isRequestActive={isRequestActive}
        todos={todos}
      />
      {followupRequest != null ? (
        <FollowupComposer
          key={followupRequest.followupId}
          followupRequest={followupRequest}
        />
      ) : (
        <PromptInputCard
          canCompose={canCompose}
          isRequestActive={isRequestActive}
          isSendingPrompt={isSendingPrompt}
          isPlanningMode={isPlanningMode}
          promptSettings={promptSettings}
          promptDraft={promptDraft}
          setPlanningMode={setPlanningMode}
          setPromptDraft={setPromptDraft}
          stopPrompt={stopPrompt}
          submitPrompt={submitPrompt}
          updatePromptSettings={updatePromptSettings}
        />
      )}
    </div>
  );
}
