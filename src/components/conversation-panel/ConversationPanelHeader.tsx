import { ChevronRight, GitFork } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/utils/cn";
import { handleWindowDragStart } from "@/utils/window";

import { BranchSwitcherMenu } from "./BranchSwitcherMenu";
import { CommitChangesDialog } from "./CommitChangesDialog";
import { ConversationHeaderActions } from "./ConversationHeaderActions";
import { useConversationHeaderState } from "./useConversationHeaderState";

interface ConversationPanelHeaderProps {
  reserveTitlebarInset: boolean;
}

export function ConversationPanelHeader({
  reserveTitlebarInset,
}: ConversationPanelHeaderProps) {
  const {
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
  } = useConversationHeaderState();

  return (
    <>
      <header
        className={cn(
          "flex h-9.5 items-center gap-3 border-b border-black/5 pr-1.5 select-none dark:border-white/5",
          reserveTitlebarInset && "pl-34",
        )}
      >
        <div className="relative z-20 flex min-w-fit shrink-0 items-center text-xs font-medium tracking-tight">
          {repoName ? (
            <>
              {reserveTitlebarInset ? (
                <div className="h-9 w-px bg-black/5 dark:bg-white/5" />
              ) : null}
              <Breadcrumb className="ml-3 min-w-0">
                <BreadcrumbList className="flex-nowrap">
                  <BreadcrumbItem>
                    <BreadcrumbPage className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                      <GitFork
                        strokeWidth={2}
                        className="size-3 shrink-0 text-neutral-500 dark:text-neutral-500"
                      />
                      <span className="truncate">{repoName}</span>
                    </BreadcrumbPage>
                  </BreadcrumbItem>

                  {branchName ? (
                    <>
                      <BreadcrumbSeparator className="text-neutral-400 dark:text-neutral-500">
                        <ChevronRight strokeWidth={2} className="size-2.5" />
                      </BreadcrumbSeparator>
                      <BreadcrumbItem>
                        <BranchSwitcherMenu
                          branchName={branchName}
                          branchQuery={branchQuery}
                          branches={filteredBranches}
                          canCreateBranch={canCreateBranch}
                          isBusy={isGitActionPending}
                          isOpen={isBranchMenuOpen}
                          searchInputRef={branchSearchInputRef}
                          onBranchQueryChange={setBranchQuery}
                          onCreateBranch={handleBranchCreate}
                          onOpenChange={handleBranchMenuOpenChange}
                          onSelectBranch={handleBranchSelect}
                        />
                      </BreadcrumbItem>
                    </>
                  ) : null}
                </BreadcrumbList>
              </Breadcrumb>
            </>
          ) : (
            <span className="text-xs font-medium tracking-tight text-neutral-500 dark:text-neutral-400">
              {activeWorkspaceLabel}
            </span>
          )}
        </div>

        <div
          className="h-full min-w-8 flex-1 cursor-grab bg-transparent active:cursor-grabbing"
          onMouseDown={handleWindowDragStart}
        />

        <ConversationHeaderActions
          isGitBusy={isGitActionPending}
          isOpenTargetBusy={isOpenTargetPending}
          onOpenCommitDialog={openCommitDialog}
          onPush={handlePush}
          onSelectOpenTarget={handleOpenTarget}
          openTargets={openTargets}
          preferredAppId={resolvedPreferredAppId}
        />
      </header>

      <CommitChangesDialog
        commitMessage={commitMessage}
        isOpen={isCommitDialogOpen}
        isSubmitting={isCommitPending}
        onClose={handleCommitDialogClose}
        onCommitMessageChange={setCommitMessage}
        onOpenChange={handleCommitDialogOpenChange}
        onSubmit={handleCommitSubmit}
      />
    </>
  );
}
