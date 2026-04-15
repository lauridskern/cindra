import {
  ChevronDown,
  ChevronRight,
  Folder,
  PenSquare,
  Pencil,
} from 'lucide-react'

import { formatRelativeTimestamp } from '../../../lib/time'
import { cn } from '../../../lib/cn'
import type { ProjectSummary } from '../../../state/session/selectors'
import {
  navRowClass,
  projectActionButtonClass,
  threadRowClass,
  interactiveBaseClass,
} from '../../../styles/classes'

interface ProjectSidebarProps {
  hasCurrentWorkspace: boolean
  expandedProjectPaths: string[]
  isBusy: boolean
  isOpeningProject: boolean
  projects: ProjectSummary[]
  onOpenWorkspacePicker: () => void
  onOpenProject: (workspacePath: string) => void
  onSelectConversation: (workspacePath: string, conversationId: string) => void
  onStartNewChat: (workspacePath?: string) => void
}

export function ProjectSidebar({
  expandedProjectPaths,
  hasCurrentWorkspace,
  isBusy,
  isOpeningProject,
  projects,
  onOpenWorkspacePicker,
  onOpenProject,
  onSelectConversation,
  onStartNewChat,
}: ProjectSidebarProps) {
  return (
    <aside className="min-h-0 overflow-hidden bg-transparent">
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden px-1.5 pb-2.5 pt-1.5 [&_*]:select-none max-[720px]:p-2.5">
        <nav className="mb-2 mt-[18px] grid gap-px" aria-label="Primary">
          <button
            type="button"
            className={navRowClass}
            onClick={() => void onStartNewChat()}
            disabled={!hasCurrentWorkspace || isBusy}
          >
            <Pencil className="size-3.5 shrink-0" />
            <span>New chat</span>
          </button>
          <button
            type="button"
            className={navRowClass}
            onClick={onOpenWorkspacePicker}
            disabled={isOpeningProject}
          >
            <Folder className="size-3.5 shrink-0" />
            <span>{isOpeningProject ? 'Opening…' : 'Open project'}</span>
          </button>
        </nav>

        <section className="grid min-h-0 content-start gap-1">
          <div className="flex items-center gap-2.5 px-1.5 text-[0.64rem] font-medium tracking-[-0.01em] text-neutral-400 dark:text-neutral-500">
            <span>Projects</span>
          </div>

          <div className="grid gap-1.5">
            {projects.length === 0 ? (
              <p className="mt-0.5 px-2 text-[0.66rem] text-neutral-400 dark:text-neutral-500">
                No Forge projects yet
              </p>
            ) : (
              projects.map((project) => {
                const isExpanded = expandedProjectPaths.includes(project.workspacePath)
                const newChatDisabled = project.isCurrent && isBusy

                return (
                  <div key={project.workspacePath} className="grid gap-1">
                    <div
                      className={cn(
                        'group flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors duration-150',
                        (project.isCurrent || isExpanded) &&
                          'bg-neutral-950/[0.045] dark:bg-white/[0.08]',
                        !(project.isCurrent || isExpanded) &&
                          'hover:bg-neutral-950/[0.04] dark:hover:bg-white/[0.06]',
                      )}
                    >
                      <button
                        type="button"
                        className={cn(
                          interactiveBaseClass,
                          'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-neutral-600 dark:text-neutral-200',
                        )}
                        onClick={() => void onOpenProject(project.workspacePath)}
                      >
                        <span className="relative flex size-4 shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-500">
                          <Folder
                            className={cn(
                              'size-3.5 transition-opacity duration-150',
                              isExpanded
                                ? 'opacity-0'
                                : 'opacity-100 group-hover:opacity-0',
                            )}
                          />
                          {isExpanded ? (
                            <ChevronDown className="absolute size-3.5" />
                          ) : (
                            <ChevronRight className="absolute size-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                          )}
                        </span>
                        <span className="truncate pr-1 text-[0.74rem] font-semibold leading-5 text-neutral-700 dark:text-neutral-100">
                          {project.workspaceName}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={projectActionButtonClass}
                        aria-label={`Start a new chat in ${project.workspaceName}`}
                        title="New chat"
                        onClick={() => void onStartNewChat(project.workspacePath)}
                        disabled={newChatDisabled}
                      >
                        <PenSquare className="size-3 shrink-0" />
                      </button>
                    </div>

                    {isExpanded ? (
                      project.conversations.length > 0 ? (
                        <div className="grid gap-0.5 pl-7">
                          {project.conversations.map((conversation) => {
                            const updatedAt = formatRelativeTimestamp(
                              conversation.updatedAt,
                            )

                            return (
                              <button
                                key={`${project.workspacePath}:${conversation.conversationId}`}
                                type="button"
                                className={cn(
                                  threadRowClass,
                                  'px-2.5 py-1.5 text-[0.74rem]',
                                  conversation.isActive &&
                                    'bg-neutral-950/[0.08] dark:bg-white/[0.1]',
                                )}
                                onClick={() =>
                                  void onSelectConversation(
                                    conversation.workspacePath,
                                    conversation.conversationId,
                                  )}
                              >
                                <span className="min-w-0 truncate pr-2 text-[0.74rem] leading-5 text-neutral-800 dark:text-neutral-100">
                                  {conversation.title}
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5 text-right">
                                  {conversation.isRunning ? (
                                    <span className="rounded-full bg-neutral-950/[0.07] px-1.5 py-0.5 text-[0.56rem] font-semibold text-neutral-500 dark:bg-white/[0.08] dark:text-neutral-300">
                                      Running
                                    </span>
                                  ) : null}
                                  {updatedAt ? (
                                    <span className="text-[0.68rem] whitespace-nowrap text-neutral-400 dark:text-neutral-500">
                                      {updatedAt}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      ) : project.isCurrent ? (
                        <p className="pl-7 text-[0.64rem] text-neutral-400 dark:text-neutral-500">
                          No chats yet
                        </p>
                      ) : null
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </aside>
  )
}
