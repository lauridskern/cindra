import { useState } from 'react'

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
    hasCurrentWorkspace,
    isOpeningProject,
    workspaces,
  } = useSidebarSession()

  function toggleProjectExpanded(workspacePath: string) {
    setExpandedProjectPaths((current) =>
      current.includes(workspacePath)
        ? current.filter((path) => path !== workspacePath)
        : [...current, workspacePath],
    )
  }

  function ensureProjectExpanded(workspacePath: string) {
    setExpandedProjectPaths((current) =>
      current.includes(workspacePath) ? current : [...current, workspacePath],
    )
  }

  async function handleOpenWorkspacePicker() {
    const workspacePath = await openWorkspacePicker()
    if (workspacePath != null) {
      ensureProjectExpanded(workspacePath)
    }
  }

  function handleOpenProject(workspacePath: string) {
    ensureProjectExpanded(workspacePath)
    void openProject(workspacePath)
  }

  function handleSelectConversation(workspacePath: string, conversationId: string) {
    ensureProjectExpanded(workspacePath)
    void selectConversation(workspacePath, conversationId)
  }

  function handleStartNewChat(workspacePath?: string) {
    if (workspacePath != null) {
      ensureProjectExpanded(workspacePath)
    }

    void startNewChat(workspacePath)
  }

  return (
    <aside className="w-60 shrink-0 overflow-hidden bg-transparent max-md:min-h-60 max-md:w-full">
      <div className="flex h-full flex-col overflow-hidden px-1.5 pb-2.5 pt-1.5 select-none max-md:p-2.5">
        <ProjectSidebarActions
          hasCurrentWorkspace={hasCurrentWorkspace}
          isOpeningProject={isOpeningProject}
          onStartNewChat={() => handleStartNewChat()}
          onOpenWorkspacePicker={() => void handleOpenWorkspacePicker()}
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
                const isExpanded = expandedProjectPaths.includes(project.workspacePath)

                return (
                  <ProjectSidebarProject
                    key={project.workspacePath}
                    isExpanded={isExpanded}
                    project={project}
                    onEnsureProjectExpanded={ensureProjectExpanded}
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
