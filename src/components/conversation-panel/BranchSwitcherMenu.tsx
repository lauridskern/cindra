import * as React from "react";
import { ChevronDownIcon, GitBranchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface BranchSwitcherMenuProps {
  branchName: string;
  branchQuery: string;
  branches: readonly string[];
  canCreateBranch: boolean;
  isBusy: boolean;
  isOpen: boolean;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onBranchQueryChange: (value: string) => void;
  onCreateBranch: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onSelectBranch: (branchName: string) => Promise<void>;
  triggerClassName?: string;
}

export function BranchSwitcherMenu({
  branchName,
  branchQuery,
  branches,
  canCreateBranch,
  isBusy,
  isOpen,
  searchInputRef,
  onBranchQueryChange,
  onCreateBranch,
  onOpenChange,
  onSelectBranch,
  triggerClassName,
}: BranchSwitcherMenuProps) {
  const trimmedQuery = branchQuery.trim();

  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            aria-label="Choose git branch"
            disabled={isBusy}
            className={cn(
              "-ml-2 h-auto min-h-0 gap-1 rounded-sm px-1.5 py-0.5 text-xs leading-none font-medium text-neutral-800 hover:text-foreground dark:text-neutral-400 dark:hover:text-neutral-100",
              triggerClassName,
            )}
          />
        }
      >
        <span className="truncate">{branchName}</span>
        <ChevronDownIcon strokeWidth={2} className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="p-1">
          <Input
            ref={searchInputRef}
            value={branchQuery}
            onChange={(event) => {
              onBranchQueryChange(event.target.value);
            }}
            onKeyDownCapture={(event) => {
              if (event.key !== "Escape") {
                event.stopPropagation();
              }
            }}
            onKeyDown={(event) => {
              if (!canCreateBranch || isBusy || event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              void onCreateBranch();
            }}
            placeholder="Search branches"
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {canCreateBranch ? (
            <>
              <DropdownMenuItem
                onClick={() => {
                  void onCreateBranch();
                }}
                disabled={isBusy}
              >
                <GitBranchIcon />
                Create branch "{trimmedQuery}"
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {branches.length > 0 ? (
            branches.map((candidate) => (
              <DropdownMenuItem
                key={candidate}
                disabled={candidate === branchName || isBusy}
                onClick={() => {
                  void onSelectBranch(candidate);
                }}
              >
                <GitBranchIcon />
                {candidate}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              <GitBranchIcon />
              No branches found
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
