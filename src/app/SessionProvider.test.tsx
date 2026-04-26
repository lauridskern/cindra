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
let createManagedChatCallCount = 0;
let handoffChatCallCount = 0;
let openWorkspaceCallCount = 0;
let renameWorkspaceCallCount = 0;
let renameSavedWorkspaceCallCount = 0;
let selectConversationCallCount = 0;
let stopPromptCallCount = 0;
let createManagedChatImpl: () => Promise<SessionSnapshot>;
let handoffChatImpl: (
  input: import("../services/desktop/contracts").HandoffChatInput,
) => Promise<SessionSnapshot>;
let openWorkspaceImpl: (workspacePath: string) => Promise<SessionSnapshot>;
let renameWorkspaceImpl: (
  workspacePath: string,
  displayName: string | null,
) => Promise<SessionSnapshot>;
let renameSavedWorkspaceImpl: (
  workspaceId: string,
  name: string,
) => Promise<SessionSnapshot>;
let lastStopPromptInput:
  | import("../services/desktop/contracts").ChatBinding
  | null = null;

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function createSnapshot(
  workspacePath: string,
  conversationId: string,
  overrides: Partial<SessionSnapshot> = {},
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
        kind: "project",
        selectedConversationId: conversationId,
        workspaceName: "Agent UI",
        workspacePath,
      },
    ],
    ...overrides,
  };
}

const runtimeStatusFixture: RuntimeStatus = {
  availableOpenTargets: ["cursor"],
  configurationError: null,
  configured: true,
  gitBranchName: "main",
  gitBranches: ["main"],
  gitMainWorkspacePath: "/workspace/agent-ui",
  gitRepoName: "agent-ui",
  gitWorkspaceKind: "local",
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
  renameWorkspace: async (workspacePath: string, displayName: string | null) => {
    renameWorkspaceCallCount += 1;
    return await renameWorkspaceImpl(workspacePath, displayName);
  },
  renameSavedWorkspace: async (workspaceId: string, name: string) => {
    renameSavedWorkspaceCallCount += 1;
    return await renameSavedWorkspaceImpl(workspaceId, name);
  },
  createManagedChat: async () => {
    createManagedChatCallCount += 1;
    return await createManagedChatImpl();
  },
  handoffChat: async (
    input: import("../services/desktop/contracts").HandoffChatInput,
  ) => {
    handoffChatCallCount += 1;
    return await handoffChatImpl(input);
  },
  openWorkspace: async (workspacePath: string) => {
    openWorkspaceCallCount += 1;
    return await openWorkspaceImpl(workspacePath);
  },
  selectConversation: async (workspacePath: string, conversationId: string) => {
    selectConversationCallCount += 1;
    return createSnapshot(workspacePath, conversationId);
  },
  stopPrompt: async (
    input: import("../services/desktop/contracts").ChatBinding,
  ) => {
    stopPromptCallCount += 1;
    lastStopPromptInput = input;
  },
}));

const { SessionActionsContext } = await import("./SessionContext");
const { SessionProvider } = await import("./SessionProvider");
const { getPromptDraftKey } = await import("./sessionSnapshot");
const { resetSessionStore, sessionStore } = await import("./sessionStore");

describe("SessionProvider", () => {
  beforeEach(() => {
    ensureConversationViewCallCount = 0;
    getPromptSettingsCallCount = 0;
    getRuntimeStatusCallCount = 0;
    createManagedChatCallCount = 0;
    handoffChatCallCount = 0;
    openWorkspaceCallCount = 0;
    renameWorkspaceCallCount = 0;
    renameSavedWorkspaceCallCount = 0;
    selectConversationCallCount = 0;
    stopPromptCallCount = 0;
    lastStopPromptInput = null;
    createManagedChatImpl = async () =>
      createSnapshot("/workspace/managed-chat", "chat-1", {
        activeConversationId: null,
        conversationViews: [],
        workspaces: [
          {
            configurationError: null,
            configured: true,
            conversations: [],
            kind: "managed_chat",
            selectedConversationId: null,
            workspaceName: "New chat",
            workspacePath: "/workspace/managed-chat",
          },
        ],
      });
    handoffChatImpl = async (input) =>
      createSnapshot(
        input.target === "worktree"
          ? "/workspace/agent-ui-worktree"
          : "/workspace/agent-ui",
        input.conversationId ?? "chat-1",
        {
          activeConversationId: input.conversationId,
          activeWorkspacePath:
            input.target === "worktree"
              ? "/workspace/agent-ui-worktree"
              : "/workspace/agent-ui",
          conversationViews:
            input.conversationId == null
              ? []
              : [
                  {
                    activeRequestIds: [],
                    conversationId: input.conversationId,
                    followup: null,
                    messages: [],
                    todos: [],
                    workspacePath:
                      input.target === "worktree"
                        ? "/workspace/agent-ui-worktree"
                        : "/workspace/agent-ui",
                  },
                ],
          workspaces: [
            {
              configurationError: null,
              configured: true,
              conversations:
                input.conversationId == null
                  ? []
                  : [
                      {
                        conversationId: input.conversationId,
                        hasPendingFollowup: false,
                        isDraft: false,
                        isRunning: false,
                        title: "Selected chat",
                        updatedAt: "2026-04-21T00:00:00.000Z",
                      },
                    ],
              kind: "project",
              selectedConversationId: input.conversationId,
              workspaceName:
                input.target === "worktree" ? "Agent UI Worktree" : "Agent UI",
              workspacePath:
                input.target === "worktree"
                  ? "/workspace/agent-ui-worktree"
                  : "/workspace/agent-ui",
            },
          ],
        },
      );
    openWorkspaceImpl = async (workspacePath: string) =>
      createSnapshot(workspacePath, "chat-1");
    renameWorkspaceImpl = async (
      workspacePath: string,
      displayName: string | null,
    ) =>
      createSnapshot(workspacePath, "chat-1", {
        workspaces: [
          {
            configurationError: null,
            configured: true,
            conversations: [
              {
                conversationId: "chat-1",
                hasPendingFollowup: false,
                isDraft: false,
                isRunning: false,
                title: "Selected chat",
                updatedAt: "2026-04-21T00:00:00.000Z",
              },
            ],
            kind: "project",
            selectedConversationId: "chat-1",
            workspaceName: displayName ?? "agent-ui",
            workspacePath,
          },
        ],
      });
    renameSavedWorkspaceImpl = async (workspaceId: string, name: string) =>
      createSnapshot("/workspace/agent-ui", "chat-1", {
        savedWorkspaces: [{ id: workspaceId, name, updatedAt: 2n }],
      });
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

  test("stopPrompt targets the active binding", async () => {
    sessionStore.getState().setBoardSelection({
      chat: {
        conversationId: "chat-7",
        workspacePath: "/workspace/agent-ui",
      },
      kind: "single-chat",
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

    await actions.stopPrompt();

    expect(stopPromptCallCount).toBe(1);
    expect(lastStopPromptInput).toEqual({
      conversationId: "chat-7",
      workspacePath: "/workspace/agent-ui",
    });
  });

  test("opening a project keeps the current selection until the snapshot resolves", async () => {
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

    const workspaceRequest = deferred<SessionSnapshot>();
    openWorkspaceImpl = async () => await workspaceRequest.promise;

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
    const openProjectPromise = actions.openProject("/workspace/other");

    expect(openWorkspaceCallCount).toBe(1);
    expect(sessionStore.getState().selection).toEqual({
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

    workspaceRequest.resolve(createSnapshot("/workspace/other", "chat-7"));
    await openProjectPromise;

    expect(sessionStore.getState().selection).toEqual({
      chat: {
        conversationId: "chat-7",
        workspacePath: "/workspace/other",
      },
      kind: "single-chat",
    });
  });

  test("starting a sidebar chat without a project creates a managed chat workspace", async () => {
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

    await actions.startNewChat();

    expect(createManagedChatCallCount).toBe(1);
    expect(openWorkspaceCallCount).toBe(0);
    expect(selectConversationCallCount).toBe(0);
    expect(sessionStore.getState().selection).toEqual({
      kind: "workspace-draft",
      workspacePath: "/workspace/managed-chat",
    });
  });

  test("starting a sidebar chat reuses an existing empty managed chat draft", async () => {
    sessionStore.getState().applySessionSnapshot(
      createSnapshot("/workspace/agent-ui", "chat-1", {
        workspaces: [
          {
            configurationError: null,
            configured: true,
            conversations: [],
            kind: "managed_chat",
            selectedConversationId: null,
            workspaceName: "New chat",
            workspacePath: "/workspace/managed-chat",
          },
          {
            configurationError: null,
            configured: true,
            conversations: [
              {
                conversationId: "chat-1",
                hasPendingFollowup: false,
                isDraft: false,
                isRunning: false,
                title: "Selected chat",
                updatedAt: "2026-04-21T00:00:00.000Z",
              },
            ],
            kind: "project",
            selectedConversationId: "chat-1",
            workspaceName: "Agent UI",
            workspacePath: "/workspace/agent-ui",
          },
        ],
      }),
    );
    openWorkspaceImpl = async () =>
      createSnapshot("/workspace/managed-chat", "unused", {
        activeConversationId: null,
        activeWorkspacePath: "/workspace/managed-chat",
        conversationViews: [],
        workspaces: [
          {
            configurationError: null,
            configured: true,
            conversations: [],
            kind: "managed_chat",
            selectedConversationId: null,
            workspaceName: "New chat",
            workspacePath: "/workspace/managed-chat",
          },
        ],
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

    await actions.startNewChat();

    expect(createManagedChatCallCount).toBe(0);
    expect(openWorkspaceCallCount).toBe(1);
    expect(sessionStore.getState().selection).toEqual({
      kind: "workspace-draft",
      workspacePath: "/workspace/managed-chat",
    });
  });

  test("handoffing a chat updates the active selection to the target workspace", async () => {
    sessionStore.getState().applySessionSnapshot(
      createSnapshot("/workspace/agent-ui", "chat-1"),
    );

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

    await actions.handoffChat({
      branchName: "feature/worktree",
      conversationId: "chat-1",
      sourceWorkspacePath: "/workspace/agent-ui",
      target: "worktree",
    });

    expect(handoffChatCallCount).toBe(1);
    expect(sessionStore.getState().selection).toEqual({
      chat: {
        conversationId: "chat-1",
        workspacePath: "/workspace/agent-ui-worktree",
      },
      kind: "single-chat",
    });
  });

  test("handoffing a draft chat moves the prompt draft to the target workspace", async () => {
    const sourceDraftKey = getPromptDraftKey("/workspace/agent-ui", null);
    if (sourceDraftKey == null) {
      throw new Error("Expected a prompt draft key");
    }

    sessionStore.getState().setPromptDraftValue(sourceDraftKey, "Investigate the bug");

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

    await actions.handoffChat({
      branchName: "feature/draft-handoff",
      conversationId: null,
      sourceWorkspacePath: "/workspace/agent-ui",
      target: "worktree",
    });

    const targetDraftKey = getPromptDraftKey("/workspace/agent-ui-worktree", null);
    expect(targetDraftKey).not.toBeNull();
    expect(sessionStore.getState().promptDraftsByKey[sourceDraftKey]).toBeUndefined();
    expect(
      sessionStore.getState().promptDraftsByKey[targetDraftKey as string]?.value,
    ).toBe("Investigate the bug");
  });

  test("renaming a project updates the workspace label in session state", async () => {
    sessionStore.getState().applySessionSnapshot(
      createSnapshot("/workspace/agent-ui", "chat-1"),
    );

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

    await actions.renameWorkspace("/workspace/agent-ui", "Renamed UI");

    expect(renameWorkspaceCallCount).toBe(1);
    expect(sessionStore.getState().workspacesByPath["/workspace/agent-ui"]?.workspaceName).toBe(
      "Renamed UI",
    );
    expect(sessionStore.getState().selection).toEqual({
      chat: {
        conversationId: "chat-1",
        workspacePath: "/workspace/agent-ui",
      },
      kind: "single-chat",
    });
  });

  test("renaming a saved workspace updates the saved workspace selection", async () => {
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
    sessionStore.getState().applySessionSnapshot(
      createSnapshot("/workspace/agent-ui", "chat-1"),
    );

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

    await actions.renameSavedWorkspace("saved-1", "Renamed workspace");

    expect(renameSavedWorkspaceCallCount).toBe(1);
    expect(sessionStore.getState().savedWorkspaces).toEqual([
      { id: "saved-1", name: "Renamed workspace", updatedAt: 2n },
    ]);
    expect(sessionStore.getState().selection).toEqual({
      activeChat: {
        conversationId: "chat-1",
        workspacePath: "/workspace/agent-ui",
      },
      kind: "saved-workspace",
      workspace: {
        id: "saved-1",
        layoutJson: "{\"grid\":true}",
        name: "Renamed workspace",
        updatedAt: 2n,
      },
    });
  });
});
