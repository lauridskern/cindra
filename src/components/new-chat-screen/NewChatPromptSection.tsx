import { useSettingsNavigation } from "@/app/settingsNavigationContext";
import { FollowupComposer } from "@/components/FollowupComposer";
import { PromptActionAlert } from "@/components/PromptActionAlert";
import { PromptInputCard } from "@/components/PromptInputCard";
import { usePrompt } from "@/hooks/usePrompt";
import { useConversationSession } from "@/hooks/useSession";
import type { ChatBinding } from "@/services/desktop/types/contracts";

export function NewChatPromptSection({
  binding,
}: {
  binding?: ChatBinding | null;
}) {
  const { hasCurrentWorkspace, workspaceKind } =
    useConversationSession(binding);
  const {
    canCompose,
    followupRequest,
    isPlanningMode,
    isRequestActive,
    isSendingPrompt,
    promptSettings,
    promptDraft,
    queuedPrompts,
    deleteQueuedPrompt,
    editQueuedPrompt,
    reorderQueuedPrompt,
    setPlanningMode,
    setPromptDraft,
    stopPrompt,
    submitPrompt,
    updatePromptSettings,
  } = usePrompt(binding);
  const { openProviderSettings } = useSettingsNavigation();
  const showProviderSetupPrompt =
    hasCurrentWorkspace &&
    promptSettings != null &&
    promptSettings.availableModels.length === 0;

  if (followupRequest != null) {
    return (
      <FollowupComposer
        key={followupRequest.followupId}
        followupRequest={followupRequest}
      />
    );
  }

  return (
    <>
      {showProviderSetupPrompt ? (
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
        placeholder={
          workspaceKind === "managed_chat"
            ? "Ask anything…"
            : hasCurrentWorkspace
              ? "Ask about this workspace…"
              : "Ask anything…"
        }
        isPlanningMode={isPlanningMode}
        promptDraft={promptDraft}
        promptSettings={promptSettings}
        queuedPrompts={queuedPrompts}
        isInputDisabled={showProviderSetupPrompt}
        deleteQueuedPrompt={deleteQueuedPrompt}
        editQueuedPrompt={editQueuedPrompt}
        reorderQueuedPrompt={reorderQueuedPrompt}
        setPlanningMode={setPlanningMode}
        setPromptDraft={setPromptDraft}
        stopPrompt={stopPrompt}
        submitPrompt={submitPrompt}
        updatePromptSettings={updatePromptSettings}
      />
    </>
  );
}
