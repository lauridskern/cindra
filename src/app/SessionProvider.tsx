import { useEffect, useRef, useState, type ReactNode } from "react";

import * as desktopClient from "../services/desktop/client";
import type {
  ChatBinding,
  SessionSnapshot,
} from "../services/desktop/contracts";
import { useLatestRef } from "../hooks/useLatestRef";
import { usePromptDraftStore } from "../hooks/usePromptDraftStore";
import { usePromptSettings } from "../hooks/usePromptSettings";
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
  type WorkspaceBoardSelection,
} from "./SessionContext";
import {
  getActiveConversation,
  getActiveWorkspace,
  getActiveWorkspaceLabel,
  LATEST_WORKSPACE_STORAGE_KEY,
  getPromptDraftKey,
} from "./sessionSnapshot";

async function loadSavedWorkspaceState(workspaceId: string): Promise<{
  latestSnapshot: SessionSnapshot | null;
  workspace: NonNullable<
    Awaited<ReturnType<typeof desktopClient.getSavedWorkspace>>
  >;
} | null> {
  const workspace = await desktopClient
    .getSavedWorkspace(workspaceId)
    .catch(() => null);
  if (workspace == null) {
    return null;
  }

  const bindings = extractBindingsFromLayoutJson(workspace.layoutJson);
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

  return { latestSnapshot, workspace };
}

function useSessionProviderState() {
  const [sessionSnapshot, setSessionSnapshot] =
    useState<SessionSnapshot | null>(null);
  const [requestTimingsByConversationId, setRequestTimingsByConversationId] =
    useState<Record<string, Record<string, RequestTimingInfo>>>({});
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [boardSelectionState, setBoardSelectionState] =
    useState<WorkspaceBoardSelection>({ kind: "empty" });
  const sessionSnapshotRef = useLatestRef(sessionSnapshot);
  const boardSelectionRef = useRef<WorkspaceBoardSelection>({ kind: "empty" });

  function setBoardSelection(selection: WorkspaceBoardSelection) {
    boardSelectionRef.current = selection;
    setBoardSelectionState(selection);
  }
  const boardSelection = boardSelectionState;

  function applySessionSnapshot(snapshot: SessionSnapshot) {
    const nextViews =
      snapshot.conversationViews.length > 0
        ? snapshot.conversationViews
        : snapshot.activeConversationId != null &&
            snapshot.activeWorkspacePath != null
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
          const currentConversationTimings = current[view.conversationId] ?? {};
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

    if (boardSelectionRef.current.kind === "saved-workspace") {
      return;
    }

    if (
      snapshot.activeWorkspacePath != null &&
      snapshot.activeConversationId != null
    ) {
      setBoardSelection({
        kind: "single-chat",
        chat: {
          workspacePath: snapshot.activeWorkspacePath,
          conversationId: snapshot.activeConversationId,
        },
      });
      return;
    }

    if (snapshot.activeWorkspacePath != null) {
      setBoardSelection({
        kind: "workspace-draft",
        workspacePath: snapshot.activeWorkspacePath,
      });
      return;
    }

    setBoardSelection({ kind: "empty" });
  }

  const currentPromptDraftKey = getPromptDraftKey(
    sessionSnapshot?.activeWorkspacePath,
    sessionSnapshot?.activeConversationId,
  );
  const promptDraftStore = usePromptDraftStore(currentPromptDraftKey);
  const { promptSettings, setPromptSettings } = usePromptSettings(
    sessionSnapshot?.activeWorkspacePath ?? null,
  );

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

  function getConversationView(binding: ChatBinding) {
    return (
      sessionSnapshot?.conversationViews.find(
        (view) =>
          view.workspacePath === binding.workspacePath &&
          view.conversationId === binding.conversationId,
      ) ?? null
    );
  }

  function getWorkspace(workspacePath: string) {
    return (
      sessionSnapshot?.workspaces.find(
        (workspace) => workspace.workspacePath === workspacePath,
      ) ?? null
    );
  }

  function getConversationSummary(binding: ChatBinding) {
    return (
      getWorkspace(binding.workspacePath)?.conversations.find(
        (conversation) =>
          conversation.conversationId === binding.conversationId,
      ) ?? null
    );
  }

  async function openSavedWorkspace(workspaceId: string) {
    const result = await loadSavedWorkspaceState(workspaceId);
    if (result == null) {
      return;
    }

    setBoardSelection({ kind: "saved-workspace", workspace: result.workspace });
    if (result.latestSnapshot != null) {
      applySessionSnapshot(result.latestSnapshot);
    }
  }

  const actionState = {
    ...baseActionState,
    openProject: async (workspacePath: string) => {
      setBoardSelection({ kind: "empty" });
      await baseActionState.openProject(workspacePath);
    },
    openSavedWorkspace,
    openWorkspacePicker: async () => {
      setBoardSelection({ kind: "empty" });
      return await baseActionState.openWorkspacePicker();
    },
    selectConversation: async (
      workspacePath: string,
      conversationId: string,
    ) => {
      setBoardSelection({
        kind: "single-chat",
        chat: { workspacePath, conversationId },
      });
      await baseActionState.selectConversation(workspacePath, conversationId);
    },
    startNewChat: async (workspacePath?: string) => {
      const targetWorkspacePath =
        workspacePath ??
        sessionSnapshotRef.current?.activeWorkspacePath ??
        null;
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

      setBoardSelection({
        kind: "workspace-draft",
        workspacePath: targetWorkspacePath,
      });
      return snapshot;
    },
  };

  const canCompose =
    hasCurrentWorkspace &&
    activeWorkspaceConfigured &&
    followupRequest == null &&
    promptDraftStore.isSendingPrompt === false &&
    (activeConversation?.isRunning ?? false) === false;
  const requestTimingsById =
    activeConversationId == null
      ? {}
      : (requestTimingsByConversationId[activeConversationId] ?? {});

  const conversationState = {
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
  };

  const sidebarState = {
    activeWorkspacePath: sessionSnapshot?.activeWorkspacePath ?? null,
    activeSavedWorkspaceId:
      boardSelection.kind === "saved-workspace"
        ? boardSelection.workspace.id
        : null,
    hasCurrentWorkspace,
    savedWorkspaces: sessionSnapshot?.savedWorkspaces ?? [],
    workspaces: sessionSnapshot?.workspaces ?? [],
  };

  const workspaceBoardState = {
    applySessionSnapshot,
    getConversationSummary,
    getConversationView,
    getWorkspace,
    isOpeningProject,
    requestTimingsByConversationId,
    selection: boardSelection,
    sessionSnapshot,
    setSelection: setBoardSelection,
  };

  const promptState = {
    canCompose,
    followupRequest,
    isSendingPrompt: promptDraftStore.isSendingPrompt,
    promptSettings,
    promptDraft: promptDraftStore.promptDraft,
    setPromptDraft: promptDraftStore.setPromptDraft,
  };

  return {
    actionState,
    conversationState,
    promptState,
    sidebarState,
    workspaceBoardState,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const {
    actionState,
    conversationState,
    promptState,
    sidebarState,
    workspaceBoardState,
  } = useSessionProviderState();

  return (
    <SessionActionsContext.Provider value={actionState}>
      <WorkspaceBoardContext.Provider value={workspaceBoardState}>
        <ConversationStateContext.Provider value={conversationState}>
          <SidebarStateContext.Provider value={sidebarState}>
            <PromptDraftContext.Provider value={promptState}>
              {children}
            </PromptDraftContext.Provider>
          </SidebarStateContext.Provider>
        </ConversationStateContext.Provider>
      </WorkspaceBoardContext.Provider>
    </SessionActionsContext.Provider>
  );
}
