import {
  LegendList,
  type LegendListRenderItemProps,
} from "@legendapp/list/react";
import { useMemo } from "react";

import type { TranscriptMessage } from "../services/desktop/contracts";
import { buildChatThreadItems, type ChatThreadItem } from "./chat-thread-model";
import { TranscriptActivityRow } from "./TranscriptActivityRow";
import { TranscriptRow } from "./TranscriptRow";

interface ChatThreadProps {
  activeRequestIds: string[];
  messages: TranscriptMessage[];
  workspacePath: string | null;
}

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

function estimateActivityItemSize(
  item: Extract<ChatThreadItem, { kind: "activity" }>,
) {
  if (item.isThinking) {
    return 44;
  }

  const summaryLines = Math.max(1, Math.ceil(item.summary.length / 72));
  if (!item.isRunning) {
    return 32 + summaryLines * 24;
  }

  const operationLines = item.operations.reduce((total, operation) => {
    const detailLength =
      operation.detail.kind === "shell"
        ? operation.detail.command.length
        : operation.name.length;

    return total + Math.max(1, Math.ceil(detailLength / 84));
  }, 0);

  return (
    40 + summaryLines * 24 + item.operations.length * 28 + operationLines * 8
  );
}

function estimateChatThreadItemSize(item: ChatThreadItem): number {
  return item.kind === "message"
    ? estimateMessageItemSize(item.message)
    : estimateActivityItemSize(item);
}

function renderChatThreadItem(
  { item }: LegendListRenderItemProps<ChatThreadItem>,
  workspacePath: string | null,
) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-4 select-text">
      {item.kind === "message" ? (
        <TranscriptRow message={item.message} />
      ) : (
        <TranscriptActivityRow item={item} workspacePath={workspacePath} />
      )}
    </div>
  );
}

export function ChatThread({
  activeRequestIds,
  messages,
  workspacePath,
}: ChatThreadProps) {
  const items = useMemo(
    () => buildChatThreadItems(messages, activeRequestIds),
    [activeRequestIds, messages],
  );

  return (
    <LegendList
      data={items}
      renderItem={(props) => renderChatThreadItem(props, workspacePath)}
      keyExtractor={(item) => item.key}
      getItemType={(item) =>
        item.kind === "message" ? item.message.kind : "activity"
      }
      getEstimatedItemSize={estimateChatThreadItemSize}
      maintainScrollAtEnd
      maintainScrollAtEndThreshold={0.2}
      maintainVisibleContentPosition
      estimatedItemSize={88}
      style={{ height: "100%" }}
      contentContainerStyle={{ paddingTop: 28, paddingBottom: 20 }}
      ListEmptyComponent={<div className="min-h-px" aria-hidden="true" />}
    />
  );
}
