import { ConversationPanel } from '../components/ConversationPanel'
import { PromptComposerContainer } from './PromptComposerContainer'
import { useConversationPanelController } from '../../../state/session/useConversationPanelController'

export function ConversationPanelContainer() {
  const {
    activeWorkspaceLabel,
    hasCurrentWorkspace,
    isOpeningProject,
    messages,
    runtimeStatus,
    uiError,
    openWorkspacePicker,
  } = useConversationPanelController()

  return (
    <ConversationPanel
      activeWorkspaceLabel={activeWorkspaceLabel}
      hasCurrentWorkspace={hasCurrentWorkspace}
      isOpeningProject={isOpeningProject}
      messages={messages}
      runtimeStatus={runtimeStatus}
      uiError={uiError}
      onOpenWorkspacePicker={openWorkspacePicker}
    >
      <PromptComposerContainer />
    </ConversationPanel>
  )
}
