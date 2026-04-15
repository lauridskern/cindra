import { deriveConversationTitle } from '../../lib/conversation'
import type { TranscriptMessage } from '../../services/desktop/contracts'
import type { AppState } from './reducer'

export interface ProjectConversationItem {
  conversationId: string
  workspacePath: string
  title: string
  updatedAt: string | null
  isActive: boolean
  isRunning: boolean
}

export interface ProjectSummary {
  workspacePath: string
  workspaceName: string
  isCurrent: boolean
  conversations: ProjectConversationItem[]
}

export function isTranscriptRunning(
  messages: TranscriptMessage[],
  activeRequestId: string | null,
): boolean {
  return (
    activeRequestId != null &&
    messages.some((message) => message.requestId === activeRequestId)
  )
}

export function selectVisibleMessages(state: AppState): TranscriptMessage[] {
  if (state.currentConversationId == null) {
    return []
  }

  return state.transcripts[state.currentConversationId] ?? []
}

export function selectActiveWorkspaceLabel(state: AppState): string {
  return state.runtimeStatus?.workspaceName ?? 'Projects'
}

export function selectProjectSummaries(state: AppState): ProjectSummary[] {
  const currentWorkspacePath = state.runtimeStatus?.workspacePath
  const currentWorkspaceName = state.runtimeStatus?.workspaceName ?? 'Workspace'
  const shouldAddCurrentWorkspace =
    currentWorkspacePath != null &&
    !state.projects.some((project) => project.workspacePath === currentWorkspacePath)
  const projects =
    shouldAddCurrentWorkspace
      ? [
          {
            workspacePath: currentWorkspacePath,
            workspaceName: currentWorkspaceName,
            conversations: [],
          },
          ...state.projects,
        ]
      : state.projects

  return projects.map((project) => {
    const isCurrent = project.workspacePath === currentWorkspacePath
    const history = project.conversations.map((conversation) => ({
      conversationId: conversation.conversationId,
      workspacePath: project.workspacePath,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      isActive: state.currentConversationId === conversation.conversationId,
      isRunning: isTranscriptRunning(
        state.transcripts[conversation.conversationId] ?? [],
        state.activeRequestId,
      ),
    }))

    const draftConversations = isCurrent
      ? Object.entries(state.transcripts)
          .filter(([conversationId]) =>
            !project.conversations.some(
              (conversation) => conversation.conversationId === conversationId,
            ),
          )
          .map(([conversationId, messages]) => ({
            conversationId,
            workspacePath: project.workspacePath,
            title: deriveConversationTitle(messages),
            updatedAt: null,
            isActive: state.currentConversationId === conversationId,
            isRunning: isTranscriptRunning(messages, state.activeRequestId),
          }))
          .reverse()
      : []

    return {
      workspacePath: project.workspacePath,
      workspaceName: project.workspaceName,
      isCurrent,
      conversations: [...draftConversations, ...history],
    }
  })
}
