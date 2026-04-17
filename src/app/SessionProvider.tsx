import { useCallback, useMemo, useState, type ReactNode } from "react";

import type { SessionSnapshot } from "../services/desktop/contracts";
import { useLatestRef } from "../hooks/useLatestRef";
import { usePromptDraftStore } from "../hooks/usePromptDraftStore";
import { useRuntimeStatus } from "../hooks/useRuntimeStatus";
import { useSessionBootstrap } from "../hooks/useSessionBootstrap";
import { useSessionCommands } from "../hooks/useSessionCommands";
import {
  ConversationStateContext,
  PromptDraftContext,
  type RequestTimingInfo,
  SessionActionsContext,
  SidebarStateContext,
} from "./SessionContext";
import {
  getActiveConversation,
  getActiveWorkspace,
  getActiveWorkspaceLabel,
  getPromptDraftKey,
} from "./sessionSnapshot";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionSnapshot, setSessionSnapshot] = useState<SessionSnapshot | null>(
    null,
  );
  const [requestTimingsByConversationId, setRequestTimingsByConversationId] =
    useState<Record<string, Record<string, RequestTimingInfo>>>({});
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const sessionSnapshotRef = useLatestRef(sessionSnapshot);

  const applySessionSnapshot = useCallback((snapshot: SessionSnapshot) => {
    const activeConversationId = snapshot.activeConversationId;
    if (activeConversationId != null) {
      const activeRequestIds = snapshot.visibleActiveRequestIds ?? [];
      setRequestTimingsByConversationId((current) => {
        const currentConversationTimings = current[activeConversationId] ?? {};
        const nextConversationTimings = { ...currentConversationTimings };
        const activeRequestIdSet = new Set(activeRequestIds);
        const now = Date.now();

        for (const requestId of activeRequestIds) {
          if (nextConversationTimings[requestId] == null) {
            nextConversationTimings[requestId] = {
              startedAtMs: now,
              completedAtMs: null,
            };
          }
        }

        for (const [requestId, timing] of Object.entries(
          nextConversationTimings,
        )) {
          if (timing.completedAtMs == null && !activeRequestIdSet.has(requestId)) {
            nextConversationTimings[requestId] = {
              ...timing,
              completedAtMs: now,
            };
          }
        }

        return {
          ...current,
          [activeConversationId]: nextConversationTimings,
        };
      });
    }

    setSessionSnapshot(snapshot);
  }, []);

  const currentPromptDraftKey = getPromptDraftKey(
    sessionSnapshot?.activeWorkspacePath,
    sessionSnapshot?.activeConversationId,
  );
  const promptDraftStore = usePromptDraftStore(currentPromptDraftKey);

  const { refreshRuntimeStatus, runtimeStatus, setRuntimeStatus } =
    useRuntimeStatus(sessionSnapshot?.activeWorkspacePath ?? null);

  const actionState = useSessionCommands({
    promptDraftStore,
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
      hasCurrentWorkspace,
      workspaces: sessionSnapshot?.workspaces ?? [],
    }),
    [
      hasCurrentWorkspace,
      sessionSnapshot?.activeWorkspacePath,
      sessionSnapshot?.workspaces,
    ],
  );

  const promptState = useMemo(
    () => ({
      canCompose,
      followupRequest,
      isSendingPrompt: promptDraftStore.isSendingPrompt,
      promptDraft: promptDraftStore.promptDraft,
      setPromptDraft: promptDraftStore.setPromptDraft,
    }),
    [
      canCompose,
      followupRequest,
      promptDraftStore.isSendingPrompt,
      promptDraftStore.promptDraft,
      promptDraftStore.setPromptDraft,
    ],
  );

  return (
    <SessionActionsContext.Provider value={actionState}>
      <ConversationStateContext.Provider value={conversationState}>
        <SidebarStateContext.Provider value={sidebarState}>
          <PromptDraftContext.Provider value={promptState}>
            {children}
          </PromptDraftContext.Provider>
        </SidebarStateContext.Provider>
      </ConversationStateContext.Provider>
    </SessionActionsContext.Provider>
  );
}
