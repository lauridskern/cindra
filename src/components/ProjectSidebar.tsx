import { useMemo, useState } from "react";
import { FolderPlus } from "lucide-react";

import { useSessionActions, useSidebarSession } from "../hooks/useSession";
import { handleWindowDragStart } from "../utils/window";
import { ProjectSidebarActions } from "./ProjectSidebarActions";
import { ProjectSidebarProject } from "./ProjectSidebarProject";
import { Button } from "./ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "./ui/sidebar";

export function ProjectSidebar() {
  const [expandedProjectPaths, setExpandedProjectPaths] = useState<string[]>([]);
  const {
    openWorkspacePicker,
    openProject,
    selectConversation,
    startNewChat,
  } = useSessionActions();
  const {
    activeWorkspacePath,
    hasCurrentWorkspace,
    isOpeningProject,
    workspaces,
  } = useSidebarSession();

  const visibleExpandedProjectPaths = useMemo(() => {
    if (activeWorkspacePath == null) {
      return expandedProjectPaths;
    }

    return expandedProjectPaths.includes(activeWorkspacePath)
      ? expandedProjectPaths
      : [...expandedProjectPaths, activeWorkspacePath];
  }, [activeWorkspacePath, expandedProjectPaths]);

  function toggleProjectExpanded(workspacePath: string) {
    setExpandedProjectPaths((current) =>
      current.includes(workspacePath)
        ? current.filter((path) => path !== workspacePath)
        : [...current, workspacePath],
    );
  }

  function handleOpenProject(workspacePath: string) {
    void openProject(workspacePath);
  }

  function handleSelectConversation(
    workspacePath: string,
    conversationId: string,
  ) {
    void selectConversation(workspacePath, conversationId);
  }

  function handleStartNewChat(workspacePath?: string) {
    void startNewChat(workspacePath);
  }

  return (
    <Sidebar collapsible="none" className="w-full border-r-0 bg-transparent">
      <SidebarHeader className="relative pb-1 pt-10">
        <div
          className="absolute inset-x-0 top-0 h-9 cursor-grab bg-transparent active:cursor-grabbing"
          onMouseDown={handleWindowDragStart}
        />
        <ProjectSidebarActions
          hasCurrentWorkspace={hasCurrentWorkspace}
          isOpeningProject={isOpeningProject}
          onStartNewChat={() => handleStartNewChat()}
          onOpenWorkspacePicker={() => void openWorkspacePicker()}
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
              className="-mr-2"
              aria-label="Open project"
              title="Open project"
              onClick={() => void openWorkspacePicker()}
            >
              <FolderPlus strokeWidth={2} className="size-3.5 shrink-0" />
            </Button>
          </div>

          <SidebarGroupContent>
            <div className="grid gap-1.5">
              {workspaces.length === 0 ? (
                <p className="mt-0.5 px-2 text-xs text-neutral-400 dark:text-neutral-500">
                  No projects yet
                </p>
              ) : (
                workspaces.map((project) => {
                  const isExpanded = visibleExpandedProjectPaths.includes(
                    project.workspacePath,
                  );

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
                  );
                })
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
