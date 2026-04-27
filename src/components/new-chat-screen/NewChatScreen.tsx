import { useConversationSession } from "@/hooks/useSession";
import { ConversationSurface } from "@/components/conversation-panel/ConversationSurface";

import { CloneRepositoryDialog } from "./CloneRepositoryDialog";
import { useNewChatScreenController } from "./hooks/useNewChatScreenController";
import { NewChatLaunchActions } from "./NewChatLaunchActions";
import { NewChatPromptSection } from "./NewChatPromptSection";
import { QuickStartProjectDialog } from "./QuickStartProjectDialog";
import type { NewChatScreenProps } from "./types/newChatScreen";

export function NewChatScreen({
  binding,
  embedded = false,
}: NewChatScreenProps) {
  const { isOpeningProject, uiError } = useConversationSession(binding);
  const controller = useNewChatScreenController({
    isOpeningProject,
    uiError,
  });

  const content = (
    <NewChatScreenContent
      binding={binding}
      isBusy={controller.isBusy}
      isOpeningProject={isOpeningProject}
      onOpenClone={controller.openCloneDialog}
      onOpenFolder={() => void controller.handleOpenWorkspacePicker()}
      onOpenQuickStart={controller.openQuickStartDialog}
      visibleError={controller.visibleError}
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
        onParentDirectoryChange={
          controller.handleQuickStartParentDirectoryChange
        }
        onProjectNameChange={controller.handleQuickStartProjectNameChange}
        onSubmit={controller.handleQuickStartSubmit}
        onVisibilityChange={controller.handleQuickStartVisibilityChange}
        quickStartForm={controller.quickStartForm}
        quickStartFormValid={controller.quickStartFormValid}
      />
    </>
  );
}

function NewChatScreenContent({
  binding,
  isBusy,
  isOpeningProject,
  onOpenClone,
  onOpenFolder,
  onOpenQuickStart,
  visibleError,
}: {
  binding?: NewChatScreenProps["binding"];
  isBusy: boolean;
  isOpeningProject: boolean;
  onOpenClone: () => void;
  onOpenFolder: () => void;
  onOpenQuickStart: () => void;
  visibleError: string | null;
}) {
  const {
    activeWorkspaceLabel,
    hasCurrentWorkspace,
    workspaceKind,
  } = useConversationSession(binding);
  const heading = hasCurrentWorkspace
    ? workspaceKind === "managed_chat"
      ? "Ask anything"
      : `Ask anything about ${activeWorkspaceLabel}`
    : "Ask anything";

  return (
    <div className="flex min-h-0 flex-1 overflow-auto px-6 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6">
        <div className="flex w-full max-w-3xl flex-col items-center text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {heading}
          </h2>
        </div>

        {visibleError ? (
          <div className="w-full max-w-3xl">
            <p
              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
              role="alert"
            >
              {visibleError}
            </p>
          </div>
        ) : null}

        <div className="w-full max-w-3xl">
          <NewChatPromptSection binding={binding} />
        </div>

        <NewChatLaunchActions
          isBusy={isBusy}
          isOpeningProject={isOpeningProject}
          onOpenClone={onOpenClone}
          onOpenFolder={onOpenFolder}
          onOpenQuickStart={onOpenQuickStart}
        />
      </div>
    </div>
  );
}
