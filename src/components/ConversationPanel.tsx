import { ChatThread } from "@/components/chat/ChatThread";
import { ConversationPanelAlerts } from "@/components/conversation-panel/ConversationPanelAlerts";
import { ConversationPanelHeader } from "@/components/conversation-panel/ConversationPanelHeader";
import { LandingScreen } from "@/components/LandingScreen";
import { PromptComposer } from "@/components/PromptComposer";
import { useConversationSession } from "@/hooks/useSession";
import type { ChatBinding } from "@/services/desktop/contracts";

interface ConversationPanelProps {
  binding?: ChatBinding | null;
  canCloseChat?: () => boolean;
  onCloseChat?: () => void;
  onOpenPreview?: () => void;
  onOpenTerminal?: () => void;
  reserveTitlebarInset?: boolean;
  showHeader?: boolean;
  windowDragEnabled?: boolean;
}

export function ConversationPanel({
  binding,
  canCloseChat,
  onCloseChat,
  onOpenPreview,
  onOpenTerminal,
  reserveTitlebarInset = false,
  showHeader = true,
  windowDragEnabled = true,
}: ConversationPanelProps) {
  const {
    activeRequestIds,
    activeWorkspaceLabel,
    activeWorkspaceConfigured,
    activeWorkspaceConfigurationError,
    hasCurrentWorkspace,
    isOpeningProject,
    messages,
    requestTimingsById,
    runtimeStatus,
    uiError,
    workspacePath,
  } = useConversationSession(binding);

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
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white/80 shadow-xl shadow-neutral-950/5 backdrop-blur-xl dark:bg-neutral-900/80 dark:shadow-black/20">
      {showHeader ? (
        <ConversationPanelHeader
          binding={binding}
          canCloseChat={canCloseChat}
          onCloseChat={onCloseChat}
          onOpenPreview={onOpenPreview}
          onOpenTerminal={onOpenTerminal}
          reserveTitlebarInset={reserveTitlebarInset}
          windowDragEnabled={windowDragEnabled}
        />
      ) : null}

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
          workspaceLabel={activeWorkspaceLabel}
          workspacePath={workspacePath}
        />
      </section>

      <PromptComposer binding={binding} />
    </section>
  );
}
