import { ChevronDown, ChevronRight, Folder, PenSquare } from 'lucide-react'

import type { WorkspaceSession } from '../services/desktop/contracts'
import { cn } from '../utils/cn'
import { ProjectSidebarConversationRow } from './ProjectSidebarConversationRow'

interface ProjectSidebarProjectProps {
  isExpanded: boolean
  isActive: boolean
  project: WorkspaceSession
  onOpenProject: (workspacePath: string) => void
  onSelectConversation: (workspacePath: string, conversationId: string) => void
  onStartNewChat: (workspacePath: string) => void
  onToggleProjectExpanded: (workspacePath: string) => void
}

export function ProjectSidebarProject({
  isExpanded,
  isActive,
  project,
  onOpenProject,
  onSelectConversation,
  onStartNewChat,
  onToggleProjectExpanded,
}: ProjectSidebarProjectProps) {
  return (
    <div className="grid gap-1">
      <div
        className={cn(
          'group flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors duration-150',
          (isActive || isExpanded) && 'bg-neutral-950/5 dark:bg-white/10',
          !(isActive || isExpanded) &&
            'hover:bg-neutral-950/5 dark:hover:bg-white/5',
        )}
      >
        <button
          type="button"
          className="appearance-none font-inherit transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-neutral-600 dark:text-neutral-200"
          onClick={() => {
            if (isActive) {
              onToggleProjectExpanded(project.workspacePath)
              return
            }

            onOpenProject(project.workspacePath)
          }}
        >
          <span className="relative flex size-4 shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-500">
            <Folder
              className={cn(
                'size-3.5 transition-opacity duration-150',
                isExpanded ? 'opacity-0' : 'opacity-100 group-hover:opacity-0',
              )}
            />
            {isExpanded ? (
              <ChevronDown className="absolute size-3.5" />
            ) : (
              <ChevronRight className="absolute size-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
            )}
          </span>
          <span className="truncate pr-1 text-xs font-semibold leading-5 text-neutral-700 dark:text-neutral-100">
            {project.workspaceName}
          </span>
        </button>

        <button
          type="button"
          className="appearance-none font-inherit transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 inline-flex size-7 items-center justify-center rounded-md bg-neutral-950/5 text-neutral-500 hover:bg-neutral-950/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15"
          aria-label={`Start a new chat in ${project.workspaceName}`}
          title="New chat"
          onClick={() => onStartNewChat(project.workspacePath)}
        >
          <PenSquare className="size-3 shrink-0" />
        </button>
      </div>

      {isExpanded ? (
        project.conversations.length > 0 ? (
          <div className="grid gap-0.5 pl-7">
            {project.conversations.map((conversation) => (
              <ProjectSidebarConversationRow
                key={`${project.workspacePath}:${conversation.conversationId}`}
                conversation={conversation}
                isSelected={
                  project.selectedConversationId === conversation.conversationId
                }
                workspacePath={project.workspacePath}
                onSelectConversation={onSelectConversation}
              />
            ))}
          </div>
        ) : isActive ? (
          <p className="pl-7 text-xs text-neutral-400 dark:text-neutral-500">
            No chats yet
          </p>
        ) : null
      ) : null}
    </div>
  )
}
