import { ChatThread } from "@/components/chat/ChatThread";
import { ConversationPanelAlerts } from "@/components/conversation-panel/ConversationPanelAlerts";
import { ConversationPanelHeader } from "@/components/conversation-panel/ConversationPanelHeader";
import { LandingScreen } from "@/components/LandingScreen";
import { PromptComposer } from "@/components/PromptComposer";
import { PaneSurface } from "@/components/ui/pane-surface";
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
    followupRequest,
    hasCurrentWorkspace,
    messages,
    requestTimingsById,
    uiError,
    workspacePath,
  } = useConversationSession(binding);

  if (!hasCurrentWorkspace) {
    return <LandingScreen />;
  }

  const showNewChatScreen =
    messages.length === 0 &&
    activeRequestIds.length === 0 &&
    followupRequest == null;

  return (
    <PaneSurface className="flex-1 text-neutral-950 dark:text-neutral-100">
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

      {showNewChatScreen ? (
        <LandingScreen binding={binding} embedded />
      ) : (
        <>
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
        </>
      )}
    </PaneSurface>
  );
}
