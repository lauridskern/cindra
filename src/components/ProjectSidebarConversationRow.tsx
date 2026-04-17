import type { ConversationSessionSummary } from "../services/desktop/contracts";
import { cn } from "../utils/cn";
import { formatRelativeTimestamp } from "../utils/time";
import { SidebarMenuSubButton, SidebarMenuSubItem } from "./ui/sidebar";

interface ProjectSidebarConversationRowProps {
  conversation: ConversationSessionSummary;
  isSelected: boolean;
  workspacePath: string;
  onSelectConversation: (workspacePath: string, conversationId: string) => void;
}

export function ProjectSidebarConversationRow({
  conversation,
  isSelected,
  workspacePath,
  onSelectConversation,
}: ProjectSidebarConversationRowProps) {
  const updatedAt = formatRelativeTimestamp(conversation.updatedAt);

  return (
    <SidebarMenuSubItem className="w-full">
      <SidebarMenuSubButton
        render={<button type="button" />}
        isActive={isSelected}
        className={cn(
          "h-auto w-full items-center justify-start gap-2 py-1.5 text-left font-medium",
          isSelected &&
            "bg-sidebar-accent text-sidebar-accent-foreground dark:bg-sidebar-accent dark:text-sidebar-accent-foreground",
        )}
        onClick={() =>
          onSelectConversation(workspacePath, conversation.conversationId)
        }
      >
        <span className="min-w-0 flex-1 truncate pr-2 text-left">
          {conversation.title}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-right text-xs font-medium text-sidebar-foreground/60">
          {conversation.hasPendingFollowup ? (
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
              Needs input
            </span>
          ) : null}
          {conversation.isRunning ? (
            <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 font-medium text-sidebar-accent-foreground">
              Running
            </span>
          ) : null}
          {updatedAt ? <span className="whitespace-nowrap">{updatedAt}</span> : null}
        </span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
