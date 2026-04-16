import { useMemo, useState } from 'react'

import { useSessionActions, useSidebarSession } from '../hooks/useSession'
import { ProjectSidebarActions } from './ProjectSidebarActions'
import { ProjectSidebarProject } from './ProjectSidebarProject'

export function ProjectSidebar() {
  const [expandedProjectPaths, setExpandedProjectPaths] = useState<string[]>([])
  const {
    openWorkspacePicker,
    openProject,
    selectConversation,
    startNewChat,
  } = useSessionActions()
  const {
    activeWorkspacePath,
    hasCurrentWorkspace,
    isOpeningProject,
    workspaces,
  } = useSidebarSession()

  const visibleExpandedProjectPaths = useMemo(() => {
    if (activeWorkspacePath == null) {
      return expandedProjectPaths
    }

    return expandedProjectPaths.includes(activeWorkspacePath)
      ? expandedProjectPaths
      : [...expandedProjectPaths, activeWorkspacePath]
  }, [activeWorkspacePath, expandedProjectPaths])

  function toggleProjectExpanded(workspacePath: string) {
    setExpandedProjectPaths((current) =>
      current.includes(workspacePath)
        ? current.filter((path) => path !== workspacePath)
        : [...current, workspacePath],
    )
  }

  function handleOpenProject(workspacePath: string) {
    void openProject(workspacePath)
  }

  function handleSelectConversation(workspacePath: string, conversationId: string) {
    void selectConversation(workspacePath, conversationId)
  }

  function handleStartNewChat(workspacePath?: string) {
    void startNewChat(workspacePath)
  }

  return (
    <aside className="w-60 shrink-0 overflow-hidden bg-transparent max-md:min-h-60 max-md:w-full">
      <div className="flex h-full flex-col overflow-hidden px-1.5 pb-2.5 pt-1.5 select-none max-md:p-2.5">
        <ProjectSidebarActions
          hasCurrentWorkspace={hasCurrentWorkspace}
          isOpeningProject={isOpeningProject}
          onStartNewChat={() => handleStartNewChat()}
          onOpenWorkspacePicker={() => void openWorkspacePicker()}
        />

        <section className="grid min-h-0 flex-1 content-start gap-1">
          <div className="flex items-center gap-2.5 px-1.5 text-xs font-medium tracking-tight text-neutral-400 dark:text-neutral-500">
            <span>Projects</span>
          </div>

          <div className="grid gap-1.5">
            {workspaces.length === 0 ? (
              <p className="mt-0.5 px-2 text-xs text-neutral-400 dark:text-neutral-500">
                No projects yet
              </p>
            ) : (
              workspaces.map((project) => {
                const isExpanded = visibleExpandedProjectPaths.includes(
                  project.workspacePath,
                )

                return (
                  <ProjectSidebarProject
                    key={project.workspacePath}
                    isExpanded={isExpanded}
                    isActive={project.workspacePath === activeWorkspacePath}
                    project={project}
                    onOpenProject={handleOpenProject}
                    onSelectConversation={handleSelectConversation}
                    onStartNewChat={handleStartNewChat}
                    onToggleProjectExpanded={toggleProjectExpanded}
                  />
                )
              })
            )}
          </div>
        </section>
      </div>
    </aside>
  )
}
