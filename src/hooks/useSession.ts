import { useCallback, useContext, useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import {
  SessionActionsContext,
  type WorkspaceBoardSelection,
} from "../app/SessionContext";
import { getPromptDraftKey } from "../app/sessionSnapshot";
import {
  ensureWorkspacePromptSettingsLoaded,
  ensureWorkspaceRuntimeStatusLoaded,
  getConversationStoreKey,
  getUiActiveConversationId,
  getUiActiveWorkspacePath,
  getUiWorkspaceLabel,
  getWorkspaceMetaStoreKey,
  sessionStore,
  type SessionStoreState,
  type WorkspaceMetaState,
} from "../app/sessionStore";
import { getWorkspaceBoardSelectionKey } from "../components/workspace-board/workspaceBoardUtils";
import type { ChatBinding } from "../services/desktop/contracts";

const EMPTY_REQUEST_TIMINGS = {};
const EMPTY_STRING_ARRAY: string[] = [];
const EMPTY_MESSAGES: Array<
  import("../services/desktop/contracts").TranscriptMessage
> = [];
const EMPTY_TODOS: Array<import("../services/desktop/contracts").SessionTodo> = [];
const EMPTY_WORKSPACE_META: WorkspaceMetaState = {
  promptSettings: null,
  promptSettingsLoaded: false,
  runtimeStatus: null,
  runtimeStatusLoaded: false,
};

function useRequiredContext<T>(
  value: T | null,
  name: string,
): T {
  if (value == null) {
    throw new Error(`${name} must be used within a SessionProvider`);
  }

  return value;
}

function getScopedWorkspacePath(
  state: Pick<SessionStoreState, "activeWorkspacePath" | "selection">,
  binding: ChatBinding | null | undefined,
): string | null {
  return binding?.workspacePath ?? getUiActiveWorkspacePath(state);
}

function getScopedConversationId(
  state: Pick<SessionStoreState, "activeConversationId" | "selection">,
  binding: ChatBinding | null | undefined,
): string | null {
  return binding?.conversationId ?? getUiActiveConversationId(state);
}

function getScopedConversationView(
  state: SessionStoreState,
  binding: ChatBinding | null | undefined,
) {
  const workspacePath = getScopedWorkspacePath(state, binding);
  const conversationId = getScopedConversationId(state, binding);
  if (workspacePath == null || conversationId == null) {
    return null;
  }

  return (
    state.conversationViewsByKey[
      getConversationStoreKey(workspacePath, conversationId)
    ] ?? null
  );
}

function getScopedConversationSummary(
  state: SessionStoreState,
  binding: ChatBinding | null | undefined,
) {
  const workspacePath = getScopedWorkspacePath(state, binding);
  const conversationId = getScopedConversationId(state, binding);
  if (workspacePath == null || conversationId == null) {
    return null;
  }

  return (
    state.conversationSummariesByKey[
      getConversationStoreKey(workspacePath, conversationId)
    ] ?? null
  );
}

export function useSessionActions() {
  return useRequiredContext(
    useContext(SessionActionsContext),
    "useSessionActions",
  );
}

export function useSessionStore<T>(
  selector: (state: SessionStoreState) => T,
): T {
  return useStore(sessionStore, selector);
}

export function useBoardSelection(): WorkspaceBoardSelection {
  return useSessionStore((state) => state.selection);
}

export function useBoardSelectionKey(): string {
  return useSessionStore((state) => getWorkspaceBoardSelectionKey(state.selection));
}

export function useWorkspaceMeta(workspacePath: string | null): WorkspaceMetaState {
  const workspaceMetaKey = getWorkspaceMetaStoreKey(workspacePath);
  const meta = useSessionStore(
    (state) => state.workspaceMetaByKey[workspaceMetaKey] ?? EMPTY_WORKSPACE_META,
  );

  useEffect(() => {
    void ensureWorkspaceRuntimeStatusLoaded(workspacePath);
    if (workspacePath != null) {
      void ensureWorkspacePromptSettingsLoaded(workspacePath);
    }
  }, [workspacePath]);

  return meta;
}

export function useWorkspaceSession(workspacePath: string | null) {
  return useSessionStore((state) =>
    workspacePath == null ? null : (state.workspacesByPath[workspacePath] ?? null),
  );
}

export function useConversationView(binding: ChatBinding | null | undefined) {
  return useSessionStore((state) => getScopedConversationView(state, binding));
}

export function useConversationSummary(binding: ChatBinding | null | undefined) {
  return useSessionStore((state) => getScopedConversationSummary(state, binding));
}

export function useHasCurrentWorkspace(): boolean {
  return useSessionStore((state) => getUiActiveWorkspacePath(state) != null);
}

export function useSidebarSession() {
  return useSessionStore(
    useShallow((state) => {
      const activeWorkspacePath = getUiActiveWorkspacePath(state);
      const activeConversationId = getUiActiveConversationId(state);
      return {
        activeConversationId,
        isDemoChatSelected: state.selection.kind === "demo-chat",
        activeSavedWorkspaceId:
          state.selection.kind === "saved-workspace"
            ? state.selection.workspace.id
            : null,
        activeWorkspacePath,
        hasCurrentWorkspace: activeWorkspacePath != null,
        savedWorkspaces: state.savedWorkspaces,
        workspaces: state.workspaces,
      };
    }),
  );
}

export function useConversationSession(binding?: ChatBinding | null) {
  const workspacePath = useSessionStore((state) =>
    getScopedWorkspacePath(state, binding),
  );
  const meta = useWorkspaceMeta(workspacePath);

  return useSessionStore(
    useShallow((state) => {
      const currentWorkspacePath = getScopedWorkspacePath(state, binding);
      const currentConversationId = getScopedConversationId(state, binding);
      const currentWorkspace =
        currentWorkspacePath == null
          ? null
          : (state.workspacesByPath[currentWorkspacePath] ?? null);
      const currentView = getScopedConversationView(state, binding);

      return {
        activeRequestIds: currentView?.activeRequestIds ?? EMPTY_STRING_ARRAY,
        activeWorkspaceConfigurationError:
          meta.runtimeStatus?.configurationError ??
          currentWorkspace?.configurationError ??
          null,
        activeWorkspaceConfigured:
          meta.runtimeStatus?.configured ?? currentWorkspace?.configured ?? true,
        activeWorkspaceLabel: getUiWorkspaceLabel(
          currentWorkspacePath,
          meta.runtimeStatus,
        ),
        followupRequest: currentView?.followup ?? null,
        hasCurrentWorkspace: currentWorkspacePath != null,
        isOpeningProject: state.isOpeningProject,
        messages: currentView?.messages ?? EMPTY_MESSAGES,
        requestTimingsById:
          currentConversationId == null
            ? EMPTY_REQUEST_TIMINGS
            : (state.requestTimingsByConversationId[currentConversationId] ??
              EMPTY_REQUEST_TIMINGS),
        runtimeStatus: meta.runtimeStatus,
        todos: currentView?.todos ?? EMPTY_TODOS,
        uiError: state.uiError,
        workspaceKind: currentWorkspace?.kind ?? "project",
        workspacePath: currentWorkspacePath,
      };
    }),
  );
}

export function usePromptDraft(binding?: ChatBinding | null) {
  const workspacePath = useSessionStore((state) =>
    getScopedWorkspacePath(state, binding),
  );
  const promptDraftKey = useSessionStore((state) =>
    getPromptDraftKey(
      getScopedWorkspacePath(state, binding),
      getScopedConversationId(state, binding),
    ),
  );
  const meta = useWorkspaceMeta(workspacePath);
  const setPromptDraft = useCallback(
    (value: string) => {
      sessionStore.getState().setPromptDraftValue(promptDraftKey, value);
    },
    [promptDraftKey],
  );
  const setPlanningMode = useCallback(
    (value: boolean) => {
      sessionStore.getState().setPromptDraftPlanningMode(promptDraftKey, value);
    },
    [promptDraftKey],
  );

  const draftState = useSessionStore(
    useShallow((state) => {
      const currentWorkspacePath = getScopedWorkspacePath(state, binding);
      const currentConversationId = getScopedConversationId(state, binding);
      const scopedPromptDraftKey = getPromptDraftKey(
        currentWorkspacePath,
        currentConversationId,
      );
      const draftEntry =
        scopedPromptDraftKey == null
          ? null
          : (state.promptDraftsByKey[scopedPromptDraftKey] ?? null);
      const currentWorkspace =
        currentWorkspacePath == null
          ? null
          : (state.workspacesByPath[currentWorkspacePath] ?? null);
      const currentView = getScopedConversationView(state, binding);
      const followupRequest = currentView?.followup ?? null;
      const activeWorkspaceConfigured =
        meta.runtimeStatus?.configured ?? currentWorkspace?.configured ?? true;
      const isConversationRunning =
        getScopedConversationSummary(state, binding)?.isRunning ?? false;

      return {
        canCompose:
          currentWorkspacePath != null &&
          activeWorkspaceConfigured &&
          followupRequest == null &&
          (draftEntry?.isPending ?? false) === false &&
          !isConversationRunning,
        followupRequest,
        isPlanningMode: draftEntry?.isPlanningMode ?? false,
        isSendingPrompt: draftEntry?.isPending ?? false,
        promptDraft: draftEntry?.value ?? "",
        promptSettings: meta.promptSettings,
      };
    }),
  );

  return useMemo(
    () => ({
      ...draftState,
      setPlanningMode,
      setPromptDraft,
    }),
    [draftState, setPlanningMode, setPromptDraft],
  );
}
