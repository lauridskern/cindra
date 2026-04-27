import { useConversationSession } from "../hooks/useSession";
import { usePrompt } from "../hooks/usePrompt";
import { FollowupComposer } from "./FollowupComposer";
import { PromptActionAlert } from "./PromptActionAlert";
import { PromptInputCard } from "./PromptInputCard";
import { SessionTodoDock } from "./conversation-panel/SessionTodoDock";
import { useSettingsNavigation } from "@/app/settingsNavigationContext";
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
  const { openProviderSettings } = useSettingsNavigation();
  const requiresProviderSetup =
    promptSettings != null && promptSettings.availableModels.length === 0;

  return (
    <div className="px-6 pb-6">
      <SessionTodoDock isRequestActive={isRequestActive} todos={todos} />
      {followupRequest != null ? (
        <FollowupComposer
          key={followupRequest.followupId}
          followupRequest={followupRequest}
        />
      ) : (
        <>
          {requiresProviderSetup ? (
            <PromptActionAlert
              title="No provider is configured"
              description="Configure at least one provider to start chatting."
              actionLabel="Configure"
              onAction={openProviderSettings}
            />
          ) : null}
          <PromptInputCard
            canCompose={canCompose}
            isRequestActive={isRequestActive}
            isSendingPrompt={isSendingPrompt}
            isPlanningMode={isPlanningMode}
            promptSettings={promptSettings}
            promptDraft={promptDraft}
            isInputDisabled={requiresProviderSetup}
            setPlanningMode={setPlanningMode}
            setPromptDraft={setPromptDraft}
            stopPrompt={stopPrompt}
            submitPrompt={submitPrompt}
            updatePromptSettings={updatePromptSettings}
          />
        </>
      )}
    </div>
  );
}
