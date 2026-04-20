import { createStore, type StoreApi } from "zustand/vanilla";

import * as desktopClient from "../services/desktop/client";
import type {
  ChatBinding,
  ConversationSessionSummary,
  ConversationViewSnapshot,
  PromptSettings,
  RuntimeStatus,
  SavedWorkspaceSummary,
  SessionSnapshot,
  WorkspaceSession,
} from "../services/desktop/contracts";
import type {
  RequestTimingInfo,
  WorkspaceBoardSelection,
} from "./SessionContext";

const GLOBAL_WORKSPACE_META_KEY = "__global__";

interface PromptDraftEntry {
  isPending: boolean;
  value: string;
}

export interface WorkspaceMetaState {
  promptSettings: PromptSettings | null;
  promptSettingsLoaded: boolean;
  runtimeStatus: RuntimeStatus | null;
  runtimeStatusLoaded: boolean;
}

export interface SessionStoreState {
  activeConversationId: string | null;
  activeWorkspacePath: string | null;
  conversationSummariesByKey: Record<string, ConversationSessionSummary>;
  conversationViewsByKey: Record<string, ConversationViewSnapshot>;
  isOpeningProject: boolean;
  promptDraftsByKey: Record<string, PromptDraftEntry>;
  requestTimingsByConversationId: Record<
    string,
    Record<string, RequestTimingInfo>
  >;
  savedWorkspaces: SavedWorkspaceSummary[];
  selection: WorkspaceBoardSelection;
  uiError: string | null;
  workspaceMetaByKey: Record<string, WorkspaceMetaState>;
  workspaces: WorkspaceSession[];
  workspacesByPath: Record<string, WorkspaceSession>;
  applySessionSnapshot: (snapshot: SessionSnapshot) => void;
  clearPromptDraft: (key: string | null) => void;
  movePromptDraft: (fromKey: string | null, toKey: string | null) => void;
  setBoardSelection: (selection: WorkspaceBoardSelection) => void;
  setIsOpeningProject: (value: boolean) => void;
  setPromptDraftPending: (key: string | null, isPending: boolean) => void;
  setPromptDraftValue: (key: string | null, value: string) => void;
  setWorkspacePromptSettings: (
    workspacePath: string | null,
    promptSettings: PromptSettings | null,
  ) => void;
  setWorkspaceRuntimeStatus: (
    workspacePath: string | null,
    runtimeStatus: RuntimeStatus | null,
  ) => void;
}

type SessionStoreSetter = StoreApi<SessionStoreState>["setState"];

export function getConversationStoreKey(
  workspacePath: string,
  conversationId: string,
): string {
  return `${workspacePath}::${conversationId}`;
}

export function getConversationStoreKeyForBinding(binding: ChatBinding): string {
  return getConversationStoreKey(binding.workspacePath, binding.conversationId);
}

export function getWorkspaceMetaStoreKey(workspacePath: string | null): string {
  return workspacePath ?? GLOBAL_WORKSPACE_META_KEY;
}

export function areChatBindingsEqual(
  left: ChatBinding | null,
  right: ChatBinding | null,
): boolean {
  if (left === right) {
    return true;
  }

  if (left == null || right == null) {
    return false;
  }

  return (
    left.workspacePath === right.workspacePath &&
    left.conversationId === right.conversationId
  );
}

function getConversationDraftEntry(
  drafts: Record<string, PromptDraftEntry>,
  key: string,
): PromptDraftEntry | null {
  return drafts[key] ?? null;
}

function writePromptDraftEntry(
  drafts: Record<string, PromptDraftEntry>,
  key: string,
  entry: PromptDraftEntry | null,
): Record<string, PromptDraftEntry> {
  const current = drafts[key] ?? null;
  const nextEntry =
    entry == null || (entry.value === "" && !entry.isPending) ? null : entry;

  if (nextEntry == null) {
    if (current == null) {
      return drafts;
    }

    const nextDrafts = { ...drafts };
    delete nextDrafts[key];
    return nextDrafts;
  }

  if (
    current?.value === nextEntry.value &&
    current?.isPending === nextEntry.isPending
  ) {
    return drafts;
  }

  return {
    ...drafts,
    [key]: nextEntry,
  };
}

function setPromptDraftEntryValue(
  drafts: Record<string, PromptDraftEntry>,
  key: string,
  value: string,
): Record<string, PromptDraftEntry> {
  const current = getConversationDraftEntry(drafts, key) ?? {
    isPending: false,
    value: "",
  };

  return writePromptDraftEntry(drafts, key, { ...current, value });
}

function setPromptDraftEntryPending(
  drafts: Record<string, PromptDraftEntry>,
  key: string,
  isPending: boolean,
): Record<string, PromptDraftEntry> {
  const current = getConversationDraftEntry(drafts, key) ?? {
    isPending: false,
    value: "",
  };

  return writePromptDraftEntry(drafts, key, { ...current, isPending });
}

function movePromptDraftEntry(
  drafts: Record<string, PromptDraftEntry>,
  fromKey: string | null,
  toKey: string | null,
): Record<string, PromptDraftEntry> {
  if (fromKey == null || toKey == null || fromKey === toKey) {
    return drafts;
  }

  const draft = getConversationDraftEntry(drafts, fromKey);
  if (draft == null) {
    return drafts;
  }

  const nextDrafts = {
    ...writePromptDraftEntry(drafts, toKey, draft),
  };
  delete nextDrafts[fromKey];
  return nextDrafts;
}

function deriveSelectionFromSnapshot(
  snapshot: SessionSnapshot,
): WorkspaceBoardSelection {
  if (
    snapshot.activeWorkspacePath != null &&
    snapshot.activeConversationId != null
  ) {
    return {
      kind: "single-chat",
      chat: {
        workspacePath: snapshot.activeWorkspacePath,
        conversationId: snapshot.activeConversationId,
      },
    };
  }

  if (snapshot.activeWorkspacePath != null) {
    return {
      kind: "workspace-draft",
      workspacePath: snapshot.activeWorkspacePath,
    };
  }

  return { kind: "empty" };
}

function deriveConversationViews(snapshot: SessionSnapshot) {
  if (snapshot.conversationViews.length > 0) {
    return snapshot.conversationViews;
  }

  if (
    snapshot.activeWorkspacePath != null &&
    snapshot.activeConversationId != null
  ) {
    return [
      {
        activeRequestIds: snapshot.visibleActiveRequestIds,
        conversationId: snapshot.activeConversationId,
        followup: snapshot.visibleFollowup,
        messages: snapshot.visibleMessages,
        todos: snapshot.visibleTodos,
        workspacePath: snapshot.activeWorkspacePath,
      } satisfies ConversationViewSnapshot,
    ];
  }

  return [];
}

function buildWorkspacesByPath(workspaces: WorkspaceSession[]) {
  const byPath: Record<string, WorkspaceSession> = {};
  for (const workspace of workspaces) {
    byPath[workspace.workspacePath] = workspace;
  }
  return byPath;
}

function buildConversationSummariesByKey(workspaces: WorkspaceSession[]) {
  const byKey: Record<string, ConversationSessionSummary> = {};

  for (const workspace of workspaces) {
    for (const conversation of workspace.conversations) {
      byKey[
        getConversationStoreKey(
          workspace.workspacePath,
          conversation.conversationId,
        )
      ] = conversation;
    }
  }

  return byKey;
}

function areSelectionsEqual(
  left: WorkspaceBoardSelection,
  right: WorkspaceBoardSelection,
): boolean {
  if (left === right) {
    return true;
  }

  if (left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "empty":
      return true;
    case "single-chat": {
      const rightSelection = right as Extract<
        WorkspaceBoardSelection,
        { kind: "single-chat" }
      >;
      return areChatBindingsEqual(left.chat, rightSelection.chat);
    }
    case "workspace-draft": {
      const rightSelection = right as Extract<
        WorkspaceBoardSelection,
        { kind: "workspace-draft" }
      >;
      return left.workspacePath === rightSelection.workspacePath;
    }
    case "saved-workspace": {
      const rightSelection = right as Extract<
        WorkspaceBoardSelection,
        { kind: "saved-workspace" }
      >;
      return (
        left.workspace.id === rightSelection.workspace.id &&
        left.workspace.layoutJson === rightSelection.workspace.layoutJson &&
        left.workspace.name === rightSelection.workspace.name &&
        left.workspace.updatedAt === rightSelection.workspace.updatedAt &&
        areChatBindingsEqual(left.activeChat, rightSelection.activeChat)
      );
    }
  }
}

function setWorkspaceMetaState(
  currentState: SessionStoreState,
  workspacePath: string | null,
  updater: (currentMeta: WorkspaceMetaState) => WorkspaceMetaState,
) {
  const workspaceMetaKey = getWorkspaceMetaStoreKey(workspacePath);
  const currentMeta =
    currentState.workspaceMetaByKey[workspaceMetaKey] ?? defaultWorkspaceMetaState;
  const nextMeta = updater(currentMeta);

  if (
    nextMeta.promptSettings === currentMeta.promptSettings &&
    nextMeta.promptSettingsLoaded === currentMeta.promptSettingsLoaded &&
    nextMeta.runtimeStatus === currentMeta.runtimeStatus &&
    nextMeta.runtimeStatusLoaded === currentMeta.runtimeStatusLoaded
  ) {
    return currentState.workspaceMetaByKey;
  }

  return {
    ...currentState.workspaceMetaByKey,
    [workspaceMetaKey]: nextMeta,
  };
}

const defaultWorkspaceMetaState: WorkspaceMetaState = {
  promptSettings: null,
  promptSettingsLoaded: false,
  runtimeStatus: null,
  runtimeStatusLoaded: false,
};

function createSessionStoreState(set: SessionStoreSetter): SessionStoreState {
  return {
    activeConversationId: null,
    activeWorkspacePath: null,
    conversationSummariesByKey: {},
    conversationViewsByKey: {},
    isOpeningProject: false,
    promptDraftsByKey: {},
    requestTimingsByConversationId: {},
    savedWorkspaces: [],
    selection: { kind: "empty" },
    uiError: null,
    workspaceMetaByKey: {},
    workspaces: [],
    workspacesByPath: {},
    applySessionSnapshot: (snapshot) => {
      const nextViews = deriveConversationViews(snapshot);
      set((current) => {
        const now = Date.now();
        let nextRequestTimingsByConversationId =
          current.requestTimingsByConversationId;

        if (nextViews.length > 0) {
          let didChangeTimings = false;
          const nextTimingsState = {
            ...current.requestTimingsByConversationId,
          };

          for (const view of nextViews) {
            const currentConversationTimings =
              current.requestTimingsByConversationId[view.conversationId] ?? {};
            const nextConversationTimings = { ...currentConversationTimings };
            const activeRequestIdSet = new Set(view.activeRequestIds ?? []);

            for (const requestId of view.activeRequestIds ?? []) {
              if (nextConversationTimings[requestId] == null) {
                nextConversationTimings[requestId] = {
                  completedAtMs: null,
                  startedAtMs: now,
                };
                didChangeTimings = true;
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
                didChangeTimings = true;
              }
            }

            nextTimingsState[view.conversationId] = nextConversationTimings;
          }

          if (didChangeTimings) {
            nextRequestTimingsByConversationId = nextTimingsState;
          }
        }

        const nextConversationViewsByKey = { ...current.conversationViewsByKey };
        for (const view of nextViews) {
          nextConversationViewsByKey[
            getConversationStoreKey(view.workspacePath, view.conversationId)
          ] = view;
        }

        return {
          activeConversationId: snapshot.activeConversationId,
          activeWorkspacePath: snapshot.activeWorkspacePath,
          conversationSummariesByKey: buildConversationSummariesByKey(
            snapshot.workspaces,
          ),
          conversationViewsByKey: nextConversationViewsByKey,
          requestTimingsByConversationId: nextRequestTimingsByConversationId,
          savedWorkspaces: snapshot.savedWorkspaces,
          selection:
            current.selection.kind === "saved-workspace"
              ? current.selection
              : deriveSelectionFromSnapshot(snapshot),
          uiError: snapshot.uiError,
          workspaces: snapshot.workspaces,
          workspacesByPath: buildWorkspacesByPath(snapshot.workspaces),
        };
      });
    },
    clearPromptDraft: (key) => {
      if (key == null) {
        return;
      }

      set((current) => ({
        promptDraftsByKey: setPromptDraftEntryValue(
          current.promptDraftsByKey,
          key,
          "",
        ),
      }));
    },
    movePromptDraft: (fromKey, toKey) => {
      set((current) => ({
        promptDraftsByKey: movePromptDraftEntry(
          current.promptDraftsByKey,
          fromKey,
          toKey,
        ),
      }));
    },
    setBoardSelection: (selection) => {
      set((current) =>
        areSelectionsEqual(current.selection, selection) ? current : { selection },
      );
    },
    setIsOpeningProject: (value) => {
      set((current) =>
        current.isOpeningProject === value
          ? current
          : { isOpeningProject: value },
      );
    },
    setPromptDraftPending: (key, isPending) => {
      if (key == null) {
        return;
      }

      set((current) => ({
        promptDraftsByKey: setPromptDraftEntryPending(
          current.promptDraftsByKey,
          key,
          isPending,
        ),
      }));
    },
    setPromptDraftValue: (key, value) => {
      if (key == null) {
        return;
      }

      set((current) => ({
        promptDraftsByKey: setPromptDraftEntryValue(
          current.promptDraftsByKey,
          key,
          value,
        ),
      }));
    },
    setWorkspacePromptSettings: (workspacePath, promptSettings) => {
      set((current) => ({
        workspaceMetaByKey: setWorkspaceMetaState(
          current,
          workspacePath,
          (currentMeta) => ({
            ...currentMeta,
            promptSettings,
            promptSettingsLoaded: true,
          }),
        ),
      }));
    },
    setWorkspaceRuntimeStatus: (workspacePath, runtimeStatus) => {
      set((current) => ({
        workspaceMetaByKey: setWorkspaceMetaState(
          current,
          workspacePath,
          (currentMeta) => ({
            ...currentMeta,
            runtimeStatus,
            runtimeStatusLoaded: true,
          }),
        ),
      }));
    },
  };
}

export const sessionStore = createStore<SessionStoreState>((set) =>
  createSessionStoreState(set),
);

const runtimeStatusRequests = new Map<string, Promise<RuntimeStatus | null>>();
const conversationViewRequests = new Map<
  string,
  Promise<ConversationViewSnapshot | null>
>();
const promptSettingsRequests = new Map<
  string,
  Promise<PromptSettings | null>
>();
let latestConversationSelectionRequestId = 0;

export function resetSessionStore() {
  conversationViewRequests.clear();
  runtimeStatusRequests.clear();
  promptSettingsRequests.clear();
  latestConversationSelectionRequestId = 0;
  sessionStore.setState(createSessionStoreState(sessionStore.setState), true);
}

export function beginConversationSelectionRequest() {
  latestConversationSelectionRequestId += 1;
  return latestConversationSelectionRequestId;
}

export function isLatestConversationSelectionRequest(requestId: number) {
  return latestConversationSelectionRequestId === requestId;
}

export function getWorkspaceMetaState(workspacePath: string | null) {
  return (
    sessionStore.getState().workspaceMetaByKey[
      getWorkspaceMetaStoreKey(workspacePath)
    ] ?? defaultWorkspaceMetaState
  );
}

export function getWorkspaceSession(workspacePath: string) {
  return sessionStore.getState().workspacesByPath[workspacePath] ?? null;
}

export function getConversationSummary(binding: ChatBinding) {
  return (
    sessionStore.getState().conversationSummariesByKey[
      getConversationStoreKeyForBinding(binding)
    ] ?? null
  );
}

export function getConversationView(binding: ChatBinding) {
  return (
    sessionStore.getState().conversationViewsByKey[
      getConversationStoreKeyForBinding(binding)
    ] ?? null
  );
}

export function getPromptDraftState(promptDraftKey: string | null) {
  if (promptDraftKey == null) {
    return {
      isPending: false,
      value: "",
    };
  }

  return (
    sessionStore.getState().promptDraftsByKey[promptDraftKey] ?? {
      isPending: false,
      value: "",
    }
  );
}

export function getUiActiveBinding(
  state: Pick<
    SessionStoreState,
    "activeConversationId" | "activeWorkspacePath" | "selection"
  > = sessionStore.getState(),
): ChatBinding | null {
  switch (state.selection.kind) {
    case "saved-workspace":
      return state.selection.activeChat;
    case "single-chat":
      return state.selection.chat;
    default:
      if (
        state.activeWorkspacePath != null &&
        state.activeConversationId != null
      ) {
        return {
          workspacePath: state.activeWorkspacePath,
          conversationId: state.activeConversationId,
        };
      }

      return null;
  }
}

export function getUiActiveWorkspacePath(
  state: Pick<
    SessionStoreState,
    "activeWorkspacePath" | "selection"
  > = sessionStore.getState(),
): string | null {
  switch (state.selection.kind) {
    case "saved-workspace":
      return state.selection.activeChat?.workspacePath ?? state.activeWorkspacePath;
    case "single-chat":
      return state.selection.chat.workspacePath;
    case "workspace-draft":
      return state.selection.workspacePath;
    case "empty":
      return state.activeWorkspacePath;
  }
}

export function getUiActiveConversationId(
  state: Pick<
    SessionStoreState,
    "activeConversationId" | "selection"
  > = sessionStore.getState(),
): string | null {
  switch (state.selection.kind) {
    case "saved-workspace":
      return state.selection.activeChat?.conversationId ?? null;
    case "single-chat":
      return state.selection.chat.conversationId;
    default:
      return state.activeConversationId;
  }
}

export function getUiWorkspaceLabel(
  workspacePath: string | null,
  runtimeStatus: RuntimeStatus | null,
): string {
  if (workspacePath != null) {
    return (
      sessionStore.getState().workspacesByPath[workspacePath]?.workspaceName ??
      runtimeStatus?.workspaceName ??
      "Projects"
    );
  }

  return runtimeStatus?.workspaceName ?? "Projects";
}

export async function ensureConversationViewLoaded(binding: ChatBinding) {
  const conversationKey = getConversationStoreKeyForBinding(binding);
  const existingView = getConversationView(binding);
  if (existingView != null) {
    return existingView;
  }

  const existingRequest = conversationViewRequests.get(conversationKey);
  if (existingRequest != null) {
    return existingRequest;
  }

  const request = (async () => {
    try {
      const snapshot = await desktopClient.ensureConversationView(
        binding.workspacePath,
        binding.conversationId,
      );
      sessionStore.getState().applySessionSnapshot(snapshot);
      return getConversationView(binding);
    } catch {
      return null;
    } finally {
      conversationViewRequests.delete(conversationKey);
    }
  })();

  conversationViewRequests.set(conversationKey, request);
  return await request;
}

export async function ensureWorkspaceRuntimeStatusLoaded(
  workspacePath: string | null,
  options?: { force?: boolean },
) {
  const workspaceMetaKey = getWorkspaceMetaStoreKey(workspacePath);
  const currentMeta = getWorkspaceMetaState(workspacePath);
  if (!options?.force && currentMeta.runtimeStatusLoaded) {
    return currentMeta.runtimeStatus;
  }

  const existingRequest = runtimeStatusRequests.get(workspaceMetaKey);
  if (existingRequest != null) {
    return existingRequest;
  }

  const request = (async () => {
    try {
      const runtimeStatus = await desktopClient.getRuntimeStatus(workspacePath);
      sessionStore
        .getState()
        .setWorkspaceRuntimeStatus(workspacePath, runtimeStatus);
      return runtimeStatus;
    } catch {
      sessionStore.getState().setWorkspaceRuntimeStatus(workspacePath, null);
      return null;
    } finally {
      runtimeStatusRequests.delete(workspaceMetaKey);
    }
  })();

  runtimeStatusRequests.set(workspaceMetaKey, request);
  return await request;
}

export async function ensureWorkspacePromptSettingsLoaded(
  workspacePath: string | null,
  options?: { force?: boolean },
) {
  const workspaceMetaKey = getWorkspaceMetaStoreKey(workspacePath);
  const currentMeta = getWorkspaceMetaState(workspacePath);
  if (!options?.force && currentMeta.promptSettingsLoaded) {
    return currentMeta.promptSettings;
  }

  const existingRequest = promptSettingsRequests.get(workspaceMetaKey);
  if (existingRequest != null) {
    return existingRequest;
  }

  const request = (async () => {
    try {
      const promptSettings = await desktopClient.getPromptSettings(workspacePath);
      sessionStore
        .getState()
        .setWorkspacePromptSettings(workspacePath, promptSettings);
      return promptSettings;
    } catch {
      sessionStore.getState().setWorkspacePromptSettings(workspacePath, null);
      return null;
    } finally {
      promptSettingsRequests.delete(workspaceMetaKey);
    }
  })();

  promptSettingsRequests.set(workspaceMetaKey, request);
  return await request;
}
