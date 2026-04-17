import { Folder, PenSquare } from "lucide-react";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";

interface ProjectSidebarActionsProps {
  hasCurrentWorkspace: boolean;
  isOpeningProject: boolean;
  onOpenWorkspacePicker: () => void;
  onStartNewChat: () => void;
}

export function ProjectSidebarActions({
  hasCurrentWorkspace,
  isOpeningProject,
  onOpenWorkspacePicker,
  onStartNewChat,
}: ProjectSidebarActionsProps) {
  return (
    <SidebarMenu aria-label="Primary">
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="New chat"
          onClick={onStartNewChat}
          disabled={!hasCurrentWorkspace}
          className="font-medium [&_svg]:size-3.5"
        >
          <PenSquare strokeWidth={2} className="size-3.5 shrink-0" />
          <span>New chat</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Open project"
          onClick={onOpenWorkspacePicker}
          disabled={isOpeningProject}
          className="font-medium [&_svg]:size-3.5"
        >
          <Folder strokeWidth={2} className="size-3.5 shrink-0" />
          <span>{isOpeningProject ? "Opening…" : "Open project"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
