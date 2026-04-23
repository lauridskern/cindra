import { CommitChangesDialog } from "./CommitChangesDialog";
import { ConversationHeaderActions } from "./ConversationHeaderActions";
import { useConversationHeaderState } from "./hooks/useConversationHeaderState";
import type { ConversationDockviewHeaderActionsProps } from "./types/conversationHeader";

export function ConversationDockviewHeaderActions({
  binding,
  canCloseChat,
  onCloseChat,
  onOpenPreview,
  onOpenTerminal,
}: ConversationDockviewHeaderActionsProps) {
  const {
    commitMessage,
    isCommitDialogOpen,
    isCommitPending,
    isGitActionPending,
    isOpenTargetPending,
    openTargets,
    resolvedPreferredAppId,
    setCommitMessage,
    handleCommitDialogClose,
    handleCommitDialogOpenChange,
    handleCommitSubmit,
    handleOpenTarget,
    handlePush,
    openCommitDialog,
    showGitActions,
  } = useConversationHeaderState(binding);

  return (
    <>
      <div className="relative z-20 ml-auto flex shrink-0 items-center gap-1.5 pointer-events-auto">
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
          showGitActions={showGitActions}
        />
      </div>

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
