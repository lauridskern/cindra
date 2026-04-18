import { ChatThread } from "@/components/chat/ChatThread";
import { ConversationPanelAlerts } from "@/components/conversation-panel/ConversationPanelAlerts";
import { ConversationPanelHeader } from "@/components/conversation-panel/ConversationPanelHeader";
import { LandingScreen } from "@/components/LandingScreen";
import { PromptComposer } from "@/components/PromptComposer";
import { useConversationSession } from "@/hooks/useSession";

interface ConversationPanelProps {
  reserveTitlebarInset?: boolean;
}

export function ConversationPanel({
  reserveTitlebarInset = false,
}: ConversationPanelProps) {
  const {
    activeRequestIds,
    activeWorkspaceConfigured,
    activeWorkspaceConfigurationError,
    hasCurrentWorkspace,
    isOpeningProject,
    messages,
    requestTimingsById,
    runtimeStatus,
    uiError,
    workspacePath,
  } = useConversationSession();

  if (!hasCurrentWorkspace) {
    return (
      <LandingScreen
        isOpeningProject={isOpeningProject}
        runtimeStatus={runtimeStatus}
        uiError={uiError}
      />
    );
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-white/60 bg-white/80 shadow-xl shadow-neutral-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/20">
      <ConversationPanelHeader reserveTitlebarInset={reserveTitlebarInset} />

      <ConversationPanelAlerts
        activeWorkspaceConfigurationError={activeWorkspaceConfigurationError}
        activeWorkspaceConfigured={activeWorkspaceConfigured}
        uiError={uiError}
      />

      <section className="min-h-0 flex-1 overflow-hidden select-text px-6">
        <ChatThread
          messages={messages}
          activeRequestIds={activeRequestIds}
          requestTimingsById={requestTimingsById}
          workspacePath={workspacePath}
        />
      </section>

      <PromptComposer />
    </section>
  );
}
