import type { TranscriptMessage } from './contracts'
import type { AppState } from './reducer'

export interface SidebarConversation {
  id: string
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
  conversations: SidebarConversation[]
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function getConversationTitle(messages: TranscriptMessage[]): string {
  const firstUser = messages.find((message) => message.kind === 'user')
  if (firstUser?.kind === 'user') {
    return collapseWhitespace(firstUser.text).slice(0, 72) || 'New chat'
  }

  const firstAssistant = messages.find(
    (message) => message.kind === 'assistant' || message.kind === 'reasoning',
  )
  if (
    firstAssistant?.kind === 'assistant' ||
    firstAssistant?.kind === 'reasoning'
  ) {
    return collapseWhitespace(firstAssistant.text).slice(0, 72) || 'New chat'
  }

  return 'New chat'
}

export function formatRelativeTimestamp(value: string | null): string | null {
  if (!value) {
    return null
  }

  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) {
    return null
  }

  const absMs = Math.abs(Date.now() - timestamp.getTime())
  const units = [
    { threshold: 365 * 24 * 60 * 60 * 1000, label: 'y' },
    { threshold: 30 * 24 * 60 * 60 * 1000, label: 'mo' },
    { threshold: 7 * 24 * 60 * 60 * 1000, label: 'w' },
    { threshold: 24 * 60 * 60 * 1000, label: 'd' },
    { threshold: 60 * 60 * 1000, label: 'h' },
    { threshold: 60 * 1000, label: 'm' },
    { threshold: 1000, label: 's' },
  ] as const

  for (const unit of units) {
    if (absMs >= unit.threshold) {
      return `${Math.round(absMs / unit.threshold)}${unit.label}`
    }
  }

  return '0s'
}

export function isTranscriptRunning(
  messages: TranscriptMessage[],
  activeRequestId: string | null,
): boolean {
  return Boolean(
    activeRequestId &&
      messages.some((message) => message.requestId === activeRequestId),
  )
}

export function getVisibleMessages(state: AppState): TranscriptMessage[] {
  if (!state.currentConversationId) {
    return []
  }

  return state.transcripts[state.currentConversationId] ?? []
}

export function getMainTitle(state: AppState): string {
  return state.runtimeStatus?.workspaceName ?? 'Projects'
}

export function getProjectSummaries(state: AppState): ProjectSummary[] {
  const currentWorkspacePath = state.runtimeStatus?.workspacePath
  const currentWorkspaceName = state.runtimeStatus?.workspaceName ?? 'Workspace'
  const projects =
    currentWorkspacePath &&
    !state.projects.some((project) => project.workspacePath === currentWorkspacePath)
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
      id: conversation.conversationId,
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
            id: conversationId,
            workspacePath: project.workspacePath,
            title: getConversationTitle(messages),
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
