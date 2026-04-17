import { createContext } from "react";

import type {
  FollowupRequest,
  RuntimeStatus,
  TranscriptMessage,
} from "../services/desktop/contracts";
import type { ProjectSummary } from "./sessionSelectors";

export interface ConversationStateContextValue {
  activeWorkspaceLabel: string;
  hasCurrentWorkspace: boolean;
  isOpeningProject: boolean;
  messages: TranscriptMessage[];
  runtimeStatus: RuntimeStatus | null;
  uiError: string | null;
}

export interface SidebarStateContextValue {
  hasCurrentWorkspace: boolean;
  isOpeningProject: boolean;
  projectSummaries: ProjectSummary[];
}

export interface PromptDraftContextValue {
  canCompose: boolean;
  followupRequest: FollowupRequest | null;
  isSendingPrompt: boolean;
  promptDraft: string;
  setPromptDraft: (value: string) => void;
}

export interface SessionActionsContextValue {
  openWorkspacePicker: () => Promise<string | null>;
  openProject: (workspacePath: string) => Promise<void>;
  selectConversation: (
    workspacePath: string,
    conversationId: string,
  ) => Promise<void>;
  startNewChat: (workspacePath?: string) => Promise<void>;
  checkoutBranch: (branchName: string) => Promise<void>;
  createBranch: (branchName: string) => Promise<void>;
  commitChanges: (message: string) => Promise<void>;
  pushBranch: () => Promise<void>;
  openInTarget: (targetId: string) => Promise<void>;
  submitPrompt: () => Promise<void>;
  submitFollowup: (input: {
    cancelled: boolean;
    text?: string;
    selectedOptionIds?: string[];
  }) => Promise<void>;
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
