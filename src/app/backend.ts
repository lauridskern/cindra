import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

import type {
  ChatEventEnvelope,
  ConversationTranscript,
  FollowupRequest,
  FollowupResponse,
  ProjectConversationGroup,
  ResetChatResult,
  RuntimeStatus,
  SendPromptInput,
  SendPromptResult,
} from './contracts'

const CHAT_EVENT_NAME = 'forge://chat-event'
const FOLLOWUP_EVENT_NAME = 'forge://followup-request'

export function pickWorkspace(): Promise<string | null> {
  return invoke('pick_workspace')
}

export function openWorkspace(path: string): Promise<RuntimeStatus> {
  return invoke('open_workspace', { path })
}

export function getRuntimeStatus(): Promise<RuntimeStatus> {
  return invoke('get_runtime_status')
}

export function listProjects(): Promise<ProjectConversationGroup[]> {
  return invoke('list_projects')
}

export function loadConversation(
  conversationId: string,
): Promise<ConversationTranscript> {
  return invoke('load_conversation', { conversationId })
}

export function sendPrompt(input: SendPromptInput): Promise<SendPromptResult> {
  return invoke('send_prompt', { input })
}

export function respondFollowup(response: FollowupResponse): Promise<void> {
  return invoke('respond_followup', { response })
}

export function resetChat(): Promise<ResetChatResult> {
  return invoke('reset_chat')
}

export async function listenChatEvents(
  handler: (payload: ChatEventEnvelope) => void,
): Promise<UnlistenFn> {
  return listen<ChatEventEnvelope>(CHAT_EVENT_NAME, (event) => {
    handler(event.payload)
  })
}

export async function listenFollowupRequests(
  handler: (payload: FollowupRequest) => void,
): Promise<UnlistenFn> {
  return listen<FollowupRequest>(FOLLOWUP_EVENT_NAME, (event) => {
    handler(event.payload)
  })
}
