import * as React from "react";

import { useConversationActions } from "@/hooks/useConversationActions";
import {
  useConversationSession,
  useConversationSummary,
  useSessionStore,
} from "@/hooks/useSession";
import type { ChatBinding, WorkspaceSession } from "@/services/desktop/types/contracts";

import { appTargets } from "../constants/conversationHeader";
import { usePreferredOpenTarget } from "./usePreferredOpenTarget";
import type {
  AppTargetId,
  PendingHeaderAction,
  ProjectSwitchOption,
} from "../types/conversationHeader";
import {
  normalizeSearchText,
  rankBranchMatch,
} from "../utils/conversationHeader";

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
  const projects = React.useMemo<ProjectSwitchOption[]>(
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
