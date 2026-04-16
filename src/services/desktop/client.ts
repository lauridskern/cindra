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

function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args)
}

async function listenEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
): Promise<UnlistenFn> {
  return listen<T>(eventName, (event) => {
    handler(event.payload)
  })
}

export function pickWorkspace(): Promise<string | null> {
  return invokeCommand('pick_workspace')
}

export function openWorkspace(path: string): Promise<RuntimeStatus> {
  return invokeCommand('open_workspace', { path })
}

export function getRuntimeStatus(): Promise<RuntimeStatus> {
  return invokeCommand('get_runtime_status')
}

export function listProjects(): Promise<ProjectConversationGroup[]> {
  return invokeCommand('list_projects')
}

export function loadConversation(
  conversationId: string,
): Promise<ConversationTranscript> {
  return invokeCommand('load_conversation', { conversationId })
}

export function sendPrompt(input: SendPromptInput): Promise<SendPromptResult> {
  return invokeCommand('send_prompt', { input })
}

export function respondFollowup(response: FollowupResponse): Promise<void> {
  return invokeCommand('respond_followup', { response })
}

export function resetChat(): Promise<ResetChatResult> {
  return invokeCommand('reset_chat')
}

export async function listenChatEvents(
  handler: (payload: ChatEventEnvelope) => void,
): Promise<UnlistenFn> {
  return listenEvent(CHAT_EVENT_NAME, handler)
}

export async function listenFollowupRequests(
  handler: (payload: FollowupRequest) => void,
): Promise<UnlistenFn> {
  return listenEvent(FOLLOWUP_EVENT_NAME, handler)
}
