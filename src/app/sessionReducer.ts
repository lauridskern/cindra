import type {
  ChatEventEnvelope,
  ConversationTranscript,
  FollowupRequest,
  ProjectConversationGroup,
  RuntimeStatus,
  StatusCategory,
  TranscriptMessage,
} from '../services/desktop/contracts'
import { deriveConversationTitle } from '../utils/conversation'

export interface AppState {
  runtimeStatus: RuntimeStatus | null
  projects: ProjectConversationGroup[]
  transcripts: Record<string, TranscriptMessage[]>
  conversationWorkspaceById: Record<string, string>
  selectedConversationByWorkspace: Record<string, string | null>
  currentConversationId: string | null
  activeRequestIdsByConversation: Record<string, string[]>
  followup: FollowupRequest | null
  uiError: string | null
}

export type SessionAction =
  | { type: 'runtime_status_loaded'; status: RuntimeStatus }
  | { type: 'workspace_opened'; status: RuntimeStatus }
  | { type: 'projects_loaded'; items: ProjectConversationGroup[] }
  | { type: 'conversation_loaded'; item: ConversationTranscript }
  | { type: 'ui_error'; message: string }
  | {
      type: 'prompt_queued'
      workspacePath: string
      originConversationId: string | null
      conversationId: string
      requestId: string
      prompt: string
    }
  | { type: 'chat_event_received'; payload: ChatEventEnvelope }
  | { type: 'followup_received'; payload: FollowupRequest }
  | { type: 'followup_cleared' }
  | { type: 'conversation_selected'; conversationId: string }
  | {
      type: 'chat_reset'
      workspacePath: string
      originConversationId: string | null
      conversationId: string
    }

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

export const initialSessionState: AppState = {
  runtimeStatus: null,
  projects: [],
  transcripts: {},
  conversationWorkspaceById: {},
  selectedConversationByWorkspace: {},
  currentConversationId: null,
  activeRequestIdsByConversation: {},
  followup: null,
  uiError: null,
}

function assertNever(value: never): never {
  throw new Error(`Unhandled state transition: ${String(value)}`)
}

function getSelectedConversationForWorkspace(
  state: AppState,
  workspacePath: string | null | undefined,
): string | null {
  return workspacePath == null
    ? null
    : state.selectedConversationByWorkspace[workspacePath] ?? null
}

function getTranscript(
  transcripts: Record<string, TranscriptMessage[]>,
  conversationId: string,
): TranscriptMessage[] {
  return transcripts[conversationId] ?? []
}

function withTranscript(
  state: AppState,
  conversationId: string,
  messages: TranscriptMessage[],
): AppState {
  return {
    ...state,
    transcripts: {
      ...state.transcripts,
      [conversationId]: messages,
    },
  }
}

function updateTranscript(
  state: AppState,
  conversationId: string,
  updater: (messages: TranscriptMessage[]) => TranscriptMessage[],
): AppState {
  return withTranscript(
    state,
    conversationId,
    updater(getTranscript(state.transcripts, conversationId)),
  )
}

function appendTranscriptMessage(
  state: AppState,
  conversationId: string,
  message: TranscriptMessage,
): AppState {
  return updateTranscript(state, conversationId, (messages) => [...messages, message])
}

function createMessageId(prefix: string, requestId: string, index: number): string {
  return `${prefix}:${requestId}:${index}`
}

function appendStreamedMessage(
  messages: TranscriptMessage[],
  kind: 'assistant' | 'reasoning',
  requestId: string,
  text: string,
): TranscriptMessage[] {
  const last = messages.at(-1)
  if (last?.kind === kind && last.requestId === requestId) {
    return [
      ...messages.slice(0, -1),
      { ...last, text: `${last.text}${text}` },
    ]
  }

  return [
    ...messages,
    {
      id: createMessageId(kind, requestId, messages.length),
      kind,
      requestId,
      text,
    },
  ]
}

function appendStatusMessage(
  messages: TranscriptMessage[],
  requestId: string,
  title: string,
  category: StatusCategory,
  subtitle?: string,
): TranscriptMessage[] {
  return [
    ...messages,
    {
      id: createMessageId('status', requestId, messages.length),
      kind: 'status',
      requestId,
      title,
      subtitle,
      category,
    },
  ]
}

function appendConversationEvent(
  state: AppState,
  conversationId: string,
  requestId: string,
  prefix: string,
  message:
    | Omit<Extract<TranscriptMessage, { kind: 'status_output' }>, 'id' | 'requestId'>
    | Omit<Extract<TranscriptMessage, { kind: 'tool_start' }>, 'id' | 'requestId'>
    | Omit<Extract<TranscriptMessage, { kind: 'tool_end' }>, 'id' | 'requestId'>
    | Omit<Extract<TranscriptMessage, { kind: 'error' }>, 'id' | 'requestId'>,
): AppState {
  return updateTranscript(state, conversationId, (messages) => [
    ...messages,
    {
      id: createMessageId(prefix, requestId, messages.length),
      requestId,
      ...message,
    },
  ])
}

function selectConversationForWorkspace(
  state: AppState,
  workspacePath: string,
  conversationId: string | null,
  options?: { updateCurrentConversationId?: boolean },
): AppState {
  const updateCurrentConversationId = options?.updateCurrentConversationId ?? true

  return {
    ...state,
    currentConversationId: updateCurrentConversationId
      ? conversationId
      : state.currentConversationId,
    selectedConversationByWorkspace: {
      ...state.selectedConversationByWorkspace,
      [workspacePath]: conversationId,
    },
  }
}

function withRuntimeStatus(state: AppState, status: RuntimeStatus): AppState {
  return {
    ...state,
    runtimeStatus: status,
    currentConversationId: getSelectedConversationForWorkspace(
      state,
      status.workspacePath,
    ),
    uiError: null,
  }
}

function withTrackedConversationWorkspace(
  state: AppState,
  conversationId: string,
  workspacePath: string,
): AppState {
  return {
    ...state,
    conversationWorkspaceById: {
      ...state.conversationWorkspaceById,
      [conversationId]: workspacePath,
    },
  }
}

function withActiveRequest(
  state: AppState,
  conversationId: string,
  requestId: string,
): AppState {
  const currentRequestIds = state.activeRequestIdsByConversation[conversationId] ?? []
  if (currentRequestIds.includes(requestId)) {
    return state
  }

  return {
    ...state,
    activeRequestIdsByConversation: {
      ...state.activeRequestIdsByConversation,
      [conversationId]: [...currentRequestIds, requestId],
    },
  }
}

function withoutActiveRequest(
  state: AppState,
  conversationId: string,
  requestId: string,
): AppState {
  const currentRequestIds = state.activeRequestIdsByConversation[conversationId]
  if (currentRequestIds == null || !currentRequestIds.includes(requestId)) {
    return state
  }

  const nextRequestIds = currentRequestIds.filter((current) => current !== requestId)
  const nextActiveRequestIdsByConversation = {
    ...state.activeRequestIdsByConversation,
  }

  if (nextRequestIds.length === 0) {
    delete nextActiveRequestIdsByConversation[conversationId]
  } else {
    nextActiveRequestIdsByConversation[conversationId] = nextRequestIds
  }

  return {
    ...state,
    activeRequestIdsByConversation: nextActiveRequestIdsByConversation,
  }
}

function shouldRetargetVisibleConversation(
  state: AppState,
  workspacePath: string,
  originConversationId: string | null,
): boolean {
  return (
    workspacePath === state.runtimeStatus?.workspacePath &&
    state.currentConversationId === originConversationId
  )
}

function applyChatEvent(state: AppState, payload: ChatEventEnvelope): AppState {
  const { conversationId, requestId, event } = payload
  const nextState = state

  switch (event.type) {
    case 'started':
      return withActiveRequest(nextState, conversationId, requestId)
    case 'assistant_markdown':
      return updateTranscript(nextState, conversationId, (messages) =>
        appendStreamedMessage(messages, 'assistant', requestId, event.text),
      )
    case 'reasoning':
      return updateTranscript(nextState, conversationId, (messages) =>
        appendStreamedMessage(messages, 'reasoning', requestId, event.text),
      )
    case 'status':
      return updateTranscript(nextState, conversationId, (messages) =>
        appendStatusMessage(
          messages,
          requestId,
          event.title,
          event.category,
          event.subtitle,
        ),
      )
    case 'status_output':
      return appendConversationEvent(nextState, conversationId, requestId, 'status-output', {
        kind: 'status_output',
        text: event.text,
      })
    case 'tool_start':
      return appendConversationEvent(nextState, conversationId, requestId, 'tool-start', {
        kind: 'tool_start',
        name: event.name,
      })
    case 'tool_end':
      return appendConversationEvent(nextState, conversationId, requestId, 'tool-end', {
        kind: 'tool_end',
        name: event.name,
        summary: event.summary,
        isError: event.isError,
      })
    case 'retry':
      return updateTranscript(nextState, conversationId, (messages) =>
        appendStatusMessage(
          messages,
          requestId,
          'Retrying request',
          'warning',
          `${event.cause} (${event.durationMs} ms)`,
        ),
      )
    case 'interrupt':
      return updateTranscript(nextState, conversationId, (messages) =>
        appendStatusMessage(messages, requestId, 'Interrupted', 'warning', event.reason),
      )
    case 'complete':
      return withoutActiveRequest(nextState, conversationId, requestId)
    case 'error': {
      const withError = appendConversationEvent(
        withoutActiveRequest(nextState, conversationId, requestId),
        conversationId,
        requestId,
        'error',
        {
          kind: 'error',
          message: event.message,
        },
      )

      return {
        ...withError,
        followup: null,
      }
    }
    default:
      return assertNever(event)
  }
}

export function selectIsConversationRunning(
  state: AppState,
  conversationId: string | null,
): boolean {
  return conversationId != null
    ? (state.activeRequestIdsByConversation[conversationId]?.length ?? 0) > 0
    : false
}

export function selectHasRunningConversations(state: AppState): boolean {
  return Object.values(state.activeRequestIdsByConversation).some(
    (requestIds) => requestIds.length > 0,
  )
}

function createUserQueuedMessage(requestId: string, prompt: string): TranscriptMessage {
  return {
    id: createMessageId('user', requestId, 0),
    kind: 'user',
    requestId,
    text: prompt,
  }
}

function appendQueuedPrompt(
  state: AppState,
  action: Extract<SessionAction, { type: 'prompt_queued' }>,
): AppState {
  const queuedState = withTrackedConversationWorkspace(
    withActiveRequest(
      {
        ...state,
        followup: null,
      },
      action.conversationId,
      action.requestId,
    ),
    action.conversationId,
    action.workspacePath,
  )

  return appendTranscriptMessage(
    shouldRetargetVisibleConversation(
      state,
      action.workspacePath,
      action.originConversationId,
    )
      ? selectConversationForWorkspace(
          queuedState,
          action.workspacePath,
          action.conversationId,
        )
      : queuedState,
    action.conversationId,
    createUserQueuedMessage(action.requestId, action.prompt),
  )
}

function resetChatConversation(
  state: AppState,
  action: Extract<SessionAction, { type: 'chat_reset' }>,
): AppState {
  const resetState = withTranscript(
    withTrackedConversationWorkspace(
      {
        ...state,
        followup: null,
      },
      action.conversationId,
      action.workspacePath,
    ),
    action.conversationId,
    [],
  )

  return shouldRetargetVisibleConversation(
    state,
    action.workspacePath,
    action.originConversationId,
  )
    ? selectConversationForWorkspace(
        resetState,
        action.workspacePath,
        action.conversationId,
      )
    : resetState
}

export function sessionReducer(state: AppState, action: SessionAction): AppState {
  switch (action.type) {
    case 'runtime_status_loaded':
      return withRuntimeStatus(state, action.status)
    case 'workspace_opened':
      return withRuntimeStatus(state, action.status)
    case 'projects_loaded':
      return { ...state, projects: action.items }
    case 'conversation_loaded':
      return withTranscript(
        state.runtimeStatus?.workspacePath == null
          ? state
          : withTrackedConversationWorkspace(
              state,
              action.item.conversationId,
              state.runtimeStatus.workspacePath,
            ),
        action.item.conversationId,
        action.item.messages,
      )
    case 'ui_error':
      return { ...state, uiError: action.message }
    case 'prompt_queued':
      return appendQueuedPrompt(state, action)
    case 'chat_event_received':
      return applyChatEvent(state, action.payload)
    case 'followup_received':
      return { ...state, followup: action.payload }
    case 'followup_cleared':
      return { ...state, followup: null }
    case 'conversation_selected':
      return state.runtimeStatus?.workspacePath == null
        ? { ...state, currentConversationId: action.conversationId }
        : selectConversationForWorkspace(
            state,
            state.runtimeStatus.workspacePath,
            action.conversationId,
          )
    case 'chat_reset':
      return resetChatConversation(state, action)
    default:
      return assertNever(action)
  }
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

function isTranscriptRunning(
  state: AppState,
  conversationId: string,
): boolean {
  return selectIsConversationRunning(state, conversationId)
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
    const isCurrent = project.workspacePath === currentWorkspacePath
    const history = project.conversations.map((conversation) => ({
      conversationId: conversation.conversationId,
      workspacePath: project.workspacePath,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      isActive: state.currentConversationId === conversation.conversationId,
      isRunning: isTranscriptRunning(state, conversation.conversationId),
    }))

    const draftConversations = isCurrent
      ? Object.entries(state.transcripts)
          .filter(([conversationId]) =>
            state.conversationWorkspaceById[conversationId] === project.workspacePath &&
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
            isRunning: isTranscriptRunning(state, conversationId),
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
