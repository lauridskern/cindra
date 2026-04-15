import { ConversationPanel } from '../features/chat/components/ConversationPanel'
import { PromptComposer } from '../features/chat/components/PromptComposer'
import { FollowupDialog } from '../features/followups/components/FollowupDialog'
import { ProjectSidebar } from '../features/projects/components/ProjectSidebar'
import { handleWindowDragStart } from '../lib/window'
import { useSessionController } from '../state/session/useSessionController'

function App() {
  const {
    activeWorkspaceLabel,
    canCompose,
    expandedProjectPaths,
    followupRequest,
    followupText,
    hasCurrentWorkspace,
    isBusy,
    isOpeningProject,
    projectSummaries,
    promptInput,
    runtimeStatus,
    selectedOptionIds,
    setFollowupText,
    setPromptInput,
    startNewChat,
    selectConversation,
    openProject,
    openWorkspacePicker,
    submitFollowup,
    submitPrompt,
    toggleFollowupOption,
    uiError,
    visibleMessages,
  } = useSessionController()

  return (
    <main className="app-shell relative h-screen overflow-hidden bg-transparent">
      <div
        className="absolute inset-x-0 left-[84px] top-0 z-10 h-[42px] cursor-grab select-none active:cursor-grabbing"
        onMouseDown={handleWindowDragStart}
      />

      <section className="grid h-screen grid-cols-[15rem_minmax(0,1fr)] gap-2 overflow-hidden p-2 max-[860px]:grid-cols-1 max-[860px]:grid-rows-[minmax(240px,auto)_minmax(0,1fr)]">
        <ProjectSidebar
          expandedProjectPaths={expandedProjectPaths}
          hasCurrentWorkspace={hasCurrentWorkspace}
          isBusy={isBusy}
          isOpeningProject={isOpeningProject}
          projects={projectSummaries}
          onOpenWorkspacePicker={openWorkspacePicker}
          onOpenProject={openProject}
          onSelectConversation={selectConversation}
          onStartNewChat={startNewChat}
        />

        <ConversationPanel
          activeWorkspaceLabel={activeWorkspaceLabel}
          hasCurrentWorkspace={hasCurrentWorkspace}
          isOpeningProject={isOpeningProject}
          messages={visibleMessages}
          runtimeStatus={runtimeStatus}
          uiError={uiError}
          onOpenWorkspacePicker={openWorkspacePicker}
        >
          <PromptComposer
            canCompose={canCompose}
            isBusy={isBusy}
            promptInput={promptInput}
            onPromptInputChange={setPromptInput}
            onSubmit={submitPrompt}
          />
        </ConversationPanel>
      </section>

      <FollowupDialog
        followupRequest={followupRequest}
        followupText={followupText}
        selectedOptionIds={selectedOptionIds}
        onTextChange={setFollowupText}
        onToggleOption={toggleFollowupOption}
        onCancel={() => void submitFollowup(true)}
        onContinue={() => void submitFollowup(false)}
      />
    </main>
  )
}

export default App
