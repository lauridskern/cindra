export type StatusCategory =
  | 'action'
  | 'info'
  | 'debug'
  | 'error'
  | 'completion'
  | 'warning'

export interface RuntimeStatus {
  workspacePath: string | null
  workspaceName: string | null
  gitRepoName: string | null
  gitBranchName: string | null
  configured: boolean
  configurationError: string | null
}

export interface SendPromptInput {
  prompt: string
  conversationId?: string
}

export interface SendPromptResult {
  requestId: string
  conversationId: string
}

export interface ConversationSummary {
  conversationId: string
  title: string
  updatedAt: string | null
}

export interface ProjectConversationGroup {
  workspacePath: string
  workspaceName: string
  conversations: ConversationSummary[]
}

export interface ResetChatResult {
  conversationId: string
}

export interface CloneRepositoryInput {
  repositoryUrl: string
  parentDirectory: string
  directoryName: string
}

export type QuickStartVisibility = 'public' | 'private'

export interface QuickStartProjectInput {
  projectName: string
  parentDirectory: string
  visibility: QuickStartVisibility
}

export interface FollowupOption {
  id: string
  label: string
}

export interface FollowupRequest {
  followupId: string
  kind: 'text' | 'single' | 'multi'
  question: string
  options?: FollowupOption[]
}

export interface FollowupResponse {
  followupId: string
  cancelled: boolean
  text?: string
  selectedOptionIds?: string[]
}

export type ChatEvent =
  | { type: 'started' }
  | { type: 'assistant_markdown'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'status'; title: string; subtitle?: string; category: StatusCategory }
  | { type: 'status_output'; text: string }
  | { type: 'tool_start'; name: string }
  | { type: 'tool_end'; name: string; summary?: string; isError: boolean }
  | { type: 'retry'; cause: string; durationMs: number }
  | { type: 'interrupt'; reason: string }
  | { type: 'complete' }
  | { type: 'error'; message: string }

export interface ChatEventEnvelope {
  requestId: string
  conversationId: string
  event: ChatEvent
}

export type TranscriptMessage =
  | { id: string; kind: 'user'; requestId: string; text: string }
  | { id: string; kind: 'assistant'; requestId: string; text: string }
  | { id: string; kind: 'reasoning'; requestId: string; text: string }
  | {
      id: string
      kind: 'status'
      requestId: string
      title: string
      subtitle?: string
      category: StatusCategory
    }
  | { id: string; kind: 'status_output'; requestId: string; text: string }
  | { id: string; kind: 'tool_start'; requestId: string; name: string }
  | {
      id: string
      kind: 'tool_end'
      requestId: string
      name: string
      summary?: string
      isError: boolean
    }
  | { id: string; kind: 'error'; requestId: string; message: string }

export interface ConversationTranscript {
  conversationId: string
  messages: TranscriptMessage[]
}
