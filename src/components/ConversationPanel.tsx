import { ChatThread } from "@/components/chat/ChatThread";
import { ConversationPanelAlerts } from "@/components/conversation-panel/ConversationPanelAlerts";
import { ConversationPanelHeader } from "@/components/conversation-panel/ConversationPanelHeader";
import { ConversationSurface } from "@/components/conversation-panel/ConversationSurface";
import { LandingScreen } from "@/components/landing-screen/LandingScreen";
import { PromptComposer } from "@/components/PromptComposer";
import { useConversationSession } from "@/hooks/useSession";
import type { ConversationPanelProps } from "./types/conversation";

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
    <ConversationSurface>
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
    </ConversationSurface>
  );
}
