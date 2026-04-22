import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useStore } from "zustand";

import * as desktopClient from "../services/desktop/client";
import type {
  ChatBinding,
  SessionSnapshot,
} from "../services/desktop/contracts";
import { extractBindingsFromLayoutJson } from "../components/workspace-board/layout";
import { SessionActionsContext } from "./SessionContext";
import {
  openWorkspaceInTarget,
  runWorkspaceRuntimeStatusAction,
  submitFollowupResponse,
  updateWorkspacePromptSettings,
} from "./sessionClientActions";
import {
  beginConversationSelectionRequest,
  ensureConversationViewLoaded,
  ensureWorkspacePromptSettingsLoaded,
  ensureWorkspaceRuntimeStatusLoaded,
  getConversationStoreKeyForBinding,
  getConversationView,
  getSelectionFromSnapshot,
  isLatestConversationSelectionRequest,
  getPromptDraftState,
  getUiActiveBinding,
  getUiActiveConversationId,
  getUiActiveWorkspacePath,
  sessionStore,
} from "./sessionStore";
import {
  getPromptDraftKey,
  getWorkspaceDraftKey,
  LATEST_WORKSPACE_STORAGE_KEY,
} from "./sessionSnapshot";
import { useSessionBootstrap } from "../hooks/useSessionBootstrap";

export function SessionProvider({ children }: { children: ReactNode }) {
  const activeWorkspacePath = useStore(
    sessionStore,
    (state) => getUiActiveWorkspacePath(state),
  );

  const applySessionSnapshot = useCallback((snapshot: SessionSnapshot) => {
    sessionStore.getState().applySessionSnapshot(snapshot);
  }, []);

  useSessionBootstrap({ setSessionSnapshot: applySessionSnapshot });

  useEffect(() => {
    if (activeWorkspacePath == null) {
      return;
    }

    window.localStorage.setItem(
      LATEST_WORKSPACE_STORAGE_KEY,
      activeWorkspacePath,
    );
  }, [activeWorkspacePath]);

  const ensureWorkspaceMeta = useCallback(
    (workspacePath: string, options?: { forceRuntimeStatus?: boolean }) => {
      void ensureWorkspaceRuntimeStatusLoaded(workspacePath, {
        force: options?.forceRuntimeStatus,
      });
      void ensureWorkspacePromptSettingsLoaded(workspacePath);
    },
    [],
  );

  const findReusableManagedChatDraft = useCallback(() => {
    const store = sessionStore.getState();
    return (
      store.workspaces.find(
        (workspace) =>
          workspace.kind === "managed_chat" &&
          workspace.selectedConversationId == null &&
          workspace.conversations.length === 0,
      ) ?? null
    );
  }, []);

  const openWorkspaceByPath = useCallback(async (workspacePath: string) => {
    const store = sessionStore.getState();
    store.setIsOpeningProject(true);

    const snapshot = await desktopClient.openWorkspace(workspacePath).catch(
      () => null,
    );
    if (snapshot != null) {
      store.applySessionSnapshot(snapshot);
      store.setBoardSelection(getSelectionFromSnapshot(snapshot));
      ensureWorkspaceMeta(workspacePath, { forceRuntimeStatus: true });
    }

    sessionStore.getState().setIsOpeningProject(false);
  }, [ensureWorkspaceMeta]);

  const applyArchiveSnapshot = useCallback((snapshot: SessionSnapshot) => {
    sessionStore.getState().applySessionSnapshot(snapshot);
  }, []);

  const actionState = useMemo(
    () => ({
      checkoutBranch: async (branchName: string) => {
        const workspacePath = getUiActiveWorkspacePath(sessionStore.getState());
        if (workspacePath == null) {
          return;
        }

        await runWorkspaceRuntimeStatusAction(workspacePath, () =>
          desktopClient.checkoutGitBranch({
            branchName,
            workspacePath,
          }),
        );
      },
      commitChanges: async (message: string) => {
        const workspacePath = getUiActiveWorkspacePath(sessionStore.getState());
        if (workspacePath == null) {
          return;
        }

        await runWorkspaceRuntimeStatusAction(workspacePath, () =>
          desktopClient.commitGitChanges({
            message,
            workspacePath,
          }),
        );
      },
      createBranch: async (branchName: string) => {
        const workspacePath = getUiActiveWorkspacePath(sessionStore.getState());
        if (workspacePath == null) {
          return;
        }

        await runWorkspaceRuntimeStatusAction(workspacePath, () =>
          desktopClient.createGitBranch({
            branchName,
            workspacePath,
          }),
        );
      },
      openInTarget: async (targetId: string) => {
        const workspacePath = getUiActiveWorkspacePath(sessionStore.getState());
        if (workspacePath == null) {
          return;
        }

        await openWorkspaceInTarget(workspacePath, targetId);
      },
      openProject: async (workspacePath: string) => {
        await openWorkspaceByPath(workspacePath);
      },
      archiveConversation: async (
        workspacePath: string,
        conversationId: string,
      ) => {
        const currentSelection = sessionStore.getState().selection;
        const snapshot = await desktopClient
          .archiveConversation(workspacePath, conversationId)
          .catch(() => null);
        if (snapshot == null) {
          return;
        }

        applyArchiveSnapshot(snapshot);
        const activeBinding =
          currentSelection.kind === "single-chat"
            ? currentSelection.chat
            : currentSelection.kind === "saved-workspace"
              ? currentSelection.activeChat
              : null;
        if (
          activeBinding?.workspacePath === workspacePath &&
          activeBinding.conversationId === conversationId
        ) {
          sessionStore.getState().setBoardSelection(getSelectionFromSnapshot(snapshot));
        }
      },
      archiveWorkspace: async (workspacePath: string) => {
        const currentWorkspacePath = getUiActiveWorkspacePath(
          sessionStore.getState(),
        );
        const snapshot = await desktopClient
          .archiveWorkspace(workspacePath)
          .catch(() => null);
        if (snapshot == null) {
          return;
        }

        applyArchiveSnapshot(snapshot);
        if (currentWorkspacePath === workspacePath) {
          sessionStore.getState().setBoardSelection(getSelectionFromSnapshot(snapshot));
        }
      },
      renameWorkspace: async (
        workspacePath: string,
        displayName?: string | null,
      ) => {
        const snapshot = await desktopClient
          .renameWorkspace(workspacePath, displayName ?? null)
          .catch(() => null);
        if (snapshot == null) {
          return;
        }

        sessionStore.getState().applySessionSnapshot(snapshot);
      },
      renameSavedWorkspace: async (workspaceId: string, name: string) => {
        const snapshot = await desktopClient
          .renameSavedWorkspace(workspaceId, name)
          .catch(() => null);
        if (snapshot == null) {
          return;
        }

        sessionStore.getState().applySessionSnapshot(snapshot);
      },
      deleteSavedWorkspace: async (workspaceId: string) => {
        const selection = sessionStore.getState().selection;
        const snapshot = await desktopClient
          .deleteSavedWorkspace(workspaceId)
          .catch(() => null);
        if (snapshot == null) {
          return;
        }

        applyArchiveSnapshot(snapshot);
        if (
          selection.kind === "saved-workspace" &&
          selection.workspace.id === workspaceId
        ) {
          sessionStore.getState().setBoardSelection(getSelectionFromSnapshot(snapshot));
        }
      },
      openSavedWorkspace: async (workspaceId: string) => {
        const workspace = await desktopClient
          .getSavedWorkspace(workspaceId)
          .catch(() => null);
        if (workspace == null) {
          return;
        }

        const bindings = extractBindingsFromLayoutJson(workspace.layoutJson);
        const initialBinding = bindings[0] ?? null;
        const uniqueBindings = Array.from(
          new Map(
            bindings.map((binding) => [
              getConversationStoreKeyForBinding(binding),
              binding,
            ]),
          ).values(),
        );
        sessionStore.getState().setBoardSelection({
          kind: "saved-workspace",
          workspace,
          activeChat: initialBinding,
        });

        await Promise.all(
          uniqueBindings.map((binding) => ensureConversationViewLoaded(binding)),
        );

        const workspacePaths = Array.from(
          new Set(uniqueBindings.map((binding) => binding.workspacePath)),
        );
        workspacePaths.forEach((workspacePath) => {
          ensureWorkspaceMeta(workspacePath);
        });

        if (initialBinding == null) {
          return;
        }

        const snapshot = await desktopClient
          .selectConversation(
            initialBinding.workspacePath,
            initialBinding.conversationId,
          )
          .catch(() => null);
        if (snapshot != null) {
          sessionStore.getState().applySessionSnapshot(snapshot);
        }
      },
      openWorkspacePicker: async () => {
        try {
          const selectedPath = await desktopClient.pickWorkspace();
          if (selectedPath == null) {
            return null;
          }

          await openWorkspaceByPath(selectedPath);
          return selectedPath;
        } catch {
          return null;
        }
      },
      pushBranch: async () => {
        const workspacePath = getUiActiveWorkspacePath(sessionStore.getState());
        if (workspacePath == null) {
          return;
        }

        await runWorkspaceRuntimeStatusAction(workspacePath, () =>
          desktopClient.pushGitBranch(workspacePath),
        );
      },
      selectConversation: async (
        workspacePath: string,
        conversationId: string,
      ) => {
        const requestId = beginConversationSelectionRequest();

        const binding = { conversationId, workspacePath } satisfies ChatBinding;

        ensureWorkspaceMeta(workspacePath);

        sessionStore.getState().setBoardSelection({
          kind: "single-chat",
          chat: binding,
        });

        try {
          const snapshot = await desktopClient.selectConversation(
            workspacePath,
            conversationId,
          );
          if (!isLatestConversationSelectionRequest(requestId)) {
            return;
          }

          sessionStore.getState().applySessionSnapshot(snapshot);
          ensureWorkspaceMeta(workspacePath, { forceRuntimeStatus: true });
        } catch {
          return;
        }
      },
      startNewChat: async (workspacePath?: string) => {
        const targetWorkspacePath = workspacePath ?? null;
        if (targetWorkspacePath == null) {
          const reusableManagedChatDraft = findReusableManagedChatDraft();
          if (reusableManagedChatDraft != null) {
            await openWorkspaceByPath(reusableManagedChatDraft.workspacePath);
            return null;
          }

          const snapshot = await desktopClient.createManagedChat().catch(() => null);
          if (snapshot == null) {
            return null;
          }

          sessionStore.getState().applySessionSnapshot(snapshot);
          if (
            snapshot.activeWorkspacePath != null &&
            snapshot.activeConversationId == null
          ) {
            sessionStore.getState().setBoardSelection({
              kind: "workspace-draft",
              workspacePath: snapshot.activeWorkspacePath,
            });
            ensureWorkspaceMeta(snapshot.activeWorkspacePath, {
              forceRuntimeStatus: true,
            });
          }
          return snapshot;
        }

        const originPromptDraftKey = getWorkspaceDraftKey(targetWorkspacePath);
        const snapshot = await desktopClient
          .startNewChat(targetWorkspacePath)
          .catch(() => null);
        if (snapshot == null) {
          return null;
        }

        sessionStore.getState().applySessionSnapshot(snapshot);
        const nextPromptDraftKey = getPromptDraftKey(
          snapshot.activeWorkspacePath,
          snapshot.activeConversationId,
        );
        sessionStore
          .getState()
          .movePromptDraft(originPromptDraftKey, nextPromptDraftKey);

        if (
          snapshot.activeWorkspacePath === targetWorkspacePath &&
          snapshot.activeConversationId == null
        ) {
          sessionStore.getState().setBoardSelection({
            kind: "workspace-draft",
            workspacePath: targetWorkspacePath,
          });
        }

        ensureWorkspaceMeta(targetWorkspacePath, {
          forceRuntimeStatus: true,
        });
        return snapshot;
      },
      submitFollowup: async (input: {
        cancelled: boolean;
        text?: string;
        selectedOptionIds?: string[];
      }) => {
        const activeBinding = getUiActiveBinding(sessionStore.getState());
        const followupRequest =
          activeBinding == null ? null : getConversationView(activeBinding)?.followup ?? null;
        if (followupRequest == null) {
          return;
        }

        await submitFollowupResponse({
          cancelled: input.cancelled,
          followupId: followupRequest.followupId,
          selectedOptionIds: input.selectedOptionIds,
          text: input.text,
        });
      },
      stopPrompt: async () => {
        const activeBinding = getUiActiveBinding(sessionStore.getState());
        if (activeBinding == null) {
          return;
        }

        await desktopClient.stopPrompt(activeBinding).catch(() => null);
      },
      submitPrompt: async () => {
        const workspacePath = getUiActiveWorkspacePath(sessionStore.getState());
        if (workspacePath == null) {
          return;
        }

        const conversationId = getUiActiveConversationId(sessionStore.getState());
        const promptDraftKey = getPromptDraftKey(workspacePath, conversationId);
        if (promptDraftKey == null) {
          return;
        }

        const draftState = getPromptDraftState(promptDraftKey);
        const prompt = draftState.value.trim();
        if (prompt.length === 0) {
          return;
        }

        let nextPromptDraftKey: string | null = promptDraftKey;
        sessionStore.getState().setPromptDraftPending(promptDraftKey, true);

        const snapshot = await desktopClient
          .sendPrompt({
            agentId: draftState.isPlanningMode ? "muse" : "forge",
            conversationId,
            prompt,
            workspacePath,
          })
          .catch(() => null);
        if (snapshot != null) {
          sessionStore.getState().applySessionSnapshot(snapshot);

          nextPromptDraftKey = getPromptDraftKey(
            snapshot.activeWorkspacePath,
            snapshot.activeConversationId,
          );
          sessionStore
            .getState()
            .movePromptDraft(promptDraftKey, nextPromptDraftKey);
          sessionStore.getState().clearPromptDraft(nextPromptDraftKey);
        }

        sessionStore.getState().setPromptDraftPending(promptDraftKey, false);
        if (nextPromptDraftKey !== promptDraftKey) {
          sessionStore
            .getState()
            .setPromptDraftPending(nextPromptDraftKey, false);
        }
      },
      updatePromptSettings: async (input: {
        providerId: string;
        modelId: string;
        reasoningEffort?: string | null;
      }) => {
        const workspacePath = getUiActiveWorkspacePath(sessionStore.getState());
        if (workspacePath == null) {
          return;
        }

        await updateWorkspacePromptSettings(workspacePath, input);
      },
    }),
    [
      applyArchiveSnapshot,
      ensureWorkspaceMeta,
      findReusableManagedChatDraft,
      openWorkspaceByPath,
    ],
  );

  return (
    <SessionActionsContext.Provider value={actionState}>
      {children}
    </SessionActionsContext.Provider>
  );
}
