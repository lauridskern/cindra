import { createContext } from 'react'

import type {
  FollowupRequest,
  RuntimeStatus,
  TranscriptMessage,
} from '../services/desktop/contracts'
import type { ProjectSummary } from './sessionReducer'

export interface ConversationStateContextValue {
  activeWorkspaceLabel: string
  hasCurrentWorkspace: boolean
  isBusy: boolean
  isOpeningProject: boolean
  messages: TranscriptMessage[]
  runtimeStatus: RuntimeStatus | null
  uiError: string | null
}

export interface SidebarStateContextValue {
  hasCurrentWorkspace: boolean
  isOpeningProject: boolean
  projectSummaries: ProjectSummary[]
}

export interface FollowupStateContextValue {
  followupRequest: FollowupRequest | null
}

export interface PromptDraftContextValue {
  canCompose: boolean
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

export const FollowupStateContext =
  createContext<FollowupStateContextValue | null>(null)

export const PromptDraftContext =
  createContext<PromptDraftContextValue | null>(null)

export const SessionActionsContext =
  createContext<SessionActionsContextValue | null>(null)
