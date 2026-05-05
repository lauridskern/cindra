import { beforeEach, describe, expect, mock, test } from "bun:test";

import type {
  PromptSettings,
  RuntimeStatus,
  SessionSnapshot,
} from "../services/desktop/types/contracts";

let runtimeStatusCallCount = 0;
let promptSettingsCallCount = 0;
let conversationViewCallCount = 0;
let runtimeStatusImpl: (workspacePath: string | null) => Promise<RuntimeStatus | null>;
let promptSettingsImpl: (
  workspacePath: string | null,
) => Promise<PromptSettings | null>;
let conversationViewImpl: (
  workspacePath: string,
  conversationId: string,
) => Promise<SessionSnapshot>;

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

const runtimeStatusFixture: RuntimeStatus = {
  availableOpenTargets: ["cursor"],
  configurationError: null,
  configured: true,
  gitBranchName: "main",
  gitBranches: ["main", "feature/zustand"],
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

function createSnapshot(
  overrides: Partial<SessionSnapshot> = {},
): SessionSnapshot {
  return {
    activeConversationId: "chat-1",
    activeWorkspacePath: "/workspace/agent-ui",
    conversationViews: [
      {
        activeRequestIds: [],
        conversationId: "chat-1",
        followup: null,
        messages: [],
        todos: [],
        workspacePath: "/workspace/agent-ui",
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
            conversationId: "chat-1",
            hasPendingFollowup: false,
            isDraft: false,
            isRunning: false,
            title: "Chat 1",
            updatedAt: "2026-04-21T00:00:00.000Z",
          },
        ],
        kind: "project",
        selectedConversationId: "chat-1",
        workspaceName: "Agent UI",
        workspacePath: "/workspace/agent-ui",
      },
    ],
    ...overrides,
  };
}

mock.module("../services/desktop/client", () => ({
  ensureConversationView: async (workspacePath: string, conversationId: string) => {
    conversationViewCallCount += 1;
    return await conversationViewImpl(workspacePath, conversationId);
  },
  getPromptSettings: async (workspacePath: string | null) => {
    promptSettingsCallCount += 1;
    return await promptSettingsImpl(workspacePath);
  },
  getRuntimeStatus: async (workspacePath: string | null) => {
    runtimeStatusCallCount += 1;
    return await runtimeStatusImpl(workspacePath);
  },
}));

const {
  ensureConversationViewLoaded,
  ensureWorkspacePromptSettingsLoaded,
  ensureWorkspaceRuntimeStatusLoaded,
  getPromptDraftState,
  getWorkspaceMetaState,
  resetSessionStore,
  sessionStore,
} = await import("./sessionStore");

describe("sessionStore", () => {
  beforeEach(() => {
    conversationViewCallCount = 0;
    runtimeStatusCallCount = 0;
    promptSettingsCallCount = 0;
    conversationViewImpl = async () => createSnapshot();
    runtimeStatusImpl = async () => runtimeStatusFixture;
    promptSettingsImpl = async () => promptSettingsFixture;
    resetSessionStore();
  });

  test("applySessionSnapshot derives views and request timings", () => {
    sessionStore.getState().applySessionSnapshot(
      createSnapshot({
        conversationViews: [],
        visibleActiveRequestIds: ["req-1"],
      }),
    );

    const afterStart = sessionStore.getState();
    const startedView =
      afterStart.conversationViewsByKey["/workspace/agent-ui::chat-1"];
    const startedTiming =
      afterStart.requestTimingsByConversationId["chat-1"]?.["req-1"];

    expect(startedView?.activeRequestIds).toEqual(["req-1"]);
    expect(typeof startedTiming?.startedAtMs).toBe("number");
    expect(startedTiming?.completedAtMs).toBeNull();

    sessionStore.getState().applySessionSnapshot(
      createSnapshot({
        conversationViews: [],
        visibleActiveRequestIds: [],
      }),
    );

    const completedTiming =
      sessionStore.getState().requestTimingsByConversationId["chat-1"]?.["req-1"];
    expect(typeof completedTiming?.completedAtMs).toBe("number");
    expect((completedTiming?.completedAtMs ?? 0) >= startedTiming!.startedAtMs).toBe(
      true,
    );
  });

  test("applySessionSnapshot preserves saved workspace selection", () => {
    sessionStore.getState().setBoardSelection({
      activeChat: {
        conversationId: "chat-2",
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
      createSnapshot({
        activeConversationId: "chat-1",
      }),
    );

    expect(sessionStore.getState().selection).toEqual({
      activeChat: {
        conversationId: "chat-2",
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
  });

  test("applySessionSnapshot refreshes saved workspace metadata", () => {
    sessionStore.getState().setBoardSelection({
      activeChat: {
        conversationId: "chat-2",
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
      createSnapshot({
        savedWorkspaces: [{ id: "saved-1", name: "Renamed workspace", updatedAt: 2n }],
      }),
    );

    expect(sessionStore.getState().selection).toEqual({
      activeChat: {
        conversationId: "chat-2",
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

  test("prompt drafts move and clear without leaving stale entries", () => {
    const sourceKey = "/workspace/agent-ui::chat-1";
    const destinationKey = "/workspace/agent-ui::chat-2";

    sessionStore.getState().setPromptDraftValue(sourceKey, "ship it");
    sessionStore.getState().setPromptDraftPlanningMode(sourceKey, true);
    sessionStore.getState().movePromptDraft(sourceKey, destinationKey);

    expect(getPromptDraftState(sourceKey)).toEqual({
      isPending: false,
      isPlanningMode: false,
      value: "",
    });
    expect(getPromptDraftState(destinationKey)).toEqual({
      isPending: false,
      isPlanningMode: true,
      value: "ship it",
    });

    sessionStore.getState().clearPromptDraft(destinationKey);

    expect(getPromptDraftState(destinationKey)).toEqual({
      isPending: false,
      isPlanningMode: true,
      value: "",
    });

    sessionStore.getState().setPromptDraftPlanningMode(destinationKey, false);

    expect(getPromptDraftState(destinationKey)).toEqual({
      isPending: false,
      isPlanningMode: false,
      value: "",
    });
    expect(sessionStore.getState().promptDraftsByKey[destinationKey]).toBeUndefined();
  });

  test("prompt queue entries can be reordered, deleted, and edited into the draft", () => {
    const key = "/workspace/agent-ui::chat-1";

    sessionStore
      .getState()
      .enqueuePrompt(key, { isPlanningMode: false, value: "first" });
    sessionStore
      .getState()
      .enqueuePrompt(key, { isPlanningMode: true, value: "second" });
    sessionStore
      .getState()
      .enqueuePrompt(key, { isPlanningMode: false, value: "third" });

    const [first, second, third] = sessionStore.getState().promptQueuesByKey[key];
    expect([first.value, second.value, third.value]).toEqual([
      "first",
      "second",
      "third",
    ]);

    sessionStore.getState().reorderQueuedPrompt(key, third.id, first.id);
    expect(
      sessionStore.getState().promptQueuesByKey[key].map((entry) => entry.value),
    ).toEqual(["third", "first", "second"]);

    sessionStore.getState().deleteQueuedPrompt(key, second.id);
    expect(
      sessionStore.getState().promptQueuesByKey[key].map((entry) => entry.value),
    ).toEqual(["third", "first"]);

    sessionStore.getState().setPromptDraftValue(key, "replace me");
    sessionStore.getState().editQueuedPrompt(key, third.id);

    expect(getPromptDraftState(key)).toEqual({
      editingQueuedPromptId: third.id,
      isPending: false,
      isPlanningMode: false,
      value: "third",
    });
    expect(
      sessionStore.getState().promptQueuesByKey[key].map((entry) => entry.value),
    ).toEqual(["first"]);
  });

  test("editing another queued prompt restores the current queued edit", () => {
    const key = "/workspace/agent-ui::chat-1";

    sessionStore
      .getState()
      .enqueuePrompt(key, { isPlanningMode: false, value: "first" });
    sessionStore
      .getState()
      .enqueuePrompt(key, { isPlanningMode: true, value: "second" });
    sessionStore
      .getState()
      .enqueuePrompt(key, { isPlanningMode: false, value: "third" });

    const [first, second, third] = sessionStore.getState().promptQueuesByKey[key];
    sessionStore.getState().editQueuedPrompt(key, first.id);
    sessionStore.getState().setPromptDraftValue(key, "edited first");
    sessionStore.getState().editQueuedPrompt(key, second.id);

    expect(getPromptDraftState(key)).toEqual({
      editingQueuedPromptId: second.id,
      isPending: false,
      isPlanningMode: true,
      value: "second",
    });
    expect(sessionStore.getState().promptQueuesByKey[key]).toEqual([
      {
        id: first.id,
        isPlanningMode: false,
        value: "edited first",
      },
      third,
    ]);
  });

  test("workspace meta loaders dedupe concurrent runtime requests and cache prompt settings", async () => {
    const pendingRuntimeStatus = deferred<RuntimeStatus | null>();
    runtimeStatusImpl = async () => pendingRuntimeStatus.promise;

    const runtimeStatusRequestA = ensureWorkspaceRuntimeStatusLoaded(
      "/workspace/agent-ui",
    );
    const runtimeStatusRequestB = ensureWorkspaceRuntimeStatusLoaded(
      "/workspace/agent-ui",
    );

    expect(runtimeStatusCallCount).toBe(1);

    pendingRuntimeStatus.resolve(runtimeStatusFixture);

    expect(await runtimeStatusRequestA).toEqual(runtimeStatusFixture);
    expect(await runtimeStatusRequestB).toEqual(runtimeStatusFixture);
    expect(getWorkspaceMetaState("/workspace/agent-ui").runtimeStatusLoaded).toBe(
      true,
    );

    await ensureWorkspacePromptSettingsLoaded("/workspace/agent-ui");
    await ensureWorkspacePromptSettingsLoaded("/workspace/agent-ui");

    expect(promptSettingsCallCount).toBe(1);
    expect(
      getWorkspaceMetaState("/workspace/agent-ui").promptSettings,
    ).toEqual(promptSettingsFixture);
  });

  test("conversation view loader dedupes concurrent requests", async () => {
    const pendingConversationView = deferred<SessionSnapshot>();
    conversationViewImpl = async () => pendingConversationView.promise;

    const binding = {
      conversationId: "chat-2",
      workspacePath: "/workspace/agent-ui",
    };

    const requestA = ensureConversationViewLoaded(binding);
    const requestB = ensureConversationViewLoaded(binding);

    expect(conversationViewCallCount).toBe(1);

    pendingConversationView.resolve(
      createSnapshot({
        activeConversationId: "chat-2",
        conversationViews: [
          {
            activeRequestIds: [],
            conversationId: "chat-2",
            followup: null,
            messages: [],
            todos: [],
            workspacePath: "/workspace/agent-ui",
          },
        ],
        visibleActiveRequestIds: [],
        workspaces: [
          {
            configurationError: null,
            configured: true,
            conversations: [
              {
                conversationId: "chat-2",
                hasPendingFollowup: false,
                isDraft: false,
                isRunning: false,
                title: "Chat 2",
                updatedAt: "2026-04-21T00:00:00.000Z",
              },
            ],
            kind: "project",
            selectedConversationId: "chat-2",
            workspaceName: "Agent UI",
            workspacePath: "/workspace/agent-ui",
          },
        ],
      }),
    );

    expect(await requestA).toEqual({
      activeRequestIds: [],
      conversationId: "chat-2",
      followup: null,
      messages: [],
      todos: [],
      workspacePath: "/workspace/agent-ui",
    });
    expect(await requestB).toEqual({
      activeRequestIds: [],
      conversationId: "chat-2",
      followup: null,
      messages: [],
      todos: [],
      workspacePath: "/workspace/agent-ui",
    });
  });
});
