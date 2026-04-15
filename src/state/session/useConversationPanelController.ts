import { useAtomValue } from 'jotai'

import {
  activeWorkspaceLabelAtom,
  hasCurrentWorkspaceAtom,
  isOpeningProjectAtom,
  runtimeStatusAtom,
  uiErrorAtom,
  visibleMessagesAtom,
} from './atoms'
import { useSessionActions } from './useSessionActions'

export function useConversationPanelController() {
  const activeWorkspaceLabel = useAtomValue(activeWorkspaceLabelAtom)
  const hasCurrentWorkspace = useAtomValue(hasCurrentWorkspaceAtom)
  const isOpeningProject = useAtomValue(isOpeningProjectAtom)
  const messages = useAtomValue(visibleMessagesAtom)
  const runtimeStatus = useAtomValue(runtimeStatusAtom)
  const uiError = useAtomValue(uiErrorAtom)
  const { openWorkspacePicker } = useSessionActions()

  return {
    activeWorkspaceLabel,
    hasCurrentWorkspace,
    isOpeningProject,
    messages,
    runtimeStatus,
    uiError,
    openWorkspacePicker,
  }
}
