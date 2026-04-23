import { LegendList } from "@legendapp/list/react";

import { CHAT_BADGE_TEXT_CLASS } from "./constants/chatStyles";
import type { ChatThreadProps } from "./types/chatComponents";
import { buildChatThreadItems } from "./utils/chatThread";
import {
  estimateChatThreadItemSize,
  renderChatThreadItem,
} from "./utils/chatThreadList";

export function ChatThread({
  activeRequestIds,
  messages,
  requestTimingsById,
  workspaceLabel,
  workspacePath,
}: ChatThreadProps) {
  const items = buildChatThreadItems(messages, activeRequestIds);

  return (
    <LegendList
      data={items}
      renderItem={(props) =>
        renderChatThreadItem(props, {
          requestTimingsById,
          workspacePath,
          itemCount: items.length,
        })
      }
      keyExtractor={(item) => item.key}
      getItemType={(item) =>
        item.kind === "message" ? item.message.kind : "request_work"
      }
      getEstimatedItemSize={estimateChatThreadItemSize}
      initialScrollAtEnd={items.length > 0}
      maintainScrollAtEnd
      maintainScrollAtEndThreshold={0.3}
      estimatedItemSize={88}
      style={{ height: "100%" }}
      contentContainerStyle={{
        paddingTop: 20,
        paddingBottom: 32,
      }}
      ListEmptyComponent={
        <div className="mx-auto flex min-h-full w-full max-w-3xl items-center justify-center px-6 py-12">
          <div className="w-full rounded-3xl border border-black/5 bg-black/5 px-8 py-10 text-center dark:border-white/10 dark:bg-white/5">
            <p className={`${CHAT_BADGE_TEXT_CLASS} text-neutral-500 dark:text-neutral-400`}>
              New chat
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Ask anything about {workspaceLabel}
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Start with a question, a task, or a change you want to make in
              this workspace.
            </p>
          </div>
        </div>
      }
    />
  );
}
