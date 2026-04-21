import { createContext } from "react";

import type {
  ChatBinding,
  SavedWorkspaceDetail,
  SessionSnapshot,
} from "../services/desktop/contracts";

export interface RequestTimingInfo {
  completedAtMs: number | null;
  startedAtMs: number;
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
  | { kind: "demo-chat" }
  | { kind: "single-chat"; chat: ChatBinding }
  | { kind: "workspace-draft"; workspacePath: string }
  | {
      kind: "saved-workspace";
      workspace: SavedWorkspaceDetail;
      activeChat: ChatBinding | null;
    };

export const SessionActionsContext =
  createContext<SessionActionsContextValue | null>(null);
