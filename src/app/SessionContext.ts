import { createContext } from "react";

import type {
  ChatBinding,
  ConversationSessionSummary,
  ConversationViewSnapshot,
  FollowupRequest,
  PromptSettings,
  RuntimeStatus,
  SavedWorkspaceDetail,
  SavedWorkspaceSummary,
  SessionSnapshot,
  TranscriptMessage,
  WorkspaceSession,
} from "../services/desktop/contracts";

export interface RequestTimingInfo {
  completedAtMs: number | null;
  startedAtMs: number;
}

export interface ConversationStateContextValue {
  activeRequestIds: string[];
  activeWorkspaceConfigurationError: string | null;
  activeWorkspaceConfigured: boolean;
  activeWorkspaceLabel: string;
  hasCurrentWorkspace: boolean;
  isOpeningProject: boolean;
  messages: TranscriptMessage[];
  requestTimingsById: Record<string, RequestTimingInfo>;
  runtimeStatus: RuntimeStatus | null;
  uiError: string | null;
  workspacePath: string | null;
}

export interface SidebarStateContextValue {
  activeWorkspacePath: string | null;
  activeSavedWorkspaceId: string | null;
  hasCurrentWorkspace: boolean;
  savedWorkspaces: SavedWorkspaceSummary[];
  workspaces: WorkspaceSession[];
}

export interface PromptDraftContextValue {
  canCompose: boolean;
  followupRequest: FollowupRequest | null;
  isSendingPrompt: boolean;
  promptSettings: PromptSettings | null;
  promptDraft: string;
  setPromptDraft: (value: string) => void;
}

export interface SessionActionsContextValue {
  openWorkspacePicker: () => Promise<string | null>;
  openProject: (workspacePath: string) => Promise<void>;
  openSavedWorkspace: (workspaceId: string) => Promise<void>;
  selectConversation: (
    workspacePath: string,
    conversationId: string,
  ) => Promise<void>;
  startNewChat: (workspacePath?: string) => Promise<SessionSnapshot | null>;
  checkoutBranch: (branchName: string) => Promise<void>;
  createBranch: (branchName: string) => Promise<void>;
  commitChanges: (message: string) => Promise<void>;
  pushBranch: () => Promise<void>;
  openInTarget: (targetId: string) => Promise<void>;
  updatePromptSettings: (input: {
    providerId: string;
    modelId: string;
    reasoningEffort?: string | null;
  }) => Promise<void>;
  submitPrompt: () => Promise<void>;
  submitFollowup: (input: {
    cancelled: boolean;
    text?: string;
    selectedOptionIds?: string[];
  }) => Promise<void>;
}

export type WorkspaceBoardSelection =
  | { kind: "empty" }
  | { kind: "single-chat"; chat: ChatBinding }
  | { kind: "workspace-draft"; workspacePath: string }
  | { kind: "saved-workspace"; workspace: SavedWorkspaceDetail };

export interface WorkspaceBoardContextValue {
  applySessionSnapshot: (snapshot: SessionSnapshot) => void;
  getConversationSummary: (
    binding: ChatBinding,
  ) => ConversationSessionSummary | null;
  getConversationView: (binding: ChatBinding) => ConversationViewSnapshot | null;
  getWorkspace: (workspacePath: string) => WorkspaceSession | null;
  isOpeningProject: boolean;
  requestTimingsByConversationId: Record<
    string,
    Record<string, RequestTimingInfo>
  >;
  selection: WorkspaceBoardSelection;
  sessionSnapshot: SessionSnapshot | null;
  setSelection: (selection: WorkspaceBoardSelection) => void;
}

export const ConversationStateContext =
  createContext<ConversationStateContextValue | null>(null);

export const SidebarStateContext =
  createContext<SidebarStateContextValue | null>(null);

export const PromptDraftContext = createContext<PromptDraftContextValue | null>(
  null,
);

export const SessionActionsContext =
  createContext<SessionActionsContextValue | null>(null);

export const WorkspaceBoardContext =
  createContext<WorkspaceBoardContextValue | null>(null);
