import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  ChatEventEnvelope,
  CheckoutGitBranchInput,
  CloneRepositoryInput,
  CommitGitChangesInput,
  ConversationTranscript,
  CreateGitBranchInput,
  FollowupRequest,
  FollowupResponse,
  ProjectConversationGroup,
  QuickStartProjectInput,
  ResetChatResult,
  RuntimeStatus,
  SendPromptInput,
  SendPromptResult,
} from "./contracts";

const CHAT_EVENT_NAME = "forge://chat-event";
const FOLLOWUP_EVENT_NAME = "forge://followup-request";

function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

async function listenEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
): Promise<UnlistenFn> {
  return listen<T>(eventName, (event) => {
    handler(event.payload);
  });
}

export function pickWorkspace(): Promise<string | null> {
  return invokeCommand("pick_workspace");
}

export function pickDirectory(title?: string): Promise<string | null> {
  return invokeCommand("pick_directory", { title });
}

export function openWorkspace(path: string): Promise<RuntimeStatus> {
  return invokeCommand("open_workspace", { path });
}

export function getRuntimeStatus(): Promise<RuntimeStatus> {
  return invokeCommand("get_runtime_status");
}

export function listProjects(): Promise<ProjectConversationGroup[]> {
  return invokeCommand("list_projects");
}

export function loadConversation(
  conversationId: string,
): Promise<ConversationTranscript> {
  return invokeCommand("load_conversation", { conversationId });
}

export function sendPrompt(input: SendPromptInput): Promise<SendPromptResult> {
  return invokeCommand("send_prompt", { input });
}

export function respondFollowup(response: FollowupResponse): Promise<void> {
  return invokeCommand("respond_followup", { response });
}

export function resetChat(): Promise<ResetChatResult> {
  return invokeCommand("reset_chat");
}

export function cloneRepository(input: CloneRepositoryInput): Promise<string> {
  return invokeCommand("clone_repository", { input });
}

export function quickStartProject(
  input: QuickStartProjectInput,
): Promise<string> {
  return invokeCommand("quick_start_project", { input });
}

export function checkoutGitBranch(
  input: CheckoutGitBranchInput,
): Promise<RuntimeStatus> {
  return invokeCommand("checkout_git_branch", { input });
}

export function createGitBranch(
  input: CreateGitBranchInput,
): Promise<RuntimeStatus> {
  return invokeCommand("create_git_branch", { input });
}

export function commitGitChanges(
  input: CommitGitChangesInput,
): Promise<RuntimeStatus> {
  return invokeCommand("commit_git_changes", { input });
}

export function pushGitBranch(): Promise<RuntimeStatus> {
  return invokeCommand("push_git_branch");
}

export function openInTarget(targetId: string): Promise<void> {
  return invokeCommand("open_in_target", { targetId });
}

export async function listenChatEvents(
  handler: (payload: ChatEventEnvelope) => void,
): Promise<UnlistenFn> {
  return listenEvent(CHAT_EVENT_NAME, handler);
}

export async function listenFollowupRequests(
  handler: (payload: FollowupRequest) => void,
): Promise<UnlistenFn> {
  return listenEvent(FOLLOWUP_EVENT_NAME, handler);
}
