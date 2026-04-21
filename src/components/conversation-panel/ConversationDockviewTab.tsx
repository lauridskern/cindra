import { ChevronRight, GitFork } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import type { ChatBinding } from "@/services/desktop/contracts";

import { BranchSwitcherMenu } from "./BranchSwitcherMenu";
import { useConversationHeaderState } from "./useConversationHeaderState";

interface ConversationDockviewTabProps {
  binding?: ChatBinding | null;
}

export function ConversationDockviewTab({
  binding,
}: ConversationDockviewTabProps) {
  const {
    activeWorkspaceLabel,
    branchName,
    branchQuery,
    branchSearchInputRef,
    canCreateBranch,
    filteredBranches,
    isBranchMenuOpen,
    isGitActionPending,
    repoName,
    setBranchQuery,
    handleBranchCreate,
    handleBranchMenuOpenChange,
    handleBranchSelect,
  } = useConversationHeaderState(binding);

  return (
    <div className="chat-pane-dockview-tab flex h-full min-w-0 items-center pl-3">
      <div className="relative z-20 flex min-w-0 shrink items-center overflow-hidden text-xs font-medium tracking-tight">
        {repoName ? (
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="min-w-0 flex-nowrap">
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="pointer-events-none inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                  <GitFork
                    strokeWidth={2}
                    className="size-3 shrink-0 text-neutral-500 dark:text-neutral-500"
                  />
                  <span className="truncate">{repoName}</span>
                </BreadcrumbPage>
              </BreadcrumbItem>

              {branchName ? (
                <BreadcrumbItem className="min-w-0">
                  <div
                    className="ml-1.5 flex min-w-0 shrink items-center gap-0"
                    onPointerDownCapture={(event) => {
                      event.stopPropagation();
                    }}
                    onDragStartCapture={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <ChevronRight
                      strokeWidth={2}
                      className="size-2.5 shrink-0 text-neutral-400 dark:text-neutral-500"
                    />
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
                      triggerClassName="ml-0"
                    />
                  </div>
                </BreadcrumbItem>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <span className="pointer-events-none truncate text-xs font-medium tracking-tight text-neutral-500 dark:text-neutral-400">
            {activeWorkspaceLabel}
          </span>
        )}
      </div>
    </div>
  );
}
