import { ChatThread } from "@/components/chat/ChatThread";
import { ConversationPanelAlerts } from "@/components/conversation-panel/ConversationPanelAlerts";
import { ConversationPanelHeader } from "@/components/conversation-panel/ConversationPanelHeader";
import { LandingScreen } from "@/components/LandingScreen";
import { PromptComposer } from "@/components/PromptComposer";
import { PaneSurface } from "@/components/ui/pane-surface";
import { useConversationSession } from "@/hooks/useSession";

interface ConversationPanelProps {
  canCloseChat?: () => boolean;
  embedded?: boolean;
  onCloseChat?: () => void;
  onOpenPreview?: () => void;
  onOpenTerminal?: () => void;
  reserveTitlebarInset?: boolean;
  showHeader?: boolean;
  windowDragEnabled?: boolean;
}

export function ConversationPanel({
  canCloseChat,
  embedded = false,
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
    <PaneSurface className="flex-1" framed={!embedded}>
      {showHeader ? (
        <ConversationPanelHeader
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

      <PromptComposer />
    </PaneSurface>
  );
}
