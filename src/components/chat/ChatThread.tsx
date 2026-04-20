import {
  LegendList,
  type LegendListRenderItemProps,
} from "@legendapp/list/react";
import { useMemo } from "react";

import type { RequestTimingInfo } from "../../app/SessionContext";
import type { TranscriptMessage } from "../../services/desktop/contracts";
import { ChatEventRow } from "./ChatEventRow";
import { ChatMessageRow } from "./ChatMessageRow";
import { ChatWorkRow } from "./ChatWorkRow";
import { buildChatThreadItems, type ChatThreadItem } from "./chatThreadModel";

interface ChatThreadProps {
  activeRequestIds: string[];
  messages: TranscriptMessage[];
  requestTimingsById: Record<string, RequestTimingInfo>;
  workspacePath: string | null;
}

const THREAD_ITEM_GAP = 16;

function getMessageText(message: TranscriptMessage): string {
  switch (message.kind) {
    case "user":
    case "assistant":
    case "reasoning":
    case "status_output":
      return message.text;
    case "error":
      return message.message;
    case "status":
      return `${message.title} ${message.subtitle ?? ""}`;
    case "tool_start":
      return `${message.name} ${message.callId ?? ""}`;
    case "tool_end":
      return `${message.name} ${message.summary ?? ""}`;
    default:
      return "";
  }
}

function estimateMessageItemSize(message: TranscriptMessage): number {
  const lineCount = Math.max(1, Math.ceil(getMessageText(message).length / 72));

  switch (message.kind) {
    case "user":
      return 42 + lineCount * 34;
    case "assistant":
      return 32 + lineCount * 26;
    case "reasoning":
      return 28 + lineCount * 24;
    case "status_output":
      return 36 + lineCount * 18;
    default:
      return 28 + lineCount * 22;
  }
}

function estimateRequestWorkItemSize(
  item: Extract<ChatThreadItem, { kind: "request_work" }>,
) {
  return item.isRunning ? 40 : 44;
}

function estimateChatThreadItemSize(item: ChatThreadItem): number {
  const contentSize =
    item.kind === "message"
      ? estimateMessageItemSize(item.message)
      : estimateRequestWorkItemSize(item);

  return contentSize + THREAD_ITEM_GAP;
}

function renderChatMessage(message: TranscriptMessage) {
  switch (message.kind) {
    case "user":
    case "assistant":
    case "reasoning":
      return <ChatMessageRow message={message} />;
    default:
      return <ChatEventRow message={message} />;
  }
}

function renderChatThreadItem(
  { item, index }: LegendListRenderItemProps<ChatThreadItem>,
  requestTimingsById: Record<string, RequestTimingInfo>,
  workspacePath: string | null,
  itemCount: number,
) {
  const row =
    item.kind === "message" ? (
      renderChatMessage(item.message)
    ) : (
      <ChatWorkRow
        item={item}
        requestTiming={requestTimingsById[item.requestId]}
        workspacePath={workspacePath}
      />
    );

  return (
    <div
      className="mx-auto min-w-0 w-full max-w-3xl select-text"
      style={{ paddingBottom: index === itemCount - 1 ? 0 : THREAD_ITEM_GAP }}
    >
      {row}
    </div>
  );
}

export function ChatThread({
  activeRequestIds,
  messages,
  requestTimingsById,
  workspacePath,
}: ChatThreadProps) {
  const items = useMemo(
    () => buildChatThreadItems(messages, activeRequestIds),
    [activeRequestIds, messages],
  );

  return (
    <LegendList
      data={items}
      renderItem={(props) =>
        renderChatThreadItem(
          props,
          requestTimingsById,
          workspacePath,
          items.length,
        )
      }
      keyExtractor={(item) => item.key}
      getItemType={(item) =>
        item.kind === "message" ? item.message.kind : "request_work"
      }
      getEstimatedItemSize={estimateChatThreadItemSize}
      maintainScrollAtEnd
      maintainScrollAtEndThreshold={0.3}
      maintainVisibleContentPosition
      estimatedItemSize={88}
      style={{ height: "100%" }}
      contentContainerStyle={{
        paddingTop: 20,
        paddingBottom: 32,
      }}
      ListEmptyComponent={<div className="min-h-px" aria-hidden="true" />}
    />
  );
}
