import type {
  ProjectConversationGroup,
  RuntimeStatus,
} from '../services/desktop/contracts'

export const emptyRuntimeStatus: RuntimeStatus = {
  workspacePath: null,
  workspaceName: null,
  configured: true,
  configurationError: null,
}

export const openRuntimeStatus: RuntimeStatus = {
  workspacePath: '/tmp/demo',
  workspaceName: 'demo',
  configured: true,
  configurationError: null,
}

export function createProjectGroup(
  workspacePath: string,
  workspaceName: string,
  conversations: ProjectConversationGroup['conversations'],
): ProjectConversationGroup {
  return {
    workspacePath,
    workspaceName,
    conversations,
  }
}
