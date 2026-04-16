export type StatusCategory =
  | 'action'
  | 'info'
  | 'debug'
  | 'error'
  | 'completion'
  | 'warning'

export interface FollowupOption {
  id: string
  label: string
}

export interface FollowupRequest {
  followupId: string
  workspacePath: string
  conversationId: string
  requestId: string
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

export type SessionMessage =
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

export interface ConversationSessionSummary {
  conversationId: string
  title: string
  updatedAt: string | null
  isSelected: boolean
  isDraft: boolean
  isRunning: boolean
  hasPendingFollowup: boolean
}

export interface WorkspaceSession {
  workspacePath: string
  workspaceName: string
  isActive: boolean
  configured: boolean
  configurationError: string | null
  selectedConversationId: string | null
  conversations: ConversationSessionSummary[]
}

export interface SessionSnapshot {
  activeWorkspacePath: string | null
  activeConversationId: string | null
  activeWorkspaceLabel: string
  visibleMessages: SessionMessage[]
  visibleFollowup: FollowupRequest | null
  uiError: string | null
  workspaces: WorkspaceSession[]
}

export interface SendPromptInput {
  workspacePath: string
  prompt: string
  conversationId?: string
}
