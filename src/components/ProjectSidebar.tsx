import { useState } from "react";
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
  SidebarMenu,
} from "./ui/sidebar";

export function ProjectSidebar() {
  const [expandedProjectPaths, setExpandedProjectPaths] = useState<string[]>([]);
  const [collapsedActiveWorkspacePath, setCollapsedActiveWorkspacePath] =
    useState<string | null>(null);
  const {
    openWorkspacePicker,
    openProject,
    selectConversation,
    startNewChat,
  } = useSessionActions();
  const {
    activeWorkspacePath,
    hasCurrentWorkspace,
    workspaces,
  } = useSidebarSession();

  function clearCollapsedActiveWorkspace(workspacePath?: string) {
    if (workspacePath == null) {
      return;
    }

    setCollapsedActiveWorkspacePath((current) =>
      current === workspacePath ? null : current,
    );
  }

  function isWorkspaceExpanded(workspacePath: string) {
    return (
      expandedProjectPaths.includes(workspacePath) ||
      (workspacePath === activeWorkspacePath &&
        collapsedActiveWorkspacePath !== workspacePath)
    );
  }

  function toggleProjectExpanded(workspacePath: string, isActive: boolean) {
    if (isActive) {
      if (isWorkspaceExpanded(workspacePath)) {
        setCollapsedActiveWorkspacePath(workspacePath);
        setExpandedProjectPaths((current) =>
          current.filter((path) => path !== workspacePath),
        );
        return;
      }

      setCollapsedActiveWorkspacePath(null);
      setExpandedProjectPaths((current) =>
        current.includes(workspacePath) ? current : [...current, workspacePath],
      );
      return;
    }

    setExpandedProjectPaths((current) =>
      current.includes(workspacePath)
        ? current.filter((path) => path !== workspacePath)
        : [...current, workspacePath],
    );
  }

  function handleOpenProject(workspacePath: string) {
    clearCollapsedActiveWorkspace(workspacePath);
    void openProject(workspacePath);
  }

  function handleSelectConversation(
    workspacePath: string,
    conversationId: string,
  ) {
    clearCollapsedActiveWorkspace(workspacePath);
    void selectConversation(workspacePath, conversationId);
  }

  function handleStartNewChat(workspacePath?: string) {
    clearCollapsedActiveWorkspace(workspacePath);
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
            {workspaces.length === 0 ? (
              <p className="px-2 py-1 text-xs font-medium text-sidebar-foreground/60">
                No projects yet
              </p>
            ) : (
              <SidebarMenu>
                {workspaces.map((project) => {
                  const isActive = project.workspacePath === activeWorkspacePath;
                  const isExpanded = isWorkspaceExpanded(project.workspacePath);

                  return (
                    <ProjectSidebarProject
                      key={project.workspacePath}
                      isExpanded={isExpanded}
                      isActive={isActive}
                      project={project}
                      onOpenProject={handleOpenProject}
                      onSelectConversation={handleSelectConversation}
                      onStartNewChat={handleStartNewChat}
                      onToggleProjectExpanded={(workspacePath) =>
                        toggleProjectExpanded(workspacePath, isActive)
                      }
                    />
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
