import type { DockviewApi, DockviewGroupPanel } from "dockview-react";

import { ChatThread } from "@/components/chat/ChatThread";
import { ConversationPanelAlerts } from "@/components/conversation-panel/ConversationPanelAlerts";
import { ConversationPanelHeader } from "@/components/conversation-panel/ConversationPanelHeader";
import { LandingScreen } from "@/components/LandingScreen";
import { PromptComposer } from "@/components/PromptComposer";
import { useConversationSession } from "@/hooks/useSession";

interface PanelDragHandle {
  containerApi: DockviewApi;
  group: DockviewGroupPanel;
}

interface ConversationPanelProps {
  canCloseChat?: () => boolean;
  onCloseChat?: () => void;
  onOpenPreview?: () => void;
  onOpenTerminal?: () => void;
  panelDragHandle?: PanelDragHandle;
  panelDragEnabled?: boolean;
  reserveTitlebarInset?: boolean;
  windowDragEnabled?: boolean;
}

export function ConversationPanel({
  canCloseChat,
  onCloseChat,
  onOpenPreview,
  onOpenTerminal,
  panelDragHandle,
  panelDragEnabled = false,
  reserveTitlebarInset = false,
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
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-white/60 bg-white/80 shadow-xl shadow-neutral-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/20">
      <ConversationPanelHeader
        canCloseChat={canCloseChat}
        onCloseChat={onCloseChat}
        onOpenPreview={onOpenPreview}
        onOpenTerminal={onOpenTerminal}
        panelDragHandle={panelDragHandle}
        panelDragEnabled={panelDragEnabled}
        reserveTitlebarInset={reserveTitlebarInset}
        windowDragEnabled={windowDragEnabled}
      />

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
    </section>
  );
}
