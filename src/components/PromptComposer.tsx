import { usePromptDraft, useSessionActions } from "../hooks/useSession";
import { FollowupComposer } from "./FollowupComposer";
import { PromptInputCard } from "./PromptInputCard";

export function PromptComposer() {
  const { submitPrompt, updatePromptSettings } = useSessionActions();
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
