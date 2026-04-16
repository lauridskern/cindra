import type {
  ProjectConversationGroup,
  RuntimeStatus,
} from '../services/desktop/contracts'

export const emptyRuntimeStatus: RuntimeStatus = {
  workspacePath: null,
  workspaceName: null,
  gitRepoName: null,
  gitBranchName: null,
  configured: true,
  configurationError: null,
}

export const openRuntimeStatus: RuntimeStatus = {
  workspacePath: '/tmp/demo',
  workspaceName: 'demo',
  gitRepoName: 'laurids/demo',
  gitBranchName: 'origin/main',
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
