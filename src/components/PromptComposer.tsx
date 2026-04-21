import {
  useConversationSession,
  usePromptDraft,
} from "../hooks/useSession";
import { useConversationActions } from "../hooks/useConversationActions";
import type { ChatBinding } from "../services/desktop/contracts";
import { FollowupComposer } from "./FollowupComposer";
import { PromptInputCard } from "./PromptInputCard";
import { SessionTodoDock } from "./conversation-panel/SessionTodoDock";

interface PromptComposerProps {
  binding?: ChatBinding | null;
}

export function PromptComposer({ binding }: PromptComposerProps) {
  const { submitPrompt, updatePromptSettings } = useConversationActions(binding);
  const { activeRequestIds, todos } = useConversationSession(binding);
  const {
    canCompose,
    followupRequest,
    isSendingPrompt,
    promptSettings,
    promptDraft,
    setPromptDraft,
  } = usePromptDraft(binding);

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
