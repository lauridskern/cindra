import type { TranscriptMessage } from '../services/desktop/contracts'
import { deriveConversationTitle } from '../utils/conversation'
import type { AppState } from './sessionReducer'

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

export function selectIsConversationRunning(
  state: AppState,
  conversationId: string | null,
): boolean {
  return conversationId != null
    ? (state.activeRequestIdsByConversation[conversationId]?.length ?? 0) > 0
    : false
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

function getPersistedConversationIdsForWorkspace(
  state: AppState,
  workspacePath: string,
): Set<string> {
  const project = state.projects.find((item) => item.workspacePath === workspacePath)
  return new Set(project?.conversations.map((conversation) => conversation.conversationId))
}

function isEmptyDraftConversation(
  state: AppState,
  workspacePath: string,
  persistedConversationIds: Set<string>,
  conversationId: string,
): boolean {
  return (
    state.conversationWorkspaceById[conversationId] === workspacePath &&
    !persistedConversationIds.has(conversationId) &&
    (state.transcripts[conversationId]?.length ?? 0) === 0
  )
}

export function selectEmptyDraftConversationId(
  state: AppState,
  workspacePath: string,
): string | null {
  const persistedConversationIds = getPersistedConversationIdsForWorkspace(
    state,
    workspacePath,
  )
  const selectedConversationId = state.selectedConversationByWorkspace[workspacePath]

  if (
    selectedConversationId != null &&
    isEmptyDraftConversation(
      state,
      workspacePath,
      persistedConversationIds,
      selectedConversationId,
    )
  ) {
    return selectedConversationId
  }

  return (
    Object.keys(state.transcripts)
      .reverse()
      .find((conversationId) =>
        isEmptyDraftConversation(
          state,
          workspacePath,
          persistedConversationIds,
          conversationId,
        ),
      ) ?? null
  )
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
    const draftConversationIds = new Set(
      project.conversations.map((conversation) => conversation.conversationId),
    )

    const history = project.conversations.map((conversation) => ({
      conversationId: conversation.conversationId,
      workspacePath: project.workspacePath,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      isActive: state.currentConversationId === conversation.conversationId,
      isRunning: selectIsConversationRunning(state, conversation.conversationId),
    }))

    const draftConversations = (project.workspacePath === currentWorkspacePath
      ? Object.entries(state.transcripts)
          .filter(
            ([conversationId]) =>
              state.conversationWorkspaceById[conversationId] === project.workspacePath &&
              !draftConversationIds.has(conversationId),
          )
          .map(([conversationId, messages]) => ({
            conversationId,
            workspacePath: project.workspacePath,
            title: deriveConversationTitle(messages),
            updatedAt: null,
            isActive: state.currentConversationId === conversationId,
            isRunning: selectIsConversationRunning(state, conversationId),
          }))
          .reverse()
      : []) satisfies ProjectConversationItem[]

    return {
      workspacePath: project.workspacePath,
      workspaceName: project.workspaceName,
      isCurrent: project.workspacePath === currentWorkspacePath,
      conversations: [...draftConversations, ...history],
    }
  })
}
