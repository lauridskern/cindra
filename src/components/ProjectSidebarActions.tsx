import { Folder, Pencil } from 'lucide-react'

import { navRowClass } from '../styles/classes'

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
        className={navRowClass}
        onClick={onStartNewChat}
        disabled={!hasCurrentWorkspace}
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
  )
}
