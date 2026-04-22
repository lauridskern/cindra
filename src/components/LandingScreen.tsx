import { useState, type FormEvent } from "react";
import { FolderOpen, GitBranchPlus, LoaderCircle, Rocket } from "lucide-react";

import { useConversationActions } from "../hooks/useConversationActions";
import {
  useConversationSession,
  usePromptDraft,
  useSessionActions,
} from "../hooks/useSession";
import * as desktopClient from "../services/desktop/client";
import type {
  ChatBinding,
  FollowupRequest,
  PromptSettings,
  QuickStartProjectInput,
} from "../services/desktop/contracts";
import { formatError } from "../utils/errors";
import { FollowupComposer } from "./FollowupComposer";
import { PromptInputCard } from "./PromptInputCard";
import { ConversationSurface } from "./conversation-panel/ConversationSurface";
import { Button } from "./ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const REPOSITORY_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

interface LandingScreenProps {
  binding?: ChatBinding | null;
  embedded?: boolean;
}

interface LandingScreenControllerProps {
  isOpeningProject: boolean;
  uiError: string | null;
}

interface CloneFormState {
  repositoryUrl: string;
  parentDirectory: string;
  directoryName: string;
}

type QuickStartFormState = QuickStartProjectInput;

type PendingAction = "clone" | "quick-start" | null;

const initialCloneFormState: CloneFormState = {
  repositoryUrl: "",
  parentDirectory: "",
  directoryName: "",
};

const initialQuickStartFormState: QuickStartFormState = {
  projectName: "",
  parentDirectory: "",
  visibility: "private",
};

export function LandingScreen({
  binding,
  embedded = false,
}: LandingScreenProps) {
  const {
    activeWorkspaceConfigurationError,
    activeWorkspaceConfigured,
    activeWorkspaceLabel,
    hasCurrentWorkspace,
    isOpeningProject,
    uiError,
    workspaceKind,
  } = useConversationSession(binding);
  const { submitPrompt, updatePromptSettings } = useConversationActions(binding);
  const {
    canCompose,
    followupRequest,
    isSendingPrompt,
    promptSettings,
    promptDraft,
    setPromptDraft,
  } = usePromptDraft(binding);
  const controller = useLandingScreenController({
    isOpeningProject,
    uiError,
  });

  const content = (
    <LandingScreenContent
      activeWorkspaceConfigurationError={activeWorkspaceConfigurationError}
      activeWorkspaceConfigured={activeWorkspaceConfigured}
      canCompose={canCompose}
      followupRequest={followupRequest}
      hasCurrentWorkspace={hasCurrentWorkspace}
      isBusy={controller.isBusy}
      isOpeningProject={isOpeningProject}
      isSendingPrompt={isSendingPrompt}
      onOpenClone={controller.openCloneDialog}
      onOpenFolder={() => void controller.handleOpenWorkspacePicker()}
      onOpenQuickStart={controller.openQuickStartDialog}
      promptDraft={promptDraft}
      promptSettings={promptSettings}
      setPromptDraft={setPromptDraft}
      submitPrompt={submitPrompt}
      updatePromptSettings={updatePromptSettings}
      visibleError={controller.visibleError}
      workspaceLabel={activeWorkspaceLabel}
      workspaceKind={workspaceKind}
    />
  );

  return (
    <>
      {embedded ? (
        content
      ) : (
        <ConversationSurface className="text-neutral-950 dark:text-neutral-100">
          {content}
        </ConversationSurface>
      )}

      <CloneRepositoryDialog
        cloneForm={controller.cloneForm}
        cloneFormValid={controller.cloneFormValid}
        isBusy={controller.isBusy}
        isOpen={controller.cloneDialogOpen}
        isSubmitting={controller.pendingAction === "clone"}
        onClose={() => controller.handleCloneDialogChange(false)}
        onDestinationPick={controller.handleCloneDestinationPick}
        onDirectoryNameChange={controller.handleCloneDirectoryNameChange}
        onOpenChange={controller.handleCloneDialogChange}
        onParentDirectoryChange={controller.handleCloneParentDirectoryChange}
        onRepositoryUrlChange={controller.handleCloneRepositoryUrlChange}
        onSubmit={controller.handleCloneSubmit}
      />

      <QuickStartProjectDialog
        isBusy={controller.isBusy}
        isOpen={controller.quickStartDialogOpen}
        isSubmitting={controller.pendingAction === "quick-start"}
        onClose={() => controller.handleQuickStartDialogChange(false)}
        onDestinationPick={controller.handleQuickStartDestinationPick}
        onOpenChange={controller.handleQuickStartDialogChange}
        onParentDirectoryChange={controller.handleQuickStartParentDirectoryChange}
        onProjectNameChange={controller.handleQuickStartProjectNameChange}
        onSubmit={controller.handleQuickStartSubmit}
        onVisibilityChange={controller.handleQuickStartVisibilityChange}
        quickStartForm={controller.quickStartForm}
        quickStartFormValid={controller.quickStartFormValid}
      />
    </>
  );
}

function useLandingScreenController({
  isOpeningProject,
  uiError,
}: LandingScreenControllerProps) {
  const { openProject, openWorkspacePicker } = useSessionActions();
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [quickStartDialogOpen, setQuickStartDialogOpen] = useState(false);
  const [cloneForm, setCloneForm] = useState<CloneFormState>(
    initialCloneFormState,
  );
  const [quickStartForm, setQuickStartForm] = useState<QuickStartFormState>(
    initialQuickStartFormState,
  );
  const [cloneDirectoryManuallyEdited, setCloneDirectoryManuallyEdited] =
    useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isBusy = isOpeningProject || pendingAction != null;
  const visibleError = actionError ?? uiError;
  const cloneFormValid =
    cloneForm.repositoryUrl.trim().length > 0 &&
    cloneForm.parentDirectory.trim().length > 0 &&
    REPOSITORY_NAME_PATTERN.test(cloneForm.directoryName.trim());
  const quickStartFormValid =
    REPOSITORY_NAME_PATTERN.test(quickStartForm.projectName.trim()) &&
    quickStartForm.parentDirectory.trim().length > 0;

  function resetCloneForm() {
    setCloneForm(initialCloneFormState);
    setCloneDirectoryManuallyEdited(false);
  }

  function resetQuickStartForm() {
    setQuickStartForm(initialQuickStartFormState);
  }

  function clearActionError() {
    setActionError(null);
  }

  function openCloneDialog() {
    clearActionError();
    setCloneDialogOpen(true);
  }

  function openQuickStartDialog() {
    clearActionError();
    setQuickStartDialogOpen(true);
  }

  function handleCloneDialogChange(open: boolean) {
    if (pendingAction != null) {
      return;
    }

    setCloneDialogOpen(open);
    if (open === false) {
      resetCloneForm();
    }
  }

  function handleQuickStartDialogChange(open: boolean) {
    if (pendingAction != null) {
      return;
    }

    setQuickStartDialogOpen(open);
    if (open === false) {
      resetQuickStartForm();
    }
  }

  function handleCloneRepositoryUrlChange(value: string) {
    setCloneForm((current) => {
      const nextDerivedName = deriveDirectoryNameFromRepositoryUrl(value);
      const previousDerivedName = deriveDirectoryNameFromRepositoryUrl(
        current.repositoryUrl,
      );
      const shouldSyncDirectoryName =
        cloneDirectoryManuallyEdited === false ||
        current.directoryName.trim().length === 0 ||
        current.directoryName === previousDerivedName;

      return {
        ...current,
        repositoryUrl: value,
        directoryName: shouldSyncDirectoryName
          ? nextDerivedName
          : current.directoryName,
      };
    });
  }

  function handleCloneParentDirectoryChange(value: string) {
    setCloneForm((current) => ({
      ...current,
      parentDirectory: value,
    }));
  }

  function handleCloneDirectoryNameChange(value: string) {
    setCloneDirectoryManuallyEdited(true);
    setCloneForm((current) => ({
      ...current,
      directoryName: value,
    }));
  }

  function handleQuickStartProjectNameChange(value: string) {
    setQuickStartForm((current) => ({
      ...current,
      projectName: value,
    }));
  }

  function handleQuickStartParentDirectoryChange(value: string) {
    setQuickStartForm((current) => ({
      ...current,
      parentDirectory: value,
    }));
  }

  function handleQuickStartVisibilityChange(
    visibility: QuickStartFormState["visibility"],
  ) {
    setQuickStartForm((current) => ({
      ...current,
      visibility,
    }));
  }

  async function pickDirectory(
    title: string,
    onSelect: (parentDirectory: string) => void,
  ) {
    clearActionError();
    const parentDirectory = await desktopClient.pickDirectory(title).catch(
      (error) => {
        setActionError(formatError(error));
        return null;
      },
    );

    if (parentDirectory != null) {
      onSelect(parentDirectory);
    }
  }

  async function handleCloneDestinationPick() {
    await pickDirectory(
      "Choose a folder for the cloned repository",
      handleCloneParentDirectoryChange,
    );
  }

  async function handleQuickStartDestinationPick() {
    await pickDirectory(
      "Choose a folder for the new GitHub project",
      handleQuickStartParentDirectoryChange,
    );
  }

  async function runWorkspaceSetupAction(
    action: Exclude<PendingAction, null>,
    operation: () => Promise<string | null>,
    onSuccess: () => void,
  ) {
    clearActionError();
    setPendingAction(action);

    const workspacePath = await operation();
    if (workspacePath != null) {
      await openProject(workspacePath);
      onSuccess();
    }

    setPendingAction(null);
  }

  async function handleCloneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cloneFormValid === false || isBusy) {
      return;
    }

    await runWorkspaceSetupAction(
      "clone",
      async () =>
        await desktopClient
          .cloneRepository({
            repositoryUrl: cloneForm.repositoryUrl.trim(),
            parentDirectory: cloneForm.parentDirectory.trim(),
            directoryName: cloneForm.directoryName.trim(),
          })
          .catch((error) => {
            setActionError(formatError(error));
            return null;
          }),
      () => {
        setCloneDialogOpen(false);
        resetCloneForm();
      },
    );
  }

  async function handleQuickStartSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (quickStartFormValid === false || isBusy) {
      return;
    }

    await runWorkspaceSetupAction(
      "quick-start",
      async () =>
        await desktopClient
          .quickStartProject({
            projectName: quickStartForm.projectName.trim(),
            parentDirectory: quickStartForm.parentDirectory.trim(),
            visibility: quickStartForm.visibility,
          })
          .catch((error) => {
            setActionError(formatError(error));
            return null;
          }),
      () => {
        setQuickStartDialogOpen(false);
        resetQuickStartForm();
      },
    );
  }

  async function handleOpenWorkspacePicker() {
    clearActionError();
    await openWorkspacePicker();
  }

  return {
    cloneDialogOpen,
    cloneForm,
    cloneFormValid,
    handleCloneDestinationPick,
    handleCloneDirectoryNameChange,
    handleCloneDialogChange,
    handleCloneParentDirectoryChange,
    handleCloneRepositoryUrlChange,
    handleCloneSubmit,
    handleOpenWorkspacePicker,
    handleQuickStartDestinationPick,
    handleQuickStartDialogChange,
    handleQuickStartParentDirectoryChange,
    handleQuickStartProjectNameChange,
    handleQuickStartSubmit,
    handleQuickStartVisibilityChange,
    isBusy,
    openCloneDialog,
    openQuickStartDialog,
    pendingAction,
    quickStartDialogOpen,
    quickStartForm,
    quickStartFormValid,
    visibleError,
  };
}

function LandingScreenContent({
  activeWorkspaceConfigurationError,
  activeWorkspaceConfigured,
  canCompose,
  followupRequest,
  hasCurrentWorkspace,
  isBusy,
  isOpeningProject,
  isSendingPrompt,
  onOpenClone,
  onOpenFolder,
  onOpenQuickStart,
  promptDraft,
  promptSettings,
  setPromptDraft,
  submitPrompt,
  updatePromptSettings,
  visibleError,
  workspaceLabel,
  workspaceKind,
}: {
  activeWorkspaceConfigurationError: string | null;
  activeWorkspaceConfigured: boolean;
  canCompose: boolean;
  followupRequest: FollowupRequest | null;
  hasCurrentWorkspace: boolean;
  isBusy: boolean;
  isOpeningProject: boolean;
  isSendingPrompt: boolean;
  onOpenClone: () => void;
  onOpenFolder: () => void;
  onOpenQuickStart: () => void;
  promptDraft: string;
  promptSettings: PromptSettings | null;
  setPromptDraft: (value: string) => void;
  submitPrompt: () => Promise<void>;
  updatePromptSettings: (input: {
    providerId: string;
    modelId: string;
    reasoningEffort?: string | null;
  }) => Promise<void>;
  visibleError: string | null;
  workspaceLabel: string;
  workspaceKind: "project" | "managed_chat";
}) {
  const heading = hasCurrentWorkspace
    ? (workspaceKind === "managed_chat"
        ? "Ask anything"
        : `Ask anything about ${workspaceLabel}`)
    : "Open a project to start a chat";

  return (
    <div className="flex min-h-0 flex-1 overflow-auto px-6 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6">
        <div className="flex w-full max-w-3xl flex-col items-center text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {heading}
          </h2>
        </div>

        <div className="w-full max-w-3xl">
          {visibleError ? (
            <p
              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
              role="alert"
            >
              {visibleError}
            </p>
          ) : null}

          {activeWorkspaceConfigured === false ? (
            <p
              className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
              role="alert"
            >
              {activeWorkspaceConfigurationError ??
                "No session is configured. Configure the terminal session first."}
            </p>
          ) : null}
        </div>

        <div className="w-full max-w-3xl">
          {followupRequest != null ? (
            <FollowupComposer
              key={followupRequest.followupId}
              followupRequest={followupRequest}
            />
          ) : (
            <PromptInputCard
              canCompose={canCompose}
              isSendingPrompt={isSendingPrompt}
              placeholder={
                workspaceKind === "managed_chat"
                  ? "Ask anything…"
                  : hasCurrentWorkspace
                    ? "Ask about this workspace…"
                  : "Open a project to start a chat…"
              }
              promptDraft={promptDraft}
              promptSettings={promptSettings}
              setPromptDraft={setPromptDraft}
              submitPrompt={submitPrompt}
              updatePromptSettings={updatePromptSettings}
            />
          )}
        </div>

        <div className="grid w-full max-w-3xl gap-4 md:grid-cols-3">
          <LaunchCard
            description="Pick a local folder and open it as the active workspace."
            disabled={isBusy}
            icon={FolderOpen}
            label={isOpeningProject ? "Opening..." : "Open folder"}
            onClick={onOpenFolder}
          />
          <LaunchCard
            description="Clone a repository and jump straight into a new chat."
            disabled={isBusy}
            icon={GitBranchPlus}
            label="Clone from Git"
            onClick={onOpenClone}
          />
          <LaunchCard
            description="Create a fresh GitHub repo, clone it locally, and open it."
            disabled={isBusy}
            icon={Rocket}
            label="Quick start"
            onClick={onOpenQuickStart}
          />
        </div>
      </div>
    </div>
  );
}

function CloneRepositoryDialog({
  cloneForm,
  cloneFormValid,
  isBusy,
  isOpen,
  isSubmitting,
  onClose,
  onDestinationPick,
  onDirectoryNameChange,
  onOpenChange,
  onParentDirectoryChange,
  onRepositoryUrlChange,
  onSubmit,
}: {
  cloneForm: CloneFormState;
  cloneFormValid: boolean;
  isBusy: boolean;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onDestinationPick: () => Promise<void>;
  onDirectoryNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onParentDirectoryChange: (value: string) => void;
  onRepositoryUrlChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>Clone from Git</DialogTitle>
          <DialogDescription>
            Pull a remote repository into a local folder and open it as the
            active workspace.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="clone-repository-url">Repository URL</Label>
            <Input
              id="clone-repository-url"
              placeholder="git@github.com:owner/repo.git"
              value={cloneForm.repositoryUrl}
              onChange={(event) => onRepositoryUrlChange(event.target.value)}
              disabled={isBusy}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clone-parent-directory">Destination folder</Label>
            <div className="flex gap-2">
              <Input
                id="clone-parent-directory"
                placeholder="Choose where the repository should live"
                value={cloneForm.parentDirectory}
                onChange={(event) => onParentDirectoryChange(event.target.value)}
                disabled={isBusy}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void onDestinationPick()}
                disabled={isBusy}
              >
                Choose
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="clone-directory-name">Project folder name</Label>
            <Input
              id="clone-directory-name"
              placeholder="repo-name"
              value={cloneForm.directoryName}
              onChange={(event) => onDirectoryNameChange(event.target.value)}
              disabled={isBusy}
            />
            <p className="text-xs text-muted-foreground">
              Letters, numbers, dots, underscores, and dashes only.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!cloneFormValid || isBusy}>
              {isSubmitting ? (
                <>
                  <LoaderCircle
                    strokeWidth={2}
                    className="size-3.5 animate-spin"
                  />
                  Cloning...
                </>
              ) : (
                "Clone and open"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuickStartProjectDialog({
  isBusy,
  isOpen,
  isSubmitting,
  onClose,
  onDestinationPick,
  onOpenChange,
  onParentDirectoryChange,
  onProjectNameChange,
  onSubmit,
  onVisibilityChange,
  quickStartForm,
  quickStartFormValid,
}: {
  isBusy: boolean;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onDestinationPick: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onParentDirectoryChange: (value: string) => void;
  onProjectNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onVisibilityChange: (value: QuickStartFormState["visibility"]) => void;
  quickStartForm: QuickStartFormState;
  quickStartFormValid: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>Quick start</DialogTitle>
          <DialogDescription>
            Create a GitHub repository with the GitHub CLI, clone it locally,
            and open it as the current workspace.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="quick-start-project-name">Project name</Label>
            <Input
              id="quick-start-project-name"
              placeholder="my-agent-project"
              value={quickStartForm.projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
              disabled={isBusy}
            />
            <p className="text-xs text-muted-foreground">
              This becomes both the GitHub repo name and the local folder.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quick-start-parent-directory">
              Destination folder
            </Label>
            <div className="flex gap-2">
              <Input
                id="quick-start-parent-directory"
                placeholder="Choose where the new project should live"
                value={quickStartForm.parentDirectory}
                onChange={(event) => onParentDirectoryChange(event.target.value)}
                disabled={isBusy}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void onDestinationPick()}
                disabled={isBusy}
              >
                Choose
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Visibility</Label>
            <div className="grid grid-cols-2 gap-2">
              <VisibilityButton
                active={quickStartForm.visibility === "private"}
                disabled={isBusy}
                onClick={() => onVisibilityChange("private")}
                value="Private"
              />
              <VisibilityButton
                active={quickStartForm.visibility === "public"}
                disabled={isBusy}
                onClick={() => onVisibilityChange("public")}
                value="Public"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!quickStartFormValid || isBusy}>
              {isSubmitting ? (
                <>
                  <LoaderCircle
                    strokeWidth={2}
                    className="size-3.5 animate-spin"
                  />
                  Creating...
                </>
              ) : (
                "Create and open"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LaunchCard({
  description,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  description: string;
  disabled: boolean;
  icon: typeof FolderOpen;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="block h-full w-full appearance-none text-left disabled:cursor-not-allowed"
      onClick={onClick}
      disabled={disabled}
    >
      <Card className="h-full min-h-40 border-0 bg-accent/60 transition-colors hover:bg-accent dark:bg-accent/80 dark:hover:bg-accent">
        <CardHeader>
          <CardAction className="justify-self-start">
            <div className="flex size-10 items-center justify-center rounded-md border border-input bg-input/20 text-muted-foreground dark:bg-input/30">
              <Icon strokeWidth={2} className="size-3.5" />
            </div>
          </CardAction>
          <CardTitle>{label}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1" />
      </Card>
    </button>
  );
}

function VisibilityButton({
  active,
  disabled,
  onClick,
  value,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  value: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      className="justify-center"
      onClick={onClick}
      disabled={disabled}
    >
      {value}
    </Button>
  );
}

function deriveDirectoryNameFromRepositoryUrl(repositoryUrl: string): string {
  const trimmed = repositoryUrl.trim().replace(/\/+$/, "");
  if (trimmed.length === 0) {
    return "";
  }

  const lastSegment = trimmed.split(/[:/]/).at(-1) ?? "";
  return lastSegment.replace(/\.git$/i, "");
}
