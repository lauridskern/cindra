import {
  useConversationSession,
  usePromptDraft,
  useSessionActions,
} from "../hooks/useSession";
import { FollowupComposer } from "./FollowupComposer";
import { PromptInputCard } from "./PromptInputCard";
import { SessionTodoDock } from "./conversation-panel/SessionTodoDock";

export function PromptComposer() {
  const { submitPrompt, updatePromptSettings } = useSessionActions();
  const { activeRequestIds, todos } = useConversationSession();
  const {
    canCompose,
    followupRequest,
    isSendingPrompt,
    promptSettings,
    promptDraft,
    setPromptDraft,
  } = usePromptDraft();

  return (
    <div className="px-6 pb-6">
      <SessionTodoDock
        isRequestActive={activeRequestIds.length > 0}
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
          isSendingPrompt={isSendingPrompt}
          promptSettings={promptSettings}
          promptDraft={promptDraft}
          setPromptDraft={setPromptDraft}
          submitPrompt={submitPrompt}
          updatePromptSettings={updatePromptSettings}
        />
      )}
    </div>
  );
}
