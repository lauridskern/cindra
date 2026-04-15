import { useAtomValue } from 'jotai'

import {
  expandedProjectPathsAtom,
  hasCurrentWorkspaceAtom,
  isBusyAtom,
  isOpeningProjectAtom,
  projectSummariesAtom,
} from './atoms'
import { useSessionActions } from './useSessionActions'

export function useProjectSidebarController() {
  const expandedProjectPaths = useAtomValue(expandedProjectPathsAtom)
  const hasCurrentWorkspace = useAtomValue(hasCurrentWorkspaceAtom)
  const isBusy = useAtomValue(isBusyAtom)
  const isOpeningProject = useAtomValue(isOpeningProjectAtom)
  const projectSummaries = useAtomValue(projectSummariesAtom)
  const {
    openWorkspacePicker,
    openProject,
    selectConversation,
    startNewChat,
  } = useSessionActions()

  return {
    expandedProjectPaths,
    hasCurrentWorkspace,
    isBusy,
    isOpeningProject,
    projectSummaries,
    openWorkspacePicker,
    openProject,
    selectConversation,
    startNewChat,
  }
}
