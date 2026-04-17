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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useConversationSession, useSessionActions } from "../hooks/useSession";
import { ChatThread } from "./ChatThread";
import { LandingScreen } from "./LandingScreen";
import { PromptComposer } from "./PromptComposer";
import { cn } from "../utils/cn";
import { handleWindowDragStart } from "../utils/window";

interface ConversationPanelProps {
  reserveTitlebarInset?: boolean;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function rankSearchFieldMatch(field: string, normalizedQuery: string): number {
  const normalizedField = normalizeSearchText(field);
  if (
    normalizedField.length === 0 ||
    !normalizedField.includes(normalizedQuery)
  ) {
    return Number.NEGATIVE_INFINITY;
  }
  if (normalizedField === normalizedQuery) {
    return 3;
  }
  if (normalizedField.startsWith(normalizedQuery)) {
    return 2;
  }
  return 1;
}

function rankBranchMatch(branchName: string, normalizedQuery: string): number {
  const searchTerms = [
    branchName,
    branchName.replace(/^origin\//, ""),
    ...branchName.split("/"),
  ].filter((term) => term.length > 0);

  for (const [index, field] of searchTerms.entries()) {
    const fieldRank = rankSearchFieldMatch(field, normalizedQuery);
    if (fieldRank !== Number.NEGATIVE_INFINITY) {
      return 1_000 - index * 100 + fieldRank;
    }
  }

  return Number.NEGATIVE_INFINITY;
}

const appTargets = [
  { id: "cursor", label: "Cursor", icon: BotIcon },
  { id: "zed", label: "Zed", icon: SquareTerminalIcon },
  { id: "file-manager", label: "Finder", icon: FolderIcon },
  { id: "terminal", label: "Terminal", icon: TerminalIcon },
  { id: "ghostty", label: "Ghostty", icon: GhostIcon },
  { id: "warp", label: "Warp", icon: SquareTerminalIcon },
  { id: "xcode", label: "Xcode", icon: HammerIcon },
  { id: "android-studio", label: "Android Studio", icon: SmartphoneIcon },
] as const;

type AppTarget = (typeof appTargets)[number];
type AppTargetId = AppTarget["id"];
type PendingHeaderAction =
  | "checkout"
  | "create-branch"
  | "commit"
  | "push"
  | "open-target";

const DEFAULT_APP_TARGET_ID: AppTargetId = appTargets[0].id;
const EMPTY_STRING_ARRAY: string[] = [];
const OPEN_IN_PREFERRED_APP_STORAGE_KEY = "agent-ui:preferred-open-app";

function ConversationHeaderActions({
  isGitBusy,
  isOpenTargetBusy,
  onOpenCommitDialog,
  onSelectOpenTarget,
  openTargets,
  onPush,
  preferredAppId,
}: {
  isGitBusy: boolean;
  isOpenTargetBusy: boolean;
  onOpenCommitDialog: () => void;
  onSelectOpenTarget: (appId: AppTargetId) => Promise<void>;
  openTargets: ReadonlyArray<AppTarget>;
  onPush: () => Promise<void>;
  preferredAppId: AppTargetId;
}) {
  const preferredApp =
    openTargets.find((target) => target.id === preferredAppId) ??
    openTargets[0] ??
    appTargets[0];
  const PreferredAppIcon = preferredApp.icon;

  return (
    <div className="relative z-20 ml-auto flex shrink-0 items-center gap-1.5">
      <ButtonGroup aria-label="Open with">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={`Open in ${preferredApp.label}`}
          disabled={openTargets.length === 0 || isOpenTargetBusy}
          onClick={() => {
            void onSelectOpenTarget(preferredApp.id);
          }}
        >
          <PreferredAppIcon />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Choose app"
                disabled={openTargets.length === 0 || isOpenTargetBusy}
              />
            }
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              {openTargets.length > 0 ? (
                openTargets.map(({ id, label, icon: Icon }) => (
                  <DropdownMenuItem
                    key={id}
                    disabled={isOpenTargetBusy}
                    onClick={() => {
                      void onSelectOpenTarget(id);
                    }}
                  >
                    <Icon />
                    {label}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>
                  No installed apps found
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>

      <ButtonGroup aria-label="Git actions">
        <Button
          variant="outline"
          size="sm"
          disabled={isGitBusy}
          onClick={onOpenCommitDialog}
        >
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
                disabled={isGitBusy}
              />
            }
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Git actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onOpenCommitDialog}
                disabled={isGitBusy}
              >
                <GitCommitHorizontalIcon />
                Commit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void onPush();
                }}
                disabled={isGitBusy}
              >
                <UploadIcon />
                Push
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <GitPullRequestCreateIcon />
                Create PR
              </DropdownMenuItem>
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
  const [isBranchMenuOpen, setIsBranchMenuOpen] = React.useState(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = React.useState(false);
  const [commitMessage, setCommitMessage] = React.useState("");
  const [preferredAppId, setPreferredAppId] = React.useState<AppTargetId>(
    DEFAULT_APP_TARGET_ID,
  );
  const [pendingHeaderAction, setPendingHeaderAction] =
    React.useState<PendingHeaderAction | null>(null);
  const branchSearchInputRef = React.useRef<HTMLInputElement | null>(null);
  const hasInitializedPreferredAppRef = React.useRef(false);
  const {
    activeWorkspaceLabel,
    hasCurrentWorkspace,
    isOpeningProject,
    messages,
    runtimeStatus,
    uiError,
  } = useConversationSession();
  const {
    checkoutBranch,
    commitChanges,
    createBranch,
    openInTarget,
    pushBranch,
  } = useSessionActions();
  const repoName = runtimeStatus?.gitRepoName;
  const branchName = runtimeStatus?.gitBranchName;
  const branchNames = runtimeStatus?.gitBranches ?? EMPTY_STRING_ARRAY;
  const availableOpenTargets =
    runtimeStatus?.availableOpenTargets ?? EMPTY_STRING_ARRAY;
  const openTargets = React.useMemo(
    () =>
      appTargets.filter((target) => availableOpenTargets.includes(target.id)),
    [availableOpenTargets],
  );
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
  const resolvedPreferredAppId =
    openTargets.length > 0 &&
    openTargets.some((target) => target.id === preferredAppId)
      ? preferredAppId
      : (openTargets[0]?.id ?? preferredAppId);
  const isGitActionPending =
    pendingHeaderAction === "checkout" ||
    pendingHeaderAction === "create-branch" ||
    pendingHeaderAction === "commit" ||
    pendingHeaderAction === "push";
  const isOpenTargetPending = pendingHeaderAction === "open-target";

  React.useEffect(() => {
    if (hasInitializedPreferredAppRef.current || openTargets.length === 0) {
      return;
    }

    const storedPreferredAppId = window.localStorage.getItem(
      OPEN_IN_PREFERRED_APP_STORAGE_KEY,
    ) as AppTargetId | null;
    const nextPreferredAppId =
      storedPreferredAppId &&
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
  }, [openTargets, resolvedPreferredAppId]);

  React.useEffect(() => {
    if (!isBranchMenuOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      branchSearchInputRef.current?.focus();
      branchSearchInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isBranchMenuOpen]);

  if (!hasCurrentWorkspace) {
    return (
      <LandingScreen
        isOpeningProject={isOpeningProject}
        runtimeStatus={runtimeStatus}
        uiError={uiError}
      />
    );
  }

  async function handleBranchSelect(candidate: string) {
    setPendingHeaderAction("checkout");
    try {
      await checkoutBranch(candidate);
      setIsBranchMenuOpen(false);
    } catch {
      return;
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
    } catch {
      return;
    } finally {
      setPendingHeaderAction(null);
    }
  }

  async function handlePush() {
    setPendingHeaderAction("push");
    try {
      await pushBranch();
    } catch {
      return;
    } finally {
      setPendingHeaderAction(null);
    }
  }

  async function handleOpenTarget(appId: AppTargetId) {
    if (!openTargets.some((target) => target.id === appId)) {
      return;
    }

    setPreferredAppId(appId);
    setPendingHeaderAction("open-target");
    try {
      await openInTarget(appId);
    } catch {
      return;
    } finally {
      setPendingHeaderAction((current) =>
        current === "open-target" ? null : current,
      );
    }
  }

  async function handleCommitSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = commitMessage.trim();
    if (trimmedMessage.length === 0) {
      return;
    }

    setPendingHeaderAction("commit");
    try {
      await commitChanges(trimmedMessage);
      setCommitMessage("");
      setIsCommitDialogOpen(false);
    } catch {
      return;
    } finally {
      setPendingHeaderAction(null);
    }
  }

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
                          open={isBranchMenuOpen}
                          onOpenChange={(open) => {
                            setIsBranchMenuOpen(open);
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
                                disabled={isGitActionPending}
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
                          <DropdownMenuContent align="start" className="w-64">
                            <div className="p-1">
                              <Input
                                ref={branchSearchInputRef}
                                value={branchQuery}
                                onChange={(event) =>
                                  setBranchQuery(event.target.value)
                                }
                                onKeyDownCapture={(event) => {
                                  if (event.key !== "Escape") {
                                    event.stopPropagation();
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" &&
                                    canCreateBranch &&
                                    !isGitActionPending
                                  ) {
                                    event.preventDefault();
                                    void handleBranchCreate();
                                  }
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
                                      void handleBranchCreate();
                                    }}
                                    disabled={isGitActionPending}
                                  >
                                    <GitBranchIcon />
                                    Create branch "{branchQuery.trim()}"
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              ) : null}
                              {filteredBranches.length > 0 ? (
                                filteredBranches.map((candidate) => (
                                  <DropdownMenuItem
                                    key={candidate}
                                    disabled={
                                      candidate === branchName ||
                                      isGitActionPending
                                    }
                                    onClick={() => {
                                      void handleBranchSelect(candidate);
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
          onOpenCommitDialog={() => setIsCommitDialogOpen(true)}
          onSelectOpenTarget={handleOpenTarget}
          openTargets={openTargets}
          onPush={handlePush}
          preferredAppId={resolvedPreferredAppId}
        />
      </header>

      <Dialog
        open={isCommitDialogOpen}
        onOpenChange={(open) => {
          if (pendingHeaderAction === "commit") {
            return;
          }

          setIsCommitDialogOpen(open);
          if (!open) {
            setCommitMessage("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <form className="space-y-4" onSubmit={handleCommitSubmit}>
            <DialogHeader>
              <DialogTitle>Commit changes</DialogTitle>
              <DialogDescription>
                Create a git commit for the current workspace.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder="Commit message"
              disabled={pendingHeaderAction === "commit"}
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCommitDialogOpen(false);
                  setCommitMessage("");
                }}
                disabled={pendingHeaderAction === "commit"}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  pendingHeaderAction === "commit" ||
                  commitMessage.trim().length === 0
                }
              >
                Commit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {uiError ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-red-700 dark:text-red-400"
          role="alert"
        >
          {uiError}
        </div>
      ) : null}

      {runtimeStatus?.configured === false ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-amber-700 dark:text-amber-400"
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
