import { Folder, Pencil } from 'lucide-react'

interface ProjectSidebarActionsProps {
  hasCurrentWorkspace: boolean
  isOpeningProject: boolean
  onOpenWorkspacePicker: () => void
  onStartNewChat: () => void
}

export function ProjectSidebarActions({
  hasCurrentWorkspace,
  isOpeningProject,
  onOpenWorkspacePicker,
  onStartNewChat,
}: ProjectSidebarActionsProps) {
  return (
    <nav className="mb-2 mt-4 grid gap-px" aria-label="Primary">
      <button
        type="button"
        className="appearance-none font-inherit transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 flex min-h-7 items-center gap-2 rounded-md px-1.5 text-left text-xs text-neutral-800 hover:bg-neutral-950/5 dark:text-neutral-200 dark:hover:bg-white/10"
        onClick={onStartNewChat}
        disabled={!hasCurrentWorkspace}
      >
        <Pencil className="size-3.5 shrink-0" />
        <span>New chat</span>
      </button>
      <button
        type="button"
        className="appearance-none font-inherit transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 flex min-h-7 items-center gap-2 rounded-md px-1.5 text-left text-xs text-neutral-800 hover:bg-neutral-950/5 dark:text-neutral-200 dark:hover:bg-white/10"
        onClick={onOpenWorkspacePicker}
        disabled={isOpeningProject}
      >
        <Folder className="size-3.5 shrink-0" />
        <span>{isOpeningProject ? 'Opening…' : 'Open project'}</span>
      </button>
    </nav>
  )
}
