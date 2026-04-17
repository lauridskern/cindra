import { ChevronDown, ChevronRight, Folder, PenSquare } from "lucide-react";

import type { ProjectSummary } from "../app/sessionSelectors";
import { cn } from "../utils/cn";
import { ProjectSidebarConversationRow } from "./ProjectSidebarConversationRow";
import { Button } from "./ui/button";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "./ui/sidebar";

interface ProjectSidebarProjectProps {
  isExpanded: boolean;
  project: ProjectSummary;
  onEnsureProjectExpanded: (workspacePath: string) => void;
  onOpenProject: (workspacePath: string) => void;
  onSelectConversation: (workspacePath: string, conversationId: string) => void;
  onStartNewChat: (workspacePath: string) => void;
  onToggleProjectExpanded: (workspacePath: string) => void;
}

export function ProjectSidebarProject({
  isExpanded,
  project,
  onEnsureProjectExpanded,
  onOpenProject,
  onSelectConversation,
  onStartNewChat,
  onToggleProjectExpanded,
}: ProjectSidebarProjectProps) {
  return (
    <SidebarMenuItem className="grid gap-1">
      <div className="relative">
        <SidebarMenuButton
          isActive={project.isCurrent}
          tooltip={project.workspaceName}
          className="font-medium"
          onClick={() => {
            if (project.isCurrent) {
              onToggleProjectExpanded(project.workspacePath);
              return;
            }

            onEnsureProjectExpanded(project.workspacePath);
            onOpenProject(project.workspacePath);
          }}
        >
          <span className="relative flex size-3.5 shrink-0 items-center justify-center">
            <Folder
              strokeWidth={2}
              className={cn(
                "size-3.5 transition-opacity duration-150",
                isExpanded
                  ? "opacity-0"
                  : "opacity-100 group-hover/menu-button:opacity-0",
              )}
            />
            {isExpanded ? (
              <ChevronDown strokeWidth={2} className="absolute size-3.5" />
            ) : (
              <ChevronRight
                strokeWidth={2}
                className="absolute size-3.5 opacity-0 transition-opacity duration-150 group-hover/menu-button:opacity-100"
              />
            )}
          </span>
          <span>{project.workspaceName}</span>
        </SidebarMenuButton>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-0 -translate-y-1/2 bg-black/0 opacity-0 hover:bg-black/0 group-hover/menu-item:opacity-100 focus-visible:opacity-100 dark:bg-white/0 dark:hover:bg-white/0 aria-expanded:bg-black/0 dark:aria-expanded:bg-white/0"
          aria-label={`Start a new chat in ${project.workspaceName}`}
          title="New chat"
          onClick={() => {
            onEnsureProjectExpanded(project.workspacePath);
            onStartNewChat(project.workspacePath);
          }}
        >
          <PenSquare strokeWidth={2} className="size-3.5 shrink-0" />
        </Button>
      </div>

      {isExpanded ? (
        project.conversations.length > 0 ? (
          <SidebarMenuSub className="ml-3.5 mr-0 pr-0">
            {project.conversations.map((conversation) => (
              <ProjectSidebarConversationRow
                key={`${project.workspacePath}:${conversation.conversationId}`}
                conversation={conversation}
                onSelectConversation={onSelectConversation}
              />
            ))}
          </SidebarMenuSub>
        ) : project.isCurrent ? (
          <p className="px-2 py-1 text-xs font-medium text-sidebar-foreground/60">
            No chats yet
          </p>
        ) : null
      ) : null}
    </SidebarMenuItem>
  );
}
