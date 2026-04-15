import type {
  ChatEventEnvelope,
  FollowupRequest,
  ProjectConversationGroup,
  RuntimeStatus,
  TranscriptMessage,
  ConversationTranscript,
  StatusCategory,
} from '../../services/desktop/contracts'

export interface AppState {
  runtimeStatus: RuntimeStatus | null
  projects: ProjectConversationGroup[]
  transcripts: Record<string, TranscriptMessage[]>
  currentConversationId: string | null
  activeRequestId: string | null
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
      conversationId: string
      requestId: string
      prompt: string
    }
  | { type: 'chat_event_received'; payload: ChatEventEnvelope }
  | { type: 'followup_received'; payload: FollowupRequest }
  | { type: 'followup_cleared' }
  | { type: 'conversation_selected'; conversationId: string }
  | { type: 'chat_reset'; conversationId: string }

export const initialSessionState: AppState = {
  runtimeStatus: null,
  projects: [],
  transcripts: {},
  currentConversationId: null,
  activeRequestId: null,
  followup: null,
  uiError: null,
}

function assertNever(value: never): never {
  throw new Error(`Unhandled state transition: ${String(value)}`)
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

function applyChatEvent(state: AppState, payload: ChatEventEnvelope): AppState {
  const { conversationId, requestId, event } = payload
  const nextState = {
    ...state,
    currentConversationId: conversationId,
  }

  switch (event.type) {
    case 'started':
      return { ...nextState, activeRequestId: requestId }
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
      return nextState.activeRequestId === requestId
        ? { ...nextState, activeRequestId: null }
        : nextState
    case 'error': {
      const withError = appendConversationEvent(
        nextState,
        conversationId,
        requestId,
        'error',
        {
          kind: 'error',
          message: event.message,
        },
      )

      return withError.activeRequestId === requestId
        ? { ...withError, activeRequestId: null, followup: null }
        : withError
    }
    default:
      return assertNever(event)
  }
}

export function sessionReducer(state: AppState, action: SessionAction): AppState {
  switch (action.type) {
    case 'runtime_status_loaded':
      return { ...state, runtimeStatus: action.status, uiError: null }
    case 'workspace_opened':
      return {
        ...state,
        runtimeStatus: action.status,
        transcripts: {},
        currentConversationId: null,
        activeRequestId: null,
        followup: null,
        uiError: null,
      }
    case 'projects_loaded':
      return { ...state, projects: action.items }
    case 'conversation_loaded':
      return {
        ...state,
        currentConversationId: action.item.conversationId,
        transcripts: {
          ...state.transcripts,
          [action.item.conversationId]: action.item.messages,
        },
      }
    case 'ui_error':
      return { ...state, uiError: action.message }
    case 'prompt_queued':
      return appendTranscriptMessage(
        {
          ...state,
          currentConversationId: action.conversationId,
          activeRequestId: action.requestId,
          followup: null,
        },
        action.conversationId,
        {
          id: createMessageId('user', action.requestId, 0),
          kind: 'user',
          requestId: action.requestId,
          text: action.prompt,
        },
      )
    case 'chat_event_received':
      return applyChatEvent(state, action.payload)
    case 'followup_received':
      return { ...state, followup: action.payload }
    case 'followup_cleared':
      return { ...state, followup: null }
    case 'conversation_selected':
      return { ...state, currentConversationId: action.conversationId }
    case 'chat_reset':
      return {
        ...state,
        currentConversationId: action.conversationId,
        activeRequestId: null,
        followup: null,
        transcripts: {
          ...state.transcripts,
          [action.conversationId]: [],
        },
      }
    default:
      return assertNever(action)
  }
}
