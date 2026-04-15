import { ProjectSidebar } from '../components/ProjectSidebar'
import { useProjectSidebarController } from '../../../state/session/useProjectSidebarController'

export function ProjectSidebarContainer() {
  const {
    expandedProjectPaths,
    hasCurrentWorkspace,
    isBusy,
    isOpeningProject,
    projectSummaries,
    openWorkspacePicker,
    openProject,
    selectConversation,
    startNewChat,
  } = useProjectSidebarController()

  return (
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
  )
}
