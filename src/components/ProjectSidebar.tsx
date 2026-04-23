import {
  FlaskConical,
  FolderPlus,
  PanelsTopLeft,
  PenSquare,
  Plug2Icon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react";

import { useExpandedProjectPaths } from "../hooks/useExpandedProjectPaths";
import {
  useSessionActions,
  useSessionStore,
  useSidebarSession,
} from "../hooks/useSession";
import { formatRelativeTimestamp } from "../utils/time";
import { handleWindowDragStart } from "../utils/window";
import { ProjectSidebarActions } from "./ProjectSidebarActions";
import { SidebarArchiveAction } from "./SidebarArchiveAction";
import { SidebarItemActionsMenu } from "./SidebarItemActionsMenu";
import { SidebarSettingsControl } from "./SidebarSettingsControl";
import { ProjectSidebarProject } from "./ProjectSidebarProject";
import type { ProjectSidebarProps } from "./types/sidebar";
import { Button } from "./ui/Button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenuBadge,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/Sidebar";

export function ProjectSidebar({
  isSettingsViewOpen,
  selectedSettingsSection,
  onOpenSettings,
  onSelectSettingsSection,
}: ProjectSidebarProps) {
  const isDevBuild = import.meta.env.DEV;
  const {
    collapseProject,
    ensureProjectExpanded,
    isProjectExpanded,
    toggleProjectExpanded,
  } = useExpandedProjectPaths();
  const {
    archiveConversation,
    archiveWorkspace,
    deleteSavedWorkspace,
    openWorkspacePicker,
    openProject,
    openSavedWorkspace,
    renameSavedWorkspace,
    renameWorkspace,
    selectConversation,
    startNewChat,
  } = useSessionActions();
  const {
    activeConversationId,
    activeSavedWorkspaceId,
    activeWorkspacePath,
    isDemoChatSelected,
    savedWorkspaces,
    workspaces,
  } = useSidebarSession();
  const setBoardSelection = useSessionStore((state) => state.setBoardSelection);
  const projectWorkspaces = workspaces.filter(
    (workspace) => workspace.kind === "project",
  );
  const managedChats = workspaces.filter(
    (workspace) => workspace.kind === "managed_chat",
  );
  const visibleManagedChats = managedChats.filter(
    (workspace) => workspace.conversations.length > 0,
  );

  async function handleOpenWorkspacePicker() {
    const selectedPath = await openWorkspacePicker();
    if (selectedPath == null) {
      return;
    }

    ensureProjectExpanded(selectedPath);
  }

  function handleSelectConversation(
    workspacePath: string,
    conversationId: string,
  ) {
    void selectConversation(workspacePath, conversationId);
  }

  function handleArchiveConversation(
    workspacePath: string,
    conversationId: string,
  ) {
    void archiveConversation(workspacePath, conversationId);
  }

  function handleArchiveWorkspace(workspacePath: string) {
    collapseProject(workspacePath);
    void archiveWorkspace(workspacePath);
  }

  async function handleRenameProject(
    workspacePath: string,
    displayName?: string | null,
  ) {
    await renameWorkspace(workspacePath, displayName ?? null);
  }

  function handleDeleteSavedWorkspace(workspaceId: string) {
    void deleteSavedWorkspace(workspaceId);
  }

  async function handleRenameSavedWorkspace(workspaceId: string, name: string) {
    await renameSavedWorkspace(workspaceId, name);
  }

  function handleStartNewChat(workspacePath?: string) {
    void startNewChat(workspacePath);
  }

  function handleSelectDemoChat() {
    setBoardSelection({ kind: "demo-chat" });
  }

  if (isSettingsViewOpen) {
    return (
      <Sidebar
        collapsible="none"
        className="relative w-full border-r-0 bg-transparent"
      >
        <SidebarHeader className="relative pb-1 pt-10">
          <div
            className="absolute inset-x-0 top-0 h-9 cursor-grab bg-transparent active:cursor-grabbing"
            role="presentation"
            onMouseDown={handleWindowDragStart}
          />
        </SidebarHeader>

        <SidebarContent className="select-none">
          <SidebarGroup className="pt-0">
            <div className="mb-1 flex h-7 items-center justify-between px-2">
              <SidebarGroupLabel className="h-full px-0 font-medium">
                Settings
              </SidebarGroupLabel>
            </div>

            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={selectedSettingsSection === "general"}
                    tooltip="General"
                    className="font-medium [&_svg]:size-3.5"
                    onClick={() => {
                      onSelectSettingsSection("general");
                    }}
                  >
                    <Settings2Icon
                      strokeWidth={2}
                      className="size-3.5 shrink-0"
                    />
                    <span>General</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={selectedSettingsSection === "providers"}
                    tooltip="Providers"
                    className="font-medium [&_svg]:size-3.5"
                    onClick={() => {
                      onSelectSettingsSection("providers");
                    }}
                  >
                    <Plug2Icon strokeWidth={2} className="size-3.5 shrink-0" />
                    <span>Providers</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar
      collapsible="none"
      className="relative w-full border-r-0 bg-transparent"
    >
      <SidebarHeader className="relative pb-1 pt-10">
        <div
          className="absolute inset-x-0 top-0 h-9 cursor-grab bg-transparent active:cursor-grabbing"
          role="presentation"
          onMouseDown={handleWindowDragStart}
        />
        <ProjectSidebarActions
          onStartNewChat={() => handleStartNewChat()}
          onOpenWorkspacePicker={() => void handleOpenWorkspacePicker()}
        />
      </SidebarHeader>

      <SidebarContent className="select-none pb-24">
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
                      className="pr-8 font-medium"
                      onClick={() => {
                        void openSavedWorkspace(workspace.id);
                      }}
                    >
                      <PanelsTopLeft strokeWidth={2} className="size-3.5" />
                      <span>{workspace.name}</span>
                    </SidebarMenuButton>
                    <SidebarItemActionsMenu
                      className="right-0"
                      currentName={workspace.name}
                      dialogDescription="Update the saved workspace name shown in the sidebar."
                      dialogTitle="Rename workspace"
                      menuAriaLabel={`More actions for ${workspace.name}`}
                      onRemove={() => handleDeleteSavedWorkspace(workspace.id)}
                      onRename={(name) =>
                        handleRenameSavedWorkspace(
                          workspace.id,
                          name ?? workspace.name,
                        )
                      }
                      removeIcon={Trash2Icon}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pt-0">
          <div className="mb-1 flex h-7 items-center justify-between px-2">
            <SidebarGroupLabel className="h-full px-0 font-medium">
              Chats
            </SidebarGroupLabel>
          </div>

          <SidebarGroupContent>
            {visibleManagedChats.length === 0 ? (
              <p className="px-2 py-1 text-xs font-medium text-sidebar-foreground/60">
                No chats yet
              </p>
            ) : (
              <SidebarMenu>
                {visibleManagedChats.map((chatWorkspace) => {
                  const isChatOpen =
                    !isDemoChatSelected &&
                    chatWorkspace.workspacePath === activeWorkspacePath;
                  const activeChatId =
                    chatWorkspace.selectedConversationId ??
                    chatWorkspace.conversations[0]?.conversationId ??
                    null;
                  const isActive =
                    isChatOpen && activeConversationId === activeChatId;
                  const chatTitle =
                    chatWorkspace.conversations[0]?.title ?? "New chat";
                  const updatedAt = formatRelativeTimestamp(
                    chatWorkspace.conversations[0]?.updatedAt ?? null,
                  );

                  return (
                    <SidebarMenuItem key={chatWorkspace.workspacePath}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={chatTitle}
                        className="font-medium"
                        onClick={() => {
                          if (activeChatId != null) {
                            void selectConversation(
                              chatWorkspace.workspacePath,
                              activeChatId,
                            );
                            return;
                          }

                          void openProject(chatWorkspace.workspacePath);
                        }}
                      >
                        <PenSquare
                          strokeWidth={2}
                          className="size-3.5 shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate pr-2">
                          {chatTitle}
                        </span>
                        {updatedAt ? (
                          <span className="flex shrink-0 items-center gap-1.5 text-right text-xs font-medium text-sidebar-foreground/60 transition-opacity group-hover/menu-item:opacity-0 group-focus-within/menu-item:opacity-0">
                            {updatedAt}
                          </span>
                        ) : null}
                      </SidebarMenuButton>
                      <SidebarArchiveAction
                        ariaLabel={`Archive ${chatTitle}`}
                        className="right-0.5 group-hover/menu-item:opacity-100"
                        onClick={() =>
                          handleArchiveWorkspace(chatWorkspace.workspacePath)
                        }
                      />
                    </SidebarMenuItem>
                  );
                })}
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
            {projectWorkspaces.length === 0 ? (
              <p className="px-2 py-1 text-xs font-medium text-sidebar-foreground/60">
                No projects yet
              </p>
            ) : (
              <SidebarMenu>
                {projectWorkspaces.map((project) => {
                  const isProjectOpen =
                    !isDemoChatSelected &&
                    project.workspacePath === activeWorkspacePath;
                  const isActive =
                    isProjectOpen && activeConversationId == null;
                  const isExpanded = isProjectExpanded(project.workspacePath);
                  const selectedConversationId = isProjectOpen
                    ? (activeConversationId ?? project.selectedConversationId)
                    : null;

                  return (
                    <ProjectSidebarProject
                      key={project.workspacePath}
                      isExpanded={isExpanded}
                      isActive={isActive}
                      project={project}
                      selectedConversationId={selectedConversationId}
                      onArchiveConversation={handleArchiveConversation}
                      onArchiveProject={handleArchiveWorkspace}
                      onRenameProject={handleRenameProject}
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

        {isDevBuild ? (
          <SidebarGroup className="pt-0">
            <div className="mb-1 flex h-7 items-center justify-between px-2">
              <SidebarGroupLabel className="h-full px-0 font-medium">
                Dev
              </SidebarGroupLabel>
            </div>

            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem className="relative">
                  <SidebarMenuButton
                    isActive={isDemoChatSelected}
                    tooltip="Demo chat"
                    className="pr-12 font-medium"
                    onClick={handleSelectDemoChat}
                  >
                    <FlaskConical strokeWidth={2} className="size-3.5" />
                    <span>Demo chat</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge className="right-2 rounded-full bg-amber-500/10 px-1.5 text-xs font-medium uppercase tracking-widest text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                    Dev
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 pb-3">
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-sidebar via-sidebar/95 to-transparent" />
        <div className="relative pointer-events-auto">
          <SidebarSettingsControl onOpenSettings={onOpenSettings} />
        </div>
      </div>
    </Sidebar>
  );
}
