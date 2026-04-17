import { usePromptDraft, useSessionActions } from "../hooks/useSession";
import { FollowupComposer } from "./FollowupComposer";
import { PromptInputCard } from "./PromptInputCard";

export function PromptComposer() {
  const { submitPrompt } = useSessionActions();
  const {
    canCompose,
    followupRequest,
    isSendingPrompt,
    promptDraft,
    setPromptDraft,
  } = usePromptDraft();

  return (
    <div className="px-6 pb-6 pt-3.5">
      {followupRequest != null ? (
        <FollowupComposer
          key={followupRequest.followupId}
          followupRequest={followupRequest}
        />
      ) : (
        <PromptInputCard
          canCompose={canCompose}
          isSendingPrompt={isSendingPrompt}
          promptDraft={promptDraft}
          setPromptDraft={setPromptDraft}
          submitPrompt={submitPrompt}
        />
      )}
    </div>
  );
}
