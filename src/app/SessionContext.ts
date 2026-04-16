import { createContext } from 'react'

import type {
  FollowupRequest,
  SessionMessage,
  WorkspaceSession,
} from '../services/desktop/contracts'

export interface ConversationStateContextValue {
  activeWorkspaceLabel: string
  activeWorkspaceConfigured: boolean
  activeWorkspaceConfigurationError: string | null
  hasCurrentWorkspace: boolean
  isOpeningProject: boolean
  messages: SessionMessage[]
  uiError: string | null
}

export interface SidebarStateContextValue {
  hasCurrentWorkspace: boolean
  isOpeningProject: boolean
  workspaces: WorkspaceSession[]
}

export interface PromptDraftContextValue {
  canCompose: boolean
  followupRequest: FollowupRequest | null
  isSendingPrompt: boolean
  promptDraft: string
  setPromptDraft: (value: string) => void
}

export interface SessionActionsContextValue {
  openWorkspacePicker: () => Promise<string | null>
  openProject: (workspacePath: string) => Promise<void>
  selectConversation: (workspacePath: string, conversationId: string) => Promise<void>
  startNewChat: (workspacePath?: string) => Promise<void>
  submitPrompt: () => Promise<void>
  submitFollowup: (input: {
    cancelled: boolean
    text?: string
    selectedOptionIds?: string[]
  }) => Promise<void>
}

export const ConversationStateContext =
  createContext<ConversationStateContextValue | null>(null)

export const SidebarStateContext =
  createContext<SidebarStateContextValue | null>(null)

export const PromptDraftContext =
  createContext<PromptDraftContextValue | null>(null)

export const SessionActionsContext =
  createContext<SessionActionsContextValue | null>(null)
