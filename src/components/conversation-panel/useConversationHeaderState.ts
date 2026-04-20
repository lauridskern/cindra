import * as React from "react";

import { useConversationActions } from "@/hooks/useConversationActions";
import { useConversationSession } from "@/hooks/useSession";
import type { ChatBinding } from "@/services/desktop/contracts";

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

  const { activeWorkspaceLabel, runtimeStatus } = useConversationSession(binding);
  const {
    checkoutBranch,
    commitChanges,
    createBranch,
    openInTarget,
    pushBranch,
  } = useConversationActions(binding);

  const repoName = runtimeStatus?.gitRepoName ?? null;
  const branchName = runtimeStatus?.gitBranchName ?? null;
  const branchNames = runtimeStatus?.gitBranches ?? EMPTY_STRING_ARRAY;
  const availableOpenTargets =
    runtimeStatus?.availableOpenTargets ?? EMPTY_STRING_ARRAY;
  const openTargets = React.useMemo<ReadonlyArray<AppTarget>>(
    () =>
      appTargets.filter((target) => availableOpenTargets.includes(target.id)),
    [availableOpenTargets],
  );
  const { resolvedPreferredAppId, setPreferredAppId } =
    usePreferredOpenTarget(openTargets);

  const normalizedBranchQuery = normalizeSearchText(branchQuery);
  const filteredBranches = React.useMemo(() => {
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
  }, [branchNames, normalizedBranchQuery]);

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

  useAutoFocusWhenOpen(isBranchMenuOpen, branchSearchInputRef);

  const handleBranchMenuOpenChange = React.useCallback((open: boolean) => {
    setIsBranchMenuOpen(open);
    if (!open) {
      setBranchQuery("");
    }
  }, []);

  const handleBranchSelect = React.useCallback(
    async (candidate: string) => {
      setPendingHeaderAction("checkout");
      try {
        await checkoutBranch(candidate);
        setIsBranchMenuOpen(false);
      } finally {
        setPendingHeaderAction(null);
      }
    },
    [checkoutBranch],
  );

  const handleBranchCreate = React.useCallback(async () => {
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
  }, [branchQuery, canCreateBranch, createBranch]);

  const handlePush = React.useCallback(async () => {
    setPendingHeaderAction("push");
    try {
      await pushBranch();
    } finally {
      setPendingHeaderAction(null);
    }
  }, [pushBranch]);

  const handleOpenTarget = React.useCallback(
    async (appId: AppTargetId) => {
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
    },
    [openInTarget, openTargets, setPreferredAppId],
  );

  const handleCommitDialogOpenChange = React.useCallback(
    (open: boolean) => {
      if (isCommitPending) {
        return;
      }

      setIsCommitDialogOpen(open);
      if (!open) {
        setCommitMessage("");
      }
    },
    [isCommitPending],
  );

  const handleCommitDialogClose = React.useCallback(() => {
    handleCommitDialogOpenChange(false);
  }, [handleCommitDialogOpenChange]);

  const openCommitDialog = React.useCallback(() => {
    setIsCommitDialogOpen(true);
  }, []);

  const handleCommitSubmit = React.useCallback(async () => {
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
  }, [commitChanges, commitMessage]);

  return {
    activeWorkspaceLabel,
    branchName,
    branchQuery,
    branchSearchInputRef,
    canCreateBranch,
    commitMessage,
    filteredBranches,
    isBranchMenuOpen,
    isCommitDialogOpen,
    isCommitPending,
    isGitActionPending,
    isOpenTargetPending,
    openTargets,
    repoName,
    resolvedPreferredAppId,
    setBranchQuery,
    setCommitMessage,
    handleBranchCreate,
    handleBranchMenuOpenChange,
    handleBranchSelect,
    handleCommitDialogClose,
    handleCommitDialogOpenChange,
    handleCommitSubmit,
    handleOpenTarget,
    handlePush,
    openCommitDialog,
  };
}

function usePreferredOpenTarget(openTargets: ReadonlyArray<AppTarget>) {
  const [preferredAppId, setPreferredAppId] =
    React.useState<AppTargetId>(DEFAULT_APP_TARGET_ID);
  const hasInitializedPreferredAppRef = React.useRef(false);
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
  }, [openTargets]);

  React.useEffect(() => {
    if (openTargets.length === 0) {
      return;
    }

    window.localStorage.setItem(
      OPEN_IN_PREFERRED_APP_STORAGE_KEY,
      resolvedPreferredAppId,
    );
  }, [openTargets.length, resolvedPreferredAppId]);

  return { preferredAppId, resolvedPreferredAppId, setPreferredAppId };
}

function useAutoFocusWhenOpen(
  isOpen: boolean,
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [inputRef, isOpen]);
}
