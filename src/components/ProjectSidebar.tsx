import { useEffect, useState } from "react";
import { FolderPlus, PanelsTopLeft } from "lucide-react";

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
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";

const EXPANDED_PROJECTS_STORAGE_KEY = "project-sidebar:expanded-projects";

function loadExpandedProjectPaths() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(
      EXPANDED_PROJECTS_STORAGE_KEY,
    );
    if (storedValue == null) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function ProjectSidebar() {
  const [expandedProjectPaths, setExpandedProjectPaths] = useState<string[]>(
    () => loadExpandedProjectPaths(),
  );
  const {
    openWorkspacePicker,
    openProject,
    openSavedWorkspace,
    selectConversation,
    startNewChat,
  } = useSessionActions();
  const {
    activeSavedWorkspaceId,
    activeWorkspacePath,
    hasCurrentWorkspace,
    savedWorkspaces,
    workspaces,
  } = useSidebarSession();

  useEffect(() => {
    window.localStorage.setItem(
      EXPANDED_PROJECTS_STORAGE_KEY,
      JSON.stringify(expandedProjectPaths),
    );
  }, [expandedProjectPaths]);

  function isWorkspaceExpanded(workspacePath: string) {
    return expandedProjectPaths.includes(workspacePath);
  }

  function toggleProjectExpanded(workspacePath: string) {
    setExpandedProjectPaths((current) =>
      current.includes(workspacePath)
        ? current.filter((path) => path !== workspacePath)
        : [...current, workspacePath],
    );
  }

  function handleOpenProject(workspacePath: string) {
    setExpandedProjectPaths((current) =>
      current.includes(workspacePath) ? current : [...current, workspacePath],
    );
    void openProject(workspacePath);
  }

  async function handleOpenWorkspacePicker() {
    const selectedPath = await openWorkspacePicker();
    if (selectedPath == null) {
      return;
    }

    setExpandedProjectPaths((current) =>
      current.includes(selectedPath) ? current : [...current, selectedPath],
    );
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
          onStartNewChat={() => handleStartNewChat()}
          onOpenWorkspacePicker={() => void handleOpenWorkspacePicker()}
        />
      </SidebarHeader>

      <SidebarContent className="select-none">
        <SidebarGroup className="pt-0">
          <div className="mb-1 flex h-7 items-center justify-between px-2">
            <SidebarGroupLabel className="h-full px-0 font-medium">
              Workspaces
            </SidebarGroupLabel>
          </div>

          <SidebarGroupContent>
            {savedWorkspaces.length === 0 ? (
              <p className="px-2 py-1 text-xs font-medium text-sidebar-foreground/60">
                No workspaces yet
              </p>
            ) : (
              <SidebarMenu>
                {savedWorkspaces.map((workspace) => (
                  <SidebarMenuItem key={workspace.id}>
                    <SidebarMenuButton
                      isActive={workspace.id === activeSavedWorkspaceId}
                      tooltip={workspace.name}
                      className="font-medium"
                      onClick={() => {
                        void openSavedWorkspace(workspace.id);
                      }}
                    >
                      <PanelsTopLeft strokeWidth={2} className="size-3.5" />
                      <span>{workspace.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

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
              onClick={() => void handleOpenWorkspacePicker()}
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
                      onToggleProjectExpanded={toggleProjectExpanded}
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
