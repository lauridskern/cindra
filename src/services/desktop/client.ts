import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  CheckoutGitBranchInput,
  CloneRepositoryInput,
  CommitGitChangesInput,
  CreateGitBranchInput,
  FollowupResponse,
  PromptSettings,
  QuickStartProjectInput,
  RuntimeStatus,
  SendPromptInput,
  SessionSnapshot,
  UpdatePromptSettingsInput,
} from "./contracts";

const SESSION_UPDATED_EVENT_NAME = "agent-ui://session-updated";

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

export function openWorkspace(path: string): Promise<SessionSnapshot> {
  return invokeCommand("open_workspace", { path });
}

export function getRuntimeStatus(): Promise<RuntimeStatus> {
  return invokeCommand("get_runtime_status");
}

export function getSessionSnapshot(): Promise<SessionSnapshot> {
  return invokeCommand("get_session_snapshot");
}

export function getPromptSettings(): Promise<PromptSettings> {
  return invokeCommand("get_prompt_settings");
}

export function selectConversation(
  workspacePath: string,
  conversationId: string,
): Promise<SessionSnapshot> {
  return invokeCommand("select_conversation", { workspacePath, conversationId });
}

export function startNewChat(workspacePath: string): Promise<SessionSnapshot> {
  return invokeCommand("start_new_chat", { workspacePath });
}

export function sendPrompt(input: SendPromptInput): Promise<SessionSnapshot> {
  return invokeCommand("send_prompt", { input });
}

export function updatePromptSettings(
  input: UpdatePromptSettingsInput,
): Promise<PromptSettings> {
  return invokeCommand("update_prompt_settings", { input });
}

export function respondFollowup(
  response: FollowupResponse,
): Promise<SessionSnapshot> {
  return invokeCommand("respond_followup", { response });
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

export async function listenSessionUpdates(
  handler: (payload: SessionSnapshot) => void,
): Promise<UnlistenFn> {
  return listenEvent(SESSION_UPDATED_EVENT_NAME, handler);
}
