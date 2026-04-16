import { useState, type FormEvent } from 'react'
import {
  FolderOpen,
  GitBranchPlus,
  LoaderCircle,
  Rocket,
} from 'lucide-react'

import { useSessionActions } from '../hooks/useSession'
import * as desktopClient from '../services/desktop/client'
import type {
  QuickStartProjectInput,
  RuntimeStatus,
} from '../services/desktop/contracts'
import { formatError } from '../utils/errors'
import { Button } from './ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'

const REPOSITORY_NAME_PATTERN = /^[A-Za-z0-9._-]+$/

interface LandingScreenProps {
  isOpeningProject: boolean
  runtimeStatus: RuntimeStatus | null
  uiError: string | null
}

interface CloneFormState {
  repositoryUrl: string
  parentDirectory: string
  directoryName: string
}

interface QuickStartFormState extends QuickStartProjectInput {}

type PendingAction = 'clone' | 'quick-start' | null

const initialCloneFormState: CloneFormState = {
  repositoryUrl: '',
  parentDirectory: '',
  directoryName: '',
}

const initialQuickStartFormState: QuickStartFormState = {
  projectName: '',
  parentDirectory: '',
  visibility: 'private',
}

export function LandingScreen({
  isOpeningProject,
  runtimeStatus,
  uiError,
}: LandingScreenProps) {
  const { openProject, openWorkspacePicker } = useSessionActions()
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false)
  const [quickStartDialogOpen, setQuickStartDialogOpen] = useState(false)
  const [cloneForm, setCloneForm] = useState<CloneFormState>(initialCloneFormState)
  const [quickStartForm, setQuickStartForm] =
    useState<QuickStartFormState>(initialQuickStartFormState)
  const [cloneDirectoryManuallyEdited, setCloneDirectoryManuallyEdited] =
    useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const isBusy = isOpeningProject || pendingAction != null
  const visibleError = actionError ?? uiError
  const cloneFormValid =
    cloneForm.repositoryUrl.trim().length > 0 &&
    cloneForm.parentDirectory.trim().length > 0 &&
    REPOSITORY_NAME_PATTERN.test(cloneForm.directoryName.trim())
  const quickStartFormValid =
    REPOSITORY_NAME_PATTERN.test(quickStartForm.projectName.trim()) &&
    quickStartForm.parentDirectory.trim().length > 0

  function resetCloneForm() {
    setCloneForm(initialCloneFormState)
    setCloneDirectoryManuallyEdited(false)
  }

  function resetQuickStartForm() {
    setQuickStartForm(initialQuickStartFormState)
  }

  function handleCloneDialogChange(open: boolean) {
    if (pendingAction != null) {
      return
    }

    setCloneDialogOpen(open)
    if (!open) {
      resetCloneForm()
    }
  }

  function handleQuickStartDialogChange(open: boolean) {
    if (pendingAction != null) {
      return
    }

    setQuickStartDialogOpen(open)
    if (!open) {
      resetQuickStartForm()
    }
  }

  function handleCloneRepositoryUrlChange(value: string) {
    setCloneForm((current) => {
      const nextDerivedName = deriveDirectoryNameFromRepositoryUrl(value)
      const previousDerivedName = deriveDirectoryNameFromRepositoryUrl(
        current.repositoryUrl,
      )
      const shouldSyncDirectoryName =
        !cloneDirectoryManuallyEdited ||
        current.directoryName.trim().length === 0 ||
        current.directoryName === previousDerivedName

      return {
        ...current,
        repositoryUrl: value,
        directoryName: shouldSyncDirectoryName
          ? nextDerivedName
          : current.directoryName,
      }
    })
  }

  async function handleCloneDestinationPick() {
    setActionError(null)
    try {
      const parentDirectory = await desktopClient.pickDirectory(
        'Choose a folder for the cloned repository',
      )
      if (parentDirectory != null) {
        setCloneForm((current) => ({ ...current, parentDirectory }))
      }
    } catch (error) {
      setActionError(formatError(error))
    }
  }

  async function handleQuickStartDestinationPick() {
    setActionError(null)
    try {
      const parentDirectory = await desktopClient.pickDirectory(
        'Choose a folder for the new GitHub project',
      )
      if (parentDirectory != null) {
        setQuickStartForm((current) => ({ ...current, parentDirectory }))
      }
    } catch (error) {
      setActionError(formatError(error))
    }
  }

  async function handleCloneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cloneFormValid || isBusy) {
      return
    }

    setActionError(null)
    setPendingAction('clone')

    try {
      const workspacePath = await desktopClient.cloneRepository({
        repositoryUrl: cloneForm.repositoryUrl.trim(),
        parentDirectory: cloneForm.parentDirectory.trim(),
        directoryName: cloneForm.directoryName.trim(),
      })
      await openProject(workspacePath)
      setCloneDialogOpen(false)
      resetCloneForm()
    } catch (error) {
      setActionError(formatError(error))
    } finally {
      setPendingAction(null)
    }
  }

  async function handleQuickStartSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!quickStartFormValid || isBusy) {
      return
    }

    setActionError(null)
    setPendingAction('quick-start')

    try {
      const workspacePath = await desktopClient.quickStartProject({
        projectName: quickStartForm.projectName.trim(),
        parentDirectory: quickStartForm.parentDirectory.trim(),
        visibility: quickStartForm.visibility,
      })
      await openProject(workspacePath)
      setQuickStartDialogOpen(false)
      resetQuickStartForm()
    } catch (error) {
      setActionError(formatError(error))
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <>
      <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/80 text-neutral-950 shadow-xl shadow-neutral-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/80 dark:text-neutral-100 dark:shadow-black/20">
        <div className="flex min-h-0 flex-1 overflow-auto px-6 py-8 max-md:px-4 max-md:py-5">
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6">
            {visibleError ? (
              <p
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                role="alert"
              >
                {visibleError}
              </p>
            ) : null}

            {runtimeStatus?.configured === false ? (
              <p
                className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                role="alert"
              >
                {runtimeStatus.configurationError ??
                  'No session is configured. Configure the terminal session first.'}
              </p>
            ) : null}

            <div className="grid w-full gap-4 md:grid-cols-3">
              <LaunchCard
                disabled={isBusy}
                icon={FolderOpen}
                label={isOpeningProject ? 'Opening...' : 'Open folder'}
                onClick={() => {
                  setActionError(null)
                  void openWorkspacePicker()
                }}
              />
              <LaunchCard
                disabled={isBusy}
                icon={GitBranchPlus}
                label="Clone from Git"
                onClick={() => {
                  setActionError(null)
                  setCloneDialogOpen(true)
                }}
              />
              <LaunchCard
                disabled={isBusy}
                icon={Rocket}
                label="Quick start"
                onClick={() => {
                  setActionError(null)
                  setQuickStartDialogOpen(true)
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <Dialog open={cloneDialogOpen} onOpenChange={handleCloneDialogChange}>
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={pendingAction == null}
        >
          <DialogHeader>
            <DialogTitle>Clone from Git</DialogTitle>
            <DialogDescription>
              Pull a remote repository into a local folder and open it as the
              active workspace.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={(event) => void handleCloneSubmit(event)}>
            <div className="grid gap-2">
              <Label htmlFor="clone-repository-url">Repository URL</Label>
              <Input
                id="clone-repository-url"
                placeholder="git@github.com:owner/repo.git"
                value={cloneForm.repositoryUrl}
                onChange={(event) =>
                  handleCloneRepositoryUrlChange(event.target.value)
                }
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
                  onChange={(event) =>
                    setCloneForm((current) => ({
                      ...current,
                      parentDirectory: event.target.value,
                    }))
                  }
                  disabled={isBusy}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCloneDestinationPick()}
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
                onChange={(event) => {
                  setCloneDirectoryManuallyEdited(true)
                  setCloneForm((current) => ({
                    ...current,
                    directoryName: event.target.value,
                  }))
                }}
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
                onClick={() => handleCloneDialogChange(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!cloneFormValid || isBusy}>
                {pendingAction === 'clone' ? (
                  <>
                    <LoaderCircle
                      strokeWidth={2.5}
                      className="size-3.5 animate-spin"
                    />
                    Cloning...
                  </>
                ) : (
                  'Clone and open'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={quickStartDialogOpen}
        onOpenChange={handleQuickStartDialogChange}
      >
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={pendingAction == null}
        >
          <DialogHeader>
            <DialogTitle>Quick start</DialogTitle>
            <DialogDescription>
              Create a GitHub repository with the GitHub CLI, clone it locally,
              and open it as the current workspace.
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4"
            onSubmit={(event) => void handleQuickStartSubmit(event)}
          >
            <div className="grid gap-2">
              <Label htmlFor="quick-start-project-name">Project name</Label>
              <Input
                id="quick-start-project-name"
                placeholder="my-agent-project"
                value={quickStartForm.projectName}
                onChange={(event) =>
                  setQuickStartForm((current) => ({
                    ...current,
                    projectName: event.target.value,
                  }))
                }
                disabled={isBusy}
              />
              <p className="text-xs text-muted-foreground">
                This becomes both the GitHub repo name and the local folder.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quick-start-parent-directory">Destination folder</Label>
              <div className="flex gap-2">
                <Input
                  id="quick-start-parent-directory"
                  placeholder="Choose where the new project should live"
                  value={quickStartForm.parentDirectory}
                  onChange={(event) =>
                    setQuickStartForm((current) => ({
                      ...current,
                      parentDirectory: event.target.value,
                    }))
                  }
                  disabled={isBusy}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleQuickStartDestinationPick()}
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
                  active={quickStartForm.visibility === 'private'}
                  disabled={isBusy}
                  onClick={() =>
                    setQuickStartForm((current) => ({
                      ...current,
                      visibility: 'private',
                    }))
                  }
                  value="Private"
                />
                <VisibilityButton
                  active={quickStartForm.visibility === 'public'}
                  disabled={isBusy}
                  onClick={() =>
                    setQuickStartForm((current) => ({
                      ...current,
                      visibility: 'public',
                    }))
                  }
                  value="Public"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleQuickStartDialogChange(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!quickStartFormValid || isBusy}>
                {pendingAction === 'quick-start' ? (
                  <>
                    <LoaderCircle
                      strokeWidth={2.5}
                      className="size-3.5 animate-spin"
                    />
                    Creating...
                  </>
                ) : (
                  'Create and open'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function LaunchCard({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  disabled: boolean
  icon: typeof FolderOpen
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="block h-full w-full appearance-none text-left disabled:cursor-not-allowed"
      onClick={onClick}
      disabled={disabled}
    >
      <Card className="h-full min-h-56 transition-colors hover:bg-muted/40">
        <CardHeader>
          <CardAction className="justify-self-start">
            <div className="flex size-10 items-center justify-center rounded-md border border-input bg-input/20 text-muted-foreground dark:bg-input/30">
              <Icon strokeWidth={2.5} className="size-3.5" />
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="flex-1" />

        <CardFooter className="pt-0">
          <CardTitle>{label}</CardTitle>
        </CardFooter>
      </Card>
    </button>
  )
}

function VisibilityButton({
  active,
  disabled,
  onClick,
  value,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  value: string
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      className="justify-center"
      onClick={onClick}
      disabled={disabled}
    >
      {value}
    </Button>
  )
}

function deriveDirectoryNameFromRepositoryUrl(repositoryUrl: string): string {
  const trimmed = repositoryUrl.trim().replace(/\/+$/, '')
  if (trimmed.length === 0) {
    return ''
  }

  const lastSegment = trimmed.split(/[:/]/).at(-1) ?? ''
  return lastSegment.replace(/\.git$/i, '')
}
