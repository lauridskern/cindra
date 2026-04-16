import type { ProjectConversationItem } from '../app/sessionSelectors'
import { cn } from '../utils/cn'
import { formatRelativeTimestamp } from '../utils/time'
import { SidebarMenuSubButton, SidebarMenuSubItem } from './ui/sidebar'

interface ProjectSidebarConversationRowProps {
  conversation: ProjectConversationItem
  onSelectConversation: (workspacePath: string, conversationId: string) => void
}

export function ProjectSidebarConversationRow({
  conversation,
  onSelectConversation,
}: ProjectSidebarConversationRowProps) {
  const updatedAt = formatRelativeTimestamp(conversation.updatedAt)

  return (
    <SidebarMenuSubItem className="w-full">
      <SidebarMenuSubButton
        render={<button type="button" />}
        isActive={conversation.isActive}
        className={cn(
          'h-7 w-full justify-start text-left items-center gap-2 font-medium',
          conversation.isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        )}
        onClick={() =>
          onSelectConversation(conversation.workspacePath, conversation.conversationId)
        }
      >
        <span className="min-w-0 flex-1 truncate text-left pr-2">
          {conversation.title}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-right text-xs font-medium text-sidebar-foreground/60">
          {conversation.isRunning ? (
            <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 font-medium text-sidebar-accent-foreground">
              Running
            </span>
          ) : null}
          {updatedAt ? <span className="whitespace-nowrap">{updatedAt}</span> : null}
        </span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}
