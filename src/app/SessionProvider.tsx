import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import * as desktopClient from "../services/desktop/client";
import type {
  ChatBinding,
  PromptSettings,
  SessionSnapshot,
} from "../services/desktop/contracts";
import { useLatestRef } from "../hooks/useLatestRef";
import { usePromptDraftStore } from "../hooks/usePromptDraftStore";
import { useRuntimeStatus } from "../hooks/useRuntimeStatus";
import { useSessionBootstrap } from "../hooks/useSessionBootstrap";
import { useSessionCommands } from "../hooks/useSessionCommands";
import { extractBindingsFromLayoutJson } from "../components/workspace-board/layout";
import {
  ConversationStateContext,
  PromptDraftContext,
  type RequestTimingInfo,
  SessionActionsContext,
  SidebarStateContext,
  WorkspaceBoardContext,
  WorkspaceBoardSelectionContext,
  type WorkspaceBoardSelectionStore,
  type WorkspaceBoardSelection,
} from "./SessionContext";
import {
  getActiveConversation,
  getActiveWorkspace,
  getActiveWorkspaceLabel,
  LATEST_WORKSPACE_STORAGE_KEY,
  getPromptDraftKey,
} from "./sessionSnapshot";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionSnapshot, setSessionSnapshot] = useState<SessionSnapshot | null>(
    null,
  );
  const [promptSettings, setPromptSettings] = useState<PromptSettings | null>(
    null,
  );
  const [requestTimingsByConversationId, setRequestTimingsByConversationId] =
    useState<Record<string, Record<string, RequestTimingInfo>>>({});
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const sessionSnapshotRef = useLatestRef(sessionSnapshot);
  const [boardSelectionStore] = useState<WorkspaceBoardSelectionStore>(() =>
    createWorkspaceBoardSelectionStore({
      kind: "empty",
    }),
  );

  const applySessionSnapshot = useCallback((snapshot: SessionSnapshot) => {
    const nextViews =
      snapshot.conversationViews.length > 0
        ? snapshot.conversationViews
        : snapshot.activeConversationId != null && snapshot.activeWorkspacePath != null
          ? [
              {
                workspacePath: snapshot.activeWorkspacePath,
                conversationId: snapshot.activeConversationId,
                messages: snapshot.visibleMessages,
                activeRequestIds: snapshot.visibleActiveRequestIds,
                todos: snapshot.visibleTodos,
                followup: snapshot.visibleFollowup,
              },
            ]
          : [];

    if (nextViews.length > 0) {
      setRequestTimingsByConversationId((current) => {
        const now = Date.now();
        let changed = false;
        const nextState = { ...current };

        for (const view of nextViews) {
          const currentConversationTimings =
            current[view.conversationId] ?? {};
          const nextConversationTimings = { ...currentConversationTimings };
          const activeRequestIdSet = new Set(view.activeRequestIds ?? []);

          for (const requestId of view.activeRequestIds ?? []) {
            if (nextConversationTimings[requestId] == null) {
              nextConversationTimings[requestId] = {
                startedAtMs: now,
                completedAtMs: null,
              };
              changed = true;
            }
          }

          for (const [requestId, timing] of Object.entries(
            nextConversationTimings,
          )) {
            if (
              timing.completedAtMs == null &&
              !activeRequestIdSet.has(requestId)
            ) {
              nextConversationTimings[requestId] = {
                ...timing,
                completedAtMs: now,
              };
              changed = true;
            }
          }

          nextState[view.conversationId] = nextConversationTimings;
        }

        return changed ? nextState : current;
      });
    }

    setSessionSnapshot(snapshot);

    if (boardSelectionStore.getSelection().kind === "saved-workspace") {
      return;
    }

    if (
      snapshot.activeWorkspacePath != null &&
      snapshot.activeConversationId != null
    ) {
      boardSelectionStore.setSelection({
        kind: "single-chat",
        chat: {
          workspacePath: snapshot.activeWorkspacePath,
          conversationId: snapshot.activeConversationId,
        },
      });
      return;
    }

    if (snapshot.activeWorkspacePath != null) {
      boardSelectionStore.setSelection({
        kind: "workspace-draft",
        workspacePath: snapshot.activeWorkspacePath,
      });
      return;
    }

    boardSelectionStore.setSelection({ kind: "empty" });
  }, [boardSelectionStore]);

  const currentPromptDraftKey = getPromptDraftKey(
    sessionSnapshot?.activeWorkspacePath,
    sessionSnapshot?.activeConversationId,
  );
  const promptDraftStore = usePromptDraftStore(currentPromptDraftKey);

  const { refreshRuntimeStatus, runtimeStatus, setRuntimeStatus } =
    useRuntimeStatus(sessionSnapshot?.activeWorkspacePath ?? null);

  const baseActionState = useSessionCommands({
    promptDraftStore,
    setPromptSettings,
    refreshRuntimeStatus,
    sessionSnapshotRef,
    setIsOpeningProject,
    setRuntimeStatus,
    setSessionSnapshot: applySessionSnapshot,
  });

  const hasCurrentWorkspace = sessionSnapshot?.activeWorkspacePath != null;
  const activeConversationId = sessionSnapshot?.activeConversationId ?? null;
  const activeWorkspace = getActiveWorkspace(sessionSnapshot);
  const activeConversation = getActiveConversation(sessionSnapshot);
  const followupRequest = sessionSnapshot?.visibleFollowup ?? null;
  const activeWorkspaceConfigured =
    runtimeStatus?.configured ?? activeWorkspace?.configured ?? true;
  const activeWorkspaceConfigurationError =
    runtimeStatus?.configurationError ??
    activeWorkspace?.configurationError ??
    null;
  useSessionBootstrap({ setSessionSnapshot: applySessionSnapshot });

  useEffect(() => {
    if (sessionSnapshot?.activeWorkspacePath == null) {
      return;
    }

    window.localStorage.setItem(
      LATEST_WORKSPACE_STORAGE_KEY,
      sessionSnapshot.activeWorkspacePath,
    );
  }, [sessionSnapshot?.activeWorkspacePath]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (sessionSnapshot?.activeWorkspacePath == null) {
        if (cancelled === false) {
          setPromptSettings(null);
        }
        return;
      }

      try {
        const settings = await desktopClient.getPromptSettings(
          sessionSnapshot.activeWorkspacePath,
        );
        if (cancelled === false) {
          setPromptSettings(settings);
        }
      } catch {
        if (cancelled === false) {
          setPromptSettings(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionSnapshot?.activeWorkspacePath]);

  const getConversationView = useCallback(
    (binding: ChatBinding) =>
      sessionSnapshot?.conversationViews.find(
        (view) =>
          view.workspacePath === binding.workspacePath &&
          view.conversationId === binding.conversationId,
      ) ?? null,
    [sessionSnapshot?.conversationViews],
  );

  const getWorkspace = useCallback(
    (workspacePath: string) =>
      sessionSnapshot?.workspaces.find(
        (workspace) => workspace.workspacePath === workspacePath,
      ) ?? null,
    [sessionSnapshot?.workspaces],
  );

  const getConversationSummary = useCallback(
    (binding: ChatBinding) =>
      getWorkspace(binding.workspacePath)?.conversations.find(
        (conversation) => conversation.conversationId === binding.conversationId,
      ) ?? null,
    [getWorkspace],
  );

  const openSavedWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        const workspace = await desktopClient.getSavedWorkspace(workspaceId);
        if (workspace == null) {
          return;
        }

        const bindings = extractBindingsFromLayoutJson(workspace.layoutJson);
        boardSelectionStore.setSelection({
          kind: "saved-workspace",
          workspace,
          activeChat: bindings[0] ?? null,
        });
        let latestSnapshot: SessionSnapshot | null = null;

        for (const binding of bindings) {
          latestSnapshot = await desktopClient.ensureConversationView(
            binding.workspacePath,
            binding.conversationId,
          );
        }

        if (bindings[0] != null) {
          latestSnapshot = await desktopClient.selectConversation(
            bindings[0].workspacePath,
            bindings[0].conversationId,
          );
        }

        if (latestSnapshot != null) {
          applySessionSnapshot(latestSnapshot);
        }
      } catch {
        return;
      }
    },
    [applySessionSnapshot, boardSelectionStore],
  );

  const actionState = useMemo(
    () => ({
      ...baseActionState,
      openProject: async (workspacePath: string) => {
        boardSelectionStore.setSelection({ kind: "empty" });
        await baseActionState.openProject(workspacePath);
      },
      openSavedWorkspace,
      openWorkspacePicker: async () => {
        boardSelectionStore.setSelection({ kind: "empty" });
        return await baseActionState.openWorkspacePicker();
      },
      selectConversation: async (workspacePath: string, conversationId: string) => {
        boardSelectionStore.setSelection({
          kind: "single-chat",
          chat: { workspacePath, conversationId },
        });
        await baseActionState.selectConversation(workspacePath, conversationId);
      },
      startNewChat: async (workspacePath?: string) => {
        const targetWorkspacePath =
          workspacePath ?? sessionSnapshotRef.current?.activeWorkspacePath ?? null;
        if (targetWorkspacePath == null) {
          return null;
        }

        const snapshot = await baseActionState.startNewChat(targetWorkspacePath);
        if (
          snapshot == null ||
          snapshot.activeWorkspacePath !== targetWorkspacePath ||
          snapshot.activeConversationId != null
        ) {
          return snapshot;
        }

        boardSelectionStore.setSelection({
          kind: "workspace-draft",
          workspacePath: targetWorkspacePath,
        });
        return snapshot;
      },
    }),
    [baseActionState, boardSelectionStore, openSavedWorkspace, sessionSnapshotRef],
  );

  const canCompose =
    hasCurrentWorkspace &&
    activeWorkspaceConfigured &&
    followupRequest == null &&
    promptDraftStore.isSendingPrompt === false &&
    (activeConversation?.isRunning ?? false) === false;
  const requestTimingsById = useMemo(
    () =>
      activeConversationId == null
        ? {}
        : requestTimingsByConversationId[activeConversationId] ?? {},
    [activeConversationId, requestTimingsByConversationId],
  );

  const conversationState = useMemo(
    () => ({
      activeRequestIds: sessionSnapshot?.visibleActiveRequestIds ?? [],
      activeWorkspaceConfigurationError,
      activeWorkspaceConfigured,
      activeWorkspaceLabel: getActiveWorkspaceLabel(sessionSnapshot),
      hasCurrentWorkspace,
      isOpeningProject,
      messages: sessionSnapshot?.visibleMessages ?? [],
      requestTimingsById,
      runtimeStatus,
      todos: sessionSnapshot?.visibleTodos ?? [],
      uiError: sessionSnapshot?.uiError ?? null,
      workspacePath: sessionSnapshot?.activeWorkspacePath ?? null,
    }),
    [
      activeWorkspaceConfigurationError,
      activeWorkspaceConfigured,
      hasCurrentWorkspace,
      isOpeningProject,
      requestTimingsById,
      runtimeStatus,
      sessionSnapshot,
    ],
  );

  const sidebarState = useMemo(
    () => ({
      activeWorkspacePath: sessionSnapshot?.activeWorkspacePath ?? null,
      activeSavedWorkspaceId: null,
      hasCurrentWorkspace,
      savedWorkspaces: sessionSnapshot?.savedWorkspaces ?? [],
      workspaces: sessionSnapshot?.workspaces ?? [],
    }),
    [
      hasCurrentWorkspace,
      sessionSnapshot?.activeWorkspacePath,
      sessionSnapshot?.savedWorkspaces,
      sessionSnapshot?.workspaces,
    ],
  );

  const workspaceBoardState = useMemo(
    () => ({
      applySessionSnapshot,
      getConversationSummary,
      getConversationView,
      getWorkspace,
      isOpeningProject,
      requestTimingsByConversationId,
      sessionSnapshot,
    }),
    [
      applySessionSnapshot,
      getConversationSummary,
      getConversationView,
      getWorkspace,
      isOpeningProject,
      requestTimingsByConversationId,
      sessionSnapshot,
    ],
  );

  const workspaceBoardSelectionState = useMemo(
    () => boardSelectionStore,
    [boardSelectionStore],
  );

  const promptState = useMemo(
    () => ({
      canCompose,
      followupRequest,
      isSendingPrompt: promptDraftStore.isSendingPrompt,
      promptSettings,
      promptDraft: promptDraftStore.promptDraft,
      setPromptDraft: promptDraftStore.setPromptDraft,
    }),
    [
      canCompose,
      followupRequest,
      promptDraftStore.isSendingPrompt,
      promptSettings,
      promptDraftStore.promptDraft,
      promptDraftStore.setPromptDraft,
    ],
  );

  return (
    <SessionActionsContext.Provider value={actionState}>
      <WorkspaceBoardContext.Provider value={workspaceBoardState}>
        <WorkspaceBoardSelectionContext.Provider
          value={workspaceBoardSelectionState}
        >
          <ConversationStateContext.Provider value={conversationState}>
            <SidebarStateContext.Provider value={sidebarState}>
              <PromptDraftContext.Provider value={promptState}>
                {children}
              </PromptDraftContext.Provider>
            </SidebarStateContext.Provider>
          </ConversationStateContext.Provider>
        </WorkspaceBoardSelectionContext.Provider>
      </WorkspaceBoardContext.Provider>
    </SessionActionsContext.Provider>
  );
}

function createWorkspaceBoardSelectionStore(
  initialSelection: WorkspaceBoardSelection,
): WorkspaceBoardSelectionStore {
  let selection = initialSelection;
  const listeners = new Set<() => void>();

  return {
    getSelection: () => selection,
    setSelection: (nextSelection) => {
      if (selection === nextSelection) {
        return;
      }

      selection = nextSelection;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
