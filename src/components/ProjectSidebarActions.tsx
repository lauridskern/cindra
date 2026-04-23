import { Folder, PenSquare } from "lucide-react";

import type { ProjectSidebarActionsProps } from "./types/sidebar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/Sidebar";

export function ProjectSidebarActions({
  onOpenWorkspacePicker,
  onStartNewChat,
}: ProjectSidebarActionsProps) {
  return (
    <SidebarMenu aria-label="Primary">
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="New chat"
          onClick={onStartNewChat}
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
          className="font-medium [&_svg]:size-3.5"
        >
          <Folder strokeWidth={2} className="size-3.5 shrink-0" />
          <span>Open project</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
