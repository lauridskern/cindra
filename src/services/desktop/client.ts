import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

import type {
  FollowupResponse,
  SendPromptInput,
  SessionSnapshot,
} from './contracts'

const SESSION_UPDATED_EVENT_NAME = 'agent-ui://session-updated'

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

export function openWorkspace(path: string): Promise<SessionSnapshot> {
  return invokeCommand('open_workspace', { path })
}

export function getSessionSnapshot(): Promise<SessionSnapshot> {
  return invokeCommand('get_session_snapshot')
}

export function selectConversation(
  workspacePath: string,
  conversationId: string,
): Promise<SessionSnapshot> {
  return invokeCommand('select_conversation', { workspacePath, conversationId })
}

export function startNewChat(workspacePath: string): Promise<SessionSnapshot> {
  return invokeCommand('start_new_chat', { workspacePath })
}

export function sendPrompt(input: SendPromptInput): Promise<SessionSnapshot> {
  return invokeCommand('send_prompt', { input })
}

export function respondFollowup(
  response: FollowupResponse,
): Promise<SessionSnapshot> {
  return invokeCommand('respond_followup', { response })
}

export async function listenSessionUpdates(
  handler: (payload: SessionSnapshot) => void,
): Promise<UnlistenFn> {
  return listenEvent(SESSION_UPDATED_EVENT_NAME, handler)
}
