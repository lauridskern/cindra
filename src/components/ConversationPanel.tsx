import * as React from "react";
import {
  BotIcon,
  ChevronDownIcon,
  ChevronRight,
  FolderIcon,
  GhostIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  GitFork,
  GitPullRequestCreateIcon,
  HammerIcon,
  SmartphoneIcon,
  SquareTerminalIcon,
  TerminalIcon,
  UploadIcon,
} from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { useConversationSession } from "../hooks/useSession";
import { ChatThread } from "./ChatThread";
import { LandingScreen } from "./LandingScreen";
import { PromptComposer } from "./PromptComposer";
import { cn } from "../utils/cn";
import { handleWindowDragStart } from "../utils/window";

interface ConversationPanelProps {
  reserveTitlebarInset?: boolean;
}

const appTargets = [
  { label: "Cursor", icon: BotIcon },
  { label: "Zed", icon: SquareTerminalIcon },
  { label: "Finder", icon: FolderIcon },
  { label: "Terminal", icon: TerminalIcon },
  { label: "Ghostty", icon: GhostIcon },
  { label: "Warp", icon: SquareTerminalIcon },
  { label: "Xcode", icon: HammerIcon },
  { label: "Android Studio", icon: SmartphoneIcon },
] as const;

const gitActions = [
  { label: "Commit", icon: GitCommitHorizontalIcon },
  { label: "Push", icon: UploadIcon },
  { label: "Create PR", icon: GitPullRequestCreateIcon, disabled: true },
  { label: "Create branch", icon: GitBranchIcon },
] as const;

function ConversationHeaderActions() {
  return (
    <div className="relative z-20 ml-auto flex shrink-0 items-center gap-1.5">
      <ButtonGroup aria-label="Open with">
        <Button variant="outline" size="icon-sm" aria-label="Open in Zed">
          <SquareTerminalIcon />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Choose app"
              />
            }
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              {appTargets.map(({ label, icon: Icon }) => (
                <DropdownMenuItem key={label}>
                  <Icon />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>

      <ButtonGroup aria-label="Git actions">
        <Button variant="outline" size="sm">
          <GitCommitHorizontalIcon data-icon="inline-start" />
          Commit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="More git actions"
              />
            }
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Git actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {gitActions.map(({ label, icon: Icon, disabled }) => (
                <DropdownMenuItem key={label} disabled={disabled}>
                  <Icon />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </div>
  );
}

export function ConversationPanel({
  reserveTitlebarInset = false,
}: ConversationPanelProps) {
  const [branchQuery, setBranchQuery] = React.useState("");
  const {
    activeWorkspaceLabel,
    hasCurrentWorkspace,
    isOpeningProject,
    messages,
    runtimeStatus,
    uiError,
  } = useConversationSession();

  if (!hasCurrentWorkspace) {
    return (
      <LandingScreen
        isOpeningProject={isOpeningProject}
        runtimeStatus={runtimeStatus}
        uiError={uiError}
      />
    );
  }

  const repoName = runtimeStatus?.gitRepoName;
  const branchName = runtimeStatus?.gitBranchName;
  const filteredBranches = (runtimeStatus?.gitBranches ?? []).filter(
    (candidate) =>
      candidate.toLowerCase().includes(branchQuery.trim().toLowerCase()),
  );

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-white/60 bg-white/80 shadow-xl shadow-neutral-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/20">
      <header
        className={cn(
          "flex h-9.5 items-center gap-3 border-b border-black/5 pr-1.5 select-none dark:border-white/5",
          reserveTitlebarInset && "pl-34",
        )}
      >
        <div
          className={cn(
            "relative z-20 flex min-w-fit shrink-0 items-center text-xs font-medium tracking-tight",
          )}
        >
          {repoName ? (
            <>
              {reserveTitlebarInset && (
                <div className="h-9 w-px bg-black/5 dark:bg-white/5" />
              )}
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
                        <DropdownMenu
                          onOpenChange={(open) => {
                            if (!open) {
                              setBranchQuery("");
                            }
                          }}
                        >
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="xs"
                                aria-label="Choose git branch"
                                className="h-auto gap-1 rounded-sm px-1.5 py-1 text-xs font-medium text-neutral-800 hover:text-foreground dark:text-neutral-400 dark:hover:text-neutral-100 -ml-2"
                              />
                            }
                          >
                            <span className="truncate">{branchName}</span>
                            <ChevronDownIcon
                              strokeWidth={2}
                              className="size-3"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            <div className="p-1">
                              <Input
                                value={branchQuery}
                                onChange={(event) =>
                                  setBranchQuery(event.target.value)
                                }
                                placeholder="Search branches"
                                autoFocus
                              />
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              {filteredBranches.length > 0 ? (
                                filteredBranches.map((candidate) => (
                                  <DropdownMenuItem
                                    key={candidate}
                                    disabled={candidate === branchName}
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
        <ConversationHeaderActions />
      </header>

      {uiError ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-red-700 max-md:mx-4 dark:text-red-400"
          role="alert"
        >
          {uiError}
        </div>
      ) : null}

      {runtimeStatus?.configured === false ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-amber-700 max-md:mx-4 dark:text-amber-400"
          role="alert"
        >
          {runtimeStatus.configurationError ??
            "No session is configured. Configure the terminal session first."}
        </div>
      ) : null}

      <section className="min-h-0 flex-1 overflow-hidden select-text">
        <ChatThread messages={messages} />
      </section>

      <PromptComposer />
    </section>
  );
}
