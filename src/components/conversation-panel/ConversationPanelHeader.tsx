import { ChevronRight, GitFork } from "lucide-react";
import type { ChatBinding } from "@/services/desktop/contracts";

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
  binding?: ChatBinding | null;
  canCloseChat?: () => boolean;
  onCloseChat?: () => void;
  onOpenPreview?: () => void;
  onOpenTerminal?: () => void;
  reserveTitlebarInset: boolean;
  windowDragEnabled: boolean;
}

export function ConversationPanelHeader({
  binding,
  canCloseChat,
  onCloseChat,
  onOpenPreview,
  onOpenTerminal,
  reserveTitlebarInset,
  windowDragEnabled,
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
  } = useConversationHeaderState(binding);
  const windowDragClassName = cn(
    "bg-transparent",
    windowDragEnabled && "cursor-grab active:cursor-grabbing",
  );

  return (
    <>
      <header
        className={cn(
          "flex h-9.5 items-center gap-3 border-b border-black/5 pr-1.5 select-none dark:border-white/5",
          reserveTitlebarInset ? "pl-34" : "pl-3",
        )}
      >
        <div className="relative z-20 flex min-w-0 shrink items-center overflow-hidden text-xs font-medium tracking-tight">
          {repoName ? (
            <>
              {reserveTitlebarInset ? (
                <div className="mr-3 h-9 w-px shrink-0 bg-black/5 dark:bg-white/5" />
              ) : null}
              <Breadcrumb className="min-w-0">
                <BreadcrumbList className="min-w-0 flex-nowrap">
                  <BreadcrumbItem className="min-w-0">
                    <div
                      role="presentation"
                      className={cn(
                        "inline-flex min-w-0 items-center",
                        windowDragClassName,
                      )}
                      onMouseDown={windowDragEnabled ? handleWindowDragStart : undefined}
                    >
                      <BreadcrumbPage className="pointer-events-none inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                        <GitFork
                          strokeWidth={2}
                          className="size-3 shrink-0 text-neutral-500 dark:text-neutral-500"
                        />
                        <span className="truncate">{repoName}</span>
                      </BreadcrumbPage>
                    </div>
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
            <div
              role="presentation"
              className={cn("min-w-0", windowDragClassName)}
              onMouseDown={windowDragEnabled ? handleWindowDragStart : undefined}
            >
              <span className="pointer-events-none truncate text-xs font-medium tracking-tight text-neutral-500 dark:text-neutral-400">
                {activeWorkspaceLabel}
              </span>
            </div>
          )}
        </div>

        <div
          role="presentation"
          className={cn("h-full min-w-8 flex-1", windowDragClassName)}
          onMouseDown={windowDragEnabled ? handleWindowDragStart : undefined}
        />

        <ConversationHeaderActions
          canCloseChat={canCloseChat}
          isGitBusy={isGitActionPending}
          isOpenTargetBusy={isOpenTargetPending}
          onCloseChat={onCloseChat}
          onOpenCommitDialog={openCommitDialog}
          onOpenPreview={onOpenPreview}
          onOpenTerminal={onOpenTerminal}
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
