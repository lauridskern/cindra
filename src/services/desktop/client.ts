import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import {
  SESSION_UPDATED_EVENT_NAME,
  TERMINAL_ERROR_EVENT_NAME,
  TERMINAL_EXIT_EVENT_NAME,
  TERMINAL_OUTPUT_EVENT_NAME,
  PROVIDER_OAUTH_CALLBACK_EVENT_NAME,
} from "./constants/events";
import type {
  ForgeConfigFile,
  HandoffChatInput,
  ChatBinding,
  CloneRepositoryInput,
  CompleteProviderAuthInput,
  CommitGitChangesInput,
  CreateSavedWorkspaceInput,
  CreateGitBranchInput,
  FollowupResponse,
  ProviderAuthSession,
  ProviderOAuthCallback,
  ProviderSummary,
  PromptSettings,
  QuickStartProjectInput,
  RemoveProviderInput,
  RuntimeStatus,
  SavedWorkspaceDetail,
  SaveConversationLayoutInput,
  SendPromptInput,
  SessionSnapshot,
  TerminalCloseInput,
  TerminalErrorEvent,
  TerminalExitEvent,
  TerminalOpenInput,
  TerminalOutputEvent,
  TerminalResizeInput,
  TerminalSession,
  TerminalWriteInput,
  UpdateSavedWorkspaceLayoutInput,
  StartProviderAuthInput,
  UpdateForgeConfigInput,
  UpdatePromptSettingsInput,
} from "./types/contracts";

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

export function getRuntimeStatus(
  workspacePath?: string | null,
): Promise<RuntimeStatus> {
  return invokeCommand("get_runtime_status", {
    workspacePath: workspacePath ?? null,
  });
}

export function getSessionSnapshot(): Promise<SessionSnapshot> {
  return invokeCommand("get_session_snapshot");
}

export function getPromptSettings(
  workspacePath?: string | null,
): Promise<PromptSettings> {
  return invokeCommand("get_prompt_settings", {
    workspacePath: workspacePath ?? null,
  });
}

export function getForgeConfigFile(): Promise<ForgeConfigFile> {
  return invokeCommand("get_forge_config_file");
}

export function updateForgeConfigFile(
  input: UpdateForgeConfigInput,
): Promise<ForgeConfigFile> {
  return invokeCommand("update_forge_config_file", { input });
}

export function listProviders(
  workspacePath?: string | null,
): Promise<ProviderSummary[]> {
  return invokeCommand("list_providers", {
    workspacePath: workspacePath ?? null,
  });
}

export function selectConversation(
  workspacePath: string,
  conversationId: string,
): Promise<SessionSnapshot> {
  return invokeCommand("select_conversation", {
    workspacePath,
    conversationId,
  });
}

export function ensureConversationView(
  workspacePath: string,
  conversationId: string,
): Promise<SessionSnapshot> {
  return invokeCommand("ensure_conversation_view", {
    workspacePath,
    conversationId,
  });
}

export function startNewChat(workspacePath: string): Promise<SessionSnapshot> {
  return invokeCommand("start_new_chat", { workspacePath });
}

export function createManagedChat(): Promise<SessionSnapshot> {
  return invokeCommand("create_managed_chat");
}

export function handoffChat(input: HandoffChatInput): Promise<SessionSnapshot> {
  return invokeCommand("handoff_chat", { input });
}

export function sendPrompt(input: SendPromptInput): Promise<SessionSnapshot> {
  return invokeCommand("send_prompt", { input });
}

export function stopPrompt(input: ChatBinding): Promise<void> {
  return invokeCommand("stop_prompt", { input });
}

export function updatePromptSettings(
  input: UpdatePromptSettingsInput,
): Promise<PromptSettings> {
  return invokeCommand("update_prompt_settings", { input });
}

export function startProviderAuth(
  input: StartProviderAuthInput,
): Promise<ProviderAuthSession> {
  return invokeCommand("start_provider_auth", { input });
}

export function completeProviderAuth(
  input: CompleteProviderAuthInput,
): Promise<ProviderSummary> {
  return invokeCommand("complete_provider_auth", { input });
}

export function removeProvider(
  input: RemoveProviderInput,
): Promise<ProviderSummary> {
  return invokeCommand("remove_provider", { input });
}

export function respondFollowup(
  response: FollowupResponse,
): Promise<SessionSnapshot> {
  return invokeCommand("respond_followup", { response });
}

export function archiveConversation(
  workspacePath: string,
  conversationId: string,
): Promise<SessionSnapshot> {
  return invokeCommand("archive_conversation", {
    workspacePath,
    conversationId,
  });
}

export function archiveWorkspace(
  workspacePath: string,
): Promise<SessionSnapshot> {
  return invokeCommand("archive_workspace", { workspacePath });
}

export function renameWorkspace(
  workspacePath: string,
  displayName?: string | null,
): Promise<SessionSnapshot> {
  return invokeCommand("rename_workspace", {
    workspacePath,
    displayName: displayName ?? null,
  });
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

export function pushGitBranch(workspacePath: string): Promise<RuntimeStatus> {
  return invokeCommand("push_git_branch", { workspacePath });
}

export function openInTarget(
  workspacePath: string,
  targetId: string,
): Promise<void> {
  return invokeCommand("open_in_target", { workspacePath, targetId });
}

export function openPathInTarget(
  workspacePath: string,
  targetId: string,
  path: string,
): Promise<void> {
  return invokeCommand("open_path_in_target", { workspacePath, targetId, path });
}

export function openExternalUrl(url: string): Promise<void> {
  return invokeCommand("open_external_url", { url });
}

export function saveConversationLayout(
  input: SaveConversationLayoutInput,
): Promise<void> {
  return invokeCommand("save_conversation_layout", { input });
}

export function getConversationLayout(
  conversationId: string,
): Promise<string | null> {
  return invokeCommand("get_conversation_layout", { conversationId });
}

export function createSavedWorkspace(
  input: CreateSavedWorkspaceInput,
): Promise<SavedWorkspaceDetail> {
  return invokeCommand("create_saved_workspace", { input });
}

export function updateSavedWorkspaceLayout(
  input: UpdateSavedWorkspaceLayoutInput,
): Promise<SavedWorkspaceDetail> {
  return invokeCommand("update_saved_workspace_layout", { input });
}

export function getSavedWorkspace(
  workspaceId: string,
): Promise<SavedWorkspaceDetail | null> {
  return invokeCommand("get_saved_workspace", { workspaceId });
}

export function renameSavedWorkspace(
  workspaceId: string,
  name: string,
): Promise<SessionSnapshot> {
  return invokeCommand("rename_saved_workspace", { workspaceId, name });
}

export function deleteSavedWorkspace(
  workspaceId: string,
): Promise<SessionSnapshot> {
  return invokeCommand("delete_saved_workspace", { workspaceId });
}

export function openTerminal(
  input: TerminalOpenInput,
): Promise<TerminalSession> {
  return invokeCommand("terminal_open", { input });
}

export function writeTerminal(input: TerminalWriteInput): Promise<void> {
  return invokeCommand("terminal_write", { input });
}

export function resizeTerminal(input: TerminalResizeInput): Promise<void> {
  return invokeCommand("terminal_resize", { input });
}

export function closeTerminal(input: TerminalCloseInput): Promise<void> {
  return invokeCommand("terminal_close", { input });
}

export async function listenSessionUpdates(
  handler: (payload: SessionSnapshot) => void,
): Promise<UnlistenFn> {
  return listenEvent(SESSION_UPDATED_EVENT_NAME, handler);
}

export async function listenProviderOAuthCallback(
  handler: (payload: ProviderOAuthCallback) => void,
): Promise<UnlistenFn> {
  return listenEvent(PROVIDER_OAUTH_CALLBACK_EVENT_NAME, handler);
}

export async function listenTerminalOutput(
  terminalId: string,
  handler: (payload: TerminalOutputEvent) => void,
): Promise<UnlistenFn> {
  return listenEvent(
    TERMINAL_OUTPUT_EVENT_NAME,
    (payload: TerminalOutputEvent) => {
      if (payload.terminalId === terminalId) {
        handler(payload);
      }
    },
  );
}

export async function listenTerminalExit(
  terminalId: string,
  handler: (payload: TerminalExitEvent) => void,
): Promise<UnlistenFn> {
  return listenEvent(TERMINAL_EXIT_EVENT_NAME, (payload: TerminalExitEvent) => {
    if (payload.terminalId === terminalId) {
      handler(payload);
    }
  });
}

export async function listenTerminalErrors(
  terminalId: string,
  handler: (payload: TerminalErrorEvent) => void,
): Promise<UnlistenFn> {
  return listenEvent(
    TERMINAL_ERROR_EVENT_NAME,
    (payload: TerminalErrorEvent) => {
      if (payload.terminalId === terminalId) {
        handler(payload);
      }
    },
  );
}
