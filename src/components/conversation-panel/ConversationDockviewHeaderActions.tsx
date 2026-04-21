import type { ChatBinding } from "@/services/desktop/contracts";

import { CommitChangesDialog } from "./CommitChangesDialog";
import { ConversationHeaderActions } from "./ConversationHeaderActions";
import { useConversationHeaderState } from "./useConversationHeaderState";

interface ConversationDockviewHeaderActionsProps {
  binding?: ChatBinding | null;
  canCloseChat?: () => boolean;
  onCloseChat?: () => void;
  onOpenPreview?: () => void;
  onOpenTerminal?: () => void;
}

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
