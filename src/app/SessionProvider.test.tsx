import { beforeEach, describe, expect, mock, test } from "bun:test";
import { useContext } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  PromptSettings,
  RuntimeStatus,
  SessionSnapshot,
} from "../services/desktop/contracts";

let ensureConversationViewCallCount = 0;
let getPromptSettingsCallCount = 0;
let getRuntimeStatusCallCount = 0;
let selectConversationCallCount = 0;

function createSnapshot(
  workspacePath: string,
  conversationId: string,
): SessionSnapshot {
  return {
    activeConversationId: conversationId,
    activeWorkspacePath: workspacePath,
    conversationViews: [
      {
        activeRequestIds: [],
        conversationId,
        followup: null,
        messages: [],
        todos: [],
        workspacePath,
      },
    ],
    savedWorkspaces: [{ id: "saved-1", name: "Workspace", updatedAt: 1n }],
    uiError: null,
    visibleActiveRequestIds: [],
    visibleFollowup: null,
    visibleMessages: [],
    visibleTodos: [],
    workspaces: [
      {
        configurationError: null,
        configured: true,
        conversations: [
          {
            conversationId,
            hasPendingFollowup: false,
            isDraft: false,
            isRunning: false,
            title: "Selected chat",
            updatedAt: "2026-04-21T00:00:00.000Z",
          },
        ],
        selectedConversationId: conversationId,
        workspaceName: "Agent UI",
        workspacePath,
      },
    ],
  };
}

const runtimeStatusFixture: RuntimeStatus = {
  availableOpenTargets: ["cursor"],
  configurationError: null,
  configured: true,
  gitBranchName: "main",
  gitBranches: ["main"],
  gitRepoName: "agent-ui",
  workspaceName: "Agent UI",
  workspacePath: "/workspace/agent-ui",
};

const promptSettingsFixture: PromptSettings = {
  availableModels: [],
  selectedModelId: "gpt-5.4",
  selectedProviderId: "openai",
  selectedReasoningEffort: "medium",
};

mock.module("../hooks/useSessionBootstrap", () => ({
  useSessionBootstrap: () => {},
}));

mock.module("../services/desktop/client", () => ({
  ensureConversationView: async () => {
    ensureConversationViewCallCount += 1;
    return createSnapshot("/workspace/unused", "unused");
  },
  getPromptSettings: async () => {
    getPromptSettingsCallCount += 1;
    return promptSettingsFixture;
  },
  getRuntimeStatus: async () => {
    getRuntimeStatusCallCount += 1;
    return runtimeStatusFixture;
  },
  selectConversation: async (workspacePath: string, conversationId: string) => {
    selectConversationCallCount += 1;
    return createSnapshot(workspacePath, conversationId);
  },
}));

const { SessionActionsContext } = await import("./SessionContext");
const { SessionProvider } = await import("./SessionProvider");
const { resetSessionStore, sessionStore } = await import("./sessionStore");

describe("SessionProvider", () => {
  beforeEach(() => {
    ensureConversationViewCallCount = 0;
    getPromptSettingsCallCount = 0;
    getRuntimeStatusCallCount = 0;
    selectConversationCallCount = 0;
    resetSessionStore();
  });

  test("selecting a sidebar chat does not add it to the active saved workspace", async () => {
    sessionStore.getState().setBoardSelection({
      activeChat: {
        conversationId: "chat-1",
        workspacePath: "/workspace/agent-ui",
      },
      kind: "saved-workspace",
      workspace: {
        id: "saved-1",
        layoutJson: "{\"grid\":true}",
        name: "Workspace",
        updatedAt: 1n,
      },
    });

    let capturedActions:
      | import("./SessionContext").SessionActionsContextValue
      | null = null;

    function CaptureActions() {
      capturedActions = useContext(SessionActionsContext);
      return null;
    }

    renderToStaticMarkup(
      <SessionProvider>
        <CaptureActions />
      </SessionProvider>,
    );

    if (capturedActions == null) {
      throw new Error("Expected session actions to be available");
    }

    const actions =
      capturedActions as import("./SessionContext").SessionActionsContextValue;

    await actions.selectConversation("/workspace/other", "chat-9");

    expect(selectConversationCallCount).toBe(1);
    expect(ensureConversationViewCallCount).toBe(0);
    expect(getPromptSettingsCallCount).toBeGreaterThan(0);
    expect(getRuntimeStatusCallCount).toBeGreaterThan(0);
    expect(sessionStore.getState().selection).toEqual({
      chat: {
        conversationId: "chat-9",
        workspacePath: "/workspace/other",
      },
      kind: "single-chat",
    });
  });
});
