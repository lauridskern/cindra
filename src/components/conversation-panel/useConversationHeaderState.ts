import * as React from "react";

import { useConversationActions } from "@/hooks/useConversationActions";
import {
  useConversationSession,
  useConversationSummary,
  useSessionStore,
} from "@/hooks/useSession";
import type { ChatBinding, WorkspaceSession } from "@/services/desktop/contracts";

import {
  appTargets,
  DEFAULT_APP_TARGET_ID,
  isAppTargetId,
  normalizeSearchText,
  OPEN_IN_PREFERRED_APP_STORAGE_KEY,
  rankBranchMatch,
  type AppTarget,
  type AppTargetId,
  type PendingHeaderAction,
} from "./model";

const EMPTY_STRING_ARRAY: readonly string[] = [];

export function useConversationHeaderState(binding?: ChatBinding | null) {
  const [branchQuery, setBranchQuery] = React.useState("");
  const [isBranchMenuOpen, setIsBranchMenuOpen] = React.useState(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = React.useState(false);
  const [commitMessage, setCommitMessage] = React.useState("");
  const [pendingHeaderAction, setPendingHeaderAction] =
    React.useState<PendingHeaderAction | null>(null);
  const branchSearchInputRef = React.useRef<HTMLInputElement | null>(null);

  const { activeWorkspaceLabel, runtimeStatus, workspaceKind, workspacePath } =
    useConversationSession(binding);
  const conversationSummary = useConversationSummary(binding);
  const {
    checkoutBranch,
    commitChanges,
    createBranch,
    openProject,
    openInTarget,
    pushBranch,
    startNewChat,
  } = useConversationActions(binding);
  const workspaces = useSessionStore((state) => state.workspaces);
  const projects = React.useMemo(
    () =>
      workspaces.filter(isProjectWorkspace).map((workspace) => ({
        label: workspace.workspaceName,
        workspacePath: workspace.workspacePath,
      })),
    [workspaces],
  );

  const repoName = runtimeStatus?.gitRepoName ?? null;
  const branchName = runtimeStatus?.gitBranchName ?? null;
  const branchNames = runtimeStatus?.gitBranches ?? EMPTY_STRING_ARRAY;
  const availableOpenTargets =
    runtimeStatus?.availableOpenTargets ?? EMPTY_STRING_ARRAY;
  const openTargets = appTargets.filter((target) =>
    availableOpenTargets.includes(target.id),
  );
  const { resolvedPreferredAppId, setPreferredAppId } =
    usePreferredOpenTarget(openTargets);

  const normalizedBranchQuery = normalizeSearchText(branchQuery);
  const filteredBranches = (() => {
    if (normalizedBranchQuery.length === 0) {
      return branchNames;
    }

    return branchNames
      .map((candidate, index) => ({
        candidate,
        index,
        rank: rankBranchMatch(candidate, normalizedBranchQuery),
      }))
      .filter((entry) => entry.rank !== Number.NEGATIVE_INFINITY)
      .toSorted(
        (left, right) => right.rank - left.rank || left.index - right.index,
      )
      .map((entry) => entry.candidate);
  })();

  const canCreateBranch =
    branchQuery.trim().length > 0 &&
    !branchNames.some(
      (candidate) => normalizeSearchText(candidate) === normalizedBranchQuery,
    );

  const isGitActionPending =
    pendingHeaderAction === "checkout" ||
    pendingHeaderAction === "create-branch" ||
    pendingHeaderAction === "commit" ||
    pendingHeaderAction === "push";
  const isCommitPending = pendingHeaderAction === "commit";
  const isOpenTargetPending = pendingHeaderAction === "open-target";
  const isProjectChangePending = pendingHeaderAction === "switch-project";
  const isManagedChat = workspaceKind === "managed_chat";
  const showGitActions = !isManagedChat;
  const conversationTitle =
    conversationSummary?.title ?? (isManagedChat ? "New chat" : activeWorkspaceLabel);
  const selectedProjectPath = isManagedChat ? null : workspacePath;
  const currentProjectLabel =
    selectedProjectPath == null ? "No project" : activeWorkspaceLabel;

  async function handleProjectSelect(nextWorkspacePath: string | null) {
    if (nextWorkspacePath === selectedProjectPath) {
      return;
    }

    setPendingHeaderAction("switch-project");
    try {
      if (nextWorkspacePath == null) {
        await startNewChat();
        return;
      }

      if (isManagedChat) {
        await startNewChat(nextWorkspacePath);
        return;
      }

      await openProject(nextWorkspacePath);
    } finally {
      setPendingHeaderAction(null);
    }
  }

  function handleBranchMenuOpenChange(open: boolean) {
    setIsBranchMenuOpen(open);
    if (!open) {
      setBranchQuery("");
    }
  }

  async function handleBranchSelect(candidate: string) {
    setPendingHeaderAction("checkout");
    try {
      await checkoutBranch(candidate);
      setIsBranchMenuOpen(false);
    } finally {
      setPendingHeaderAction(null);
    }
  }

  async function handleBranchCreate() {
    if (!canCreateBranch) {
      return;
    }

    setPendingHeaderAction("create-branch");
    try {
      await createBranch(branchQuery.trim());
      setIsBranchMenuOpen(false);
    } finally {
      setPendingHeaderAction(null);
    }
  }

  async function handlePush() {
    setPendingHeaderAction("push");
    try {
      await pushBranch();
    } finally {
      setPendingHeaderAction(null);
    }
  }

  async function handleOpenTarget(appId: AppTargetId) {
    if (openTargets.some((target) => target.id === appId) === false) {
      return;
    }

    setPreferredAppId(appId);
    setPendingHeaderAction("open-target");
    try {
      await openInTarget(appId);
    } finally {
      setPendingHeaderAction((current) =>
        current === "open-target" ? null : current,
      );
    }
  }

  function handleCommitDialogOpenChange(open: boolean) {
    if (isCommitPending) {
      return;
    }

    setIsCommitDialogOpen(open);
    if (!open) {
      setCommitMessage("");
    }
  }

  function handleCommitDialogClose() {
    handleCommitDialogOpenChange(false);
  }

  function openCommitDialog() {
    setIsCommitDialogOpen(true);
  }

  async function handleCommitSubmit() {
    const trimmedMessage = commitMessage.trim();
    if (trimmedMessage.length === 0) {
      return;
    }

    setPendingHeaderAction("commit");
    try {
      await commitChanges(trimmedMessage);
      setCommitMessage("");
      setIsCommitDialogOpen(false);
    } finally {
      setPendingHeaderAction(null);
    }
  }

  return {
    activeWorkspaceLabel,
    branchName,
    branchQuery,
    branchSearchInputRef,
    canCreateBranch,
    commitMessage,
    conversationTitle,
    currentProjectLabel,
    filteredBranches,
    isBranchMenuOpen,
    isCommitDialogOpen,
    isCommitPending,
    isGitActionPending,
    isManagedChat,
    isOpenTargetPending,
    isProjectChangePending,
    openTargets,
    projects,
    repoName,
    resolvedPreferredAppId,
    selectedProjectPath,
    setBranchQuery,
    setCommitMessage,
    handleBranchCreate,
    handleBranchMenuOpenChange,
    handleBranchSelect,
    handleCommitDialogClose,
    handleCommitDialogOpenChange,
    handleCommitSubmit,
    handleOpenTarget,
    handleProjectSelect,
    handlePush,
    openCommitDialog,
    showGitActions,
  };
}

function isProjectWorkspace(workspace: WorkspaceSession) {
  return workspace.kind === "project";
}

function usePreferredOpenTarget(openTargets: ReadonlyArray<AppTarget>) {
  const [preferredAppId, setPreferredAppId] = React.useState<AppTargetId>(
    DEFAULT_APP_TARGET_ID,
  );
  const hasInitializedPreferredAppRef = React.useRef(false);
  const openTargetsKey = openTargets.map((target) => target.id).join("|");
  const resolvedPreferredAppId =
    openTargets.length > 0 &&
    openTargets.some((target) => target.id === preferredAppId)
      ? preferredAppId
      : (openTargets[0]?.id ?? preferredAppId);

  React.useEffect(() => {
    if (hasInitializedPreferredAppRef.current || openTargets.length === 0) {
      return;
    }

    const storedPreferredAppId = window.localStorage.getItem(
      OPEN_IN_PREFERRED_APP_STORAGE_KEY,
    );
    const nextPreferredAppId =
      storedPreferredAppId != null &&
      isAppTargetId(storedPreferredAppId) &&
      openTargets.some((target) => target.id === storedPreferredAppId)
        ? storedPreferredAppId
        : openTargets[0].id;

    hasInitializedPreferredAppRef.current = true;
    setPreferredAppId(nextPreferredAppId);
  }, [openTargets, openTargetsKey]);

  React.useEffect(() => {
    if (openTargets.length === 0) {
      return;
    }

    window.localStorage.setItem(
      OPEN_IN_PREFERRED_APP_STORAGE_KEY,
      resolvedPreferredAppId,
    );
  }, [openTargets.length, resolvedPreferredAppId]);

  return {
    resolvedPreferredAppId,
    setPreferredAppId,
  };
}
