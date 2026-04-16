import { useState } from 'react'
import { FolderPlus } from 'lucide-react'

import { useSessionActions, useSidebarSession } from '../hooks/useSession'
import { ProjectSidebarActions } from './ProjectSidebarActions'
import { ProjectSidebarProject } from './ProjectSidebarProject'
import { Button } from './ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from './ui/sidebar'

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
    projectSummaries,
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
    <Sidebar
      collapsible="none"
      className="w-full border-r-0 bg-transparent pt-8"
    >
      <SidebarHeader className="pb-1">
        <ProjectSidebarActions
          hasCurrentWorkspace={hasCurrentWorkspace}
          isOpeningProject={isOpeningProject}
          onStartNewChat={() => handleStartNewChat()}
          onOpenWorkspacePicker={() => void handleOpenWorkspacePicker()}
        />
      </SidebarHeader>

      <SidebarContent className="select-none">
        <SidebarGroup className="pt-0">
          <div className="mb-1 flex h-7 items-center justify-between px-2">
            <SidebarGroupLabel className="h-full px-0 font-medium">
              Projects
            </SidebarGroupLabel>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-2 text-neutral-800 hover:text-white dark:text-neutral-500 dark:hover:text-white"
              aria-label="Open project"
              title="Open project"
              onClick={() => void handleOpenWorkspacePicker()}
            >
              <FolderPlus strokeWidth={2.5} className="size-3.5 shrink-0" />
            </Button>
          </div>

          <SidebarGroupContent>
            {projectSummaries.length === 0 ? (
              <p className="px-2 py-1 text-xs font-medium text-sidebar-foreground/60">
                No projects yet
              </p>
            ) : (
              <SidebarMenu>
                {projectSummaries.map((project) => {
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
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
