import type { ConversationSessionSummary } from "../services/desktop/contracts";
import { cn } from "../utils/cn";
import { formatRelativeTimestamp } from "../utils/time";

interface ProjectSidebarConversationRowProps {
  conversation: ConversationSessionSummary;
  isSelected: boolean;
  workspacePath: string;
  onSelectConversation: (workspacePath: string, conversationId: string) => void;
}

export function ProjectSidebarConversationRow({
  conversation,
  isSelected,
  workspacePath,
  onSelectConversation,
}: ProjectSidebarConversationRowProps) {
  const updatedAt = formatRelativeTimestamp(conversation.updatedAt);

  return (
    <button
      type="button"
      className={cn(
        "appearance-none font-inherit transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs leading-5 text-neutral-800 hover:bg-neutral-950/5 dark:text-neutral-200 dark:hover:bg-white/10",
        isSelected && "bg-neutral-950/10 dark:bg-white/10",
      )}
      onClick={() =>
        onSelectConversation(workspacePath, conversation.conversationId)
      }
    >
      <span className="min-w-0 flex-1 truncate pr-2 text-xs leading-5 text-neutral-800 dark:text-neutral-100">
        {conversation.title}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-right">
        {conversation.hasPendingFollowup ? (
          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
            Needs input
          </span>
        ) : null}
        {conversation.isRunning ? (
          <span className="rounded-full bg-neutral-950/10 px-1.5 py-0.5 text-xs font-semibold text-neutral-500 dark:bg-white/10 dark:text-neutral-300">
            Running
          </span>
        ) : null}
        {updatedAt ? (
          <span className="whitespace-nowrap text-xs text-neutral-400 dark:text-neutral-500">
            {updatedAt}
          </span>
        ) : null}
      </span>
    </button>
  );
}
