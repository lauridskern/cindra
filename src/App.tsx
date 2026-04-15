import { Composer } from './app/components/Composer'
import { ConversationPanel } from './app/components/ConversationPanel'
import { FollowupDialog } from './app/components/FollowupDialog'
import { Sidebar } from './app/components/Sidebar'
import { useAppController } from './app/useAppController'
import { handleWindowDragStart } from './app/ui'

function App() {
  const {
    bootError,
    canCompose,
    expandedProjects,
    followup,
    followupText,
    handlePickWorkspace,
    handleProjectNewChat,
    handleResetChat,
    handleSelectConversation,
    handleSelectProject,
    handleSubmit,
    hasCurrentWorkspace,
    isBusy,
    isOpeningWorkspace,
    mainTitle,
    projectSummaries,
    prompt,
    runtimeStatus,
    selectedIds,
    setFollowupText,
    setPrompt,
    submitFollowup,
    toggleFollowupOption,
    visibleMessages,
  } = useAppController()

  return (
    <main className="relative h-screen overflow-hidden bg-transparent">
      <div
        className="absolute inset-x-0 left-[84px] top-0 z-10 h-[42px] cursor-grab select-none active:cursor-grabbing"
        onMouseDown={handleWindowDragStart}
      />

      <section className="grid h-screen grid-cols-[15rem_minmax(0,1fr)] gap-2 overflow-hidden p-2 max-[860px]:grid-cols-1 max-[860px]:grid-rows-[minmax(240px,auto)_minmax(0,1fr)]">
        <Sidebar
          expandedProjects={expandedProjects}
          hasCurrentWorkspace={hasCurrentWorkspace}
          isBusy={isBusy}
          isOpeningWorkspace={isOpeningWorkspace}
          projects={projectSummaries}
          onPickWorkspace={handlePickWorkspace}
          onProjectNewChat={handleProjectNewChat}
          onResetChat={handleResetChat}
          onSelectConversation={handleSelectConversation}
          onSelectProject={handleSelectProject}
        />

        <ConversationPanel
          bootError={bootError}
          hasCurrentWorkspace={hasCurrentWorkspace}
          isOpeningWorkspace={isOpeningWorkspace}
          mainTitle={mainTitle}
          messages={visibleMessages}
          runtimeStatus={runtimeStatus}
          onPickWorkspace={handlePickWorkspace}
        >
          <Composer
            prompt={prompt}
            canCompose={canCompose}
            isBusy={isBusy}
            onPromptChange={setPrompt}
            onSubmit={handleSubmit}
          />
        </ConversationPanel>
      </section>

      <FollowupDialog
        followup={followup}
        followupText={followupText}
        selectedIds={selectedIds}
        onTextChange={setFollowupText}
        onToggleOption={toggleFollowupOption}
        onCancel={() => void submitFollowup(true)}
        onContinue={() => void submitFollowup(false)}
      />
    </main>
  )
}

export default App
