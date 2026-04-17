import type {
  TranscriptMessage,
  ToolCallDetail,
  ToolResultDetail,
} from "../../services/desktop/contracts";

export interface ActivityOperation {
  id: string;
  requestId: string;
  name: string;
  callId?: string;
  detail: ToolCallDetail;
  completed: boolean;
  isError: boolean;
  outputText?: string;
  resultDetail?: ToolResultDetail;
  summary?: string;
}

export type ChatThreadItem =
  | {
      kind: "message";
      key: string;
      message: TranscriptMessage;
    }
  | {
      kind: "activity";
      key: string;
      requestId: string;
      summary: string;
      operations: ActivityOperation[];
      isRunning: boolean;
      isThinking: boolean;
      reasoningText?: string;
    };

interface ActivityGroupBuilder {
  requestId: string;
  operations: ActivityOperation[];
  reasoningText: string;
}

const TOOL_DEBUG_TITLES = new Set([
  "Read",
  "Create",
  "Overwrite",
  "Replace",
  "Replace All",
  "Remove",
  "Undo",
  "GET",
  "Follow-up",
  "Skill",
  "Update Todos",
  "Read Todos",
  "Task",
  "Codebase Search",
]);

export function buildChatThreadItems(
  messages: TranscriptMessage[],
  activeRequestIds: string[],
): ChatThreadItem[] {
  const items: ChatThreadItem[] = [];
  const activeRequestIdSet = new Set(activeRequestIds);
  let currentGroup: ActivityGroupBuilder | null = null;

  const flushGroup = () => {
    if (currentGroup == null) {
      return;
    }

    const isRunning = activeRequestIdSet.has(currentGroup.requestId);
    if (currentGroup.operations.length === 0) {
      if (currentGroup.reasoningText.trim().length > 0) {
        items.push({
          kind: "activity",
          key: `activity:${currentGroup.requestId}:thinking`,
          requestId: currentGroup.requestId,
          summary: "Thinking",
          operations: [],
          isRunning,
          isThinking: true,
          reasoningText: currentGroup.reasoningText.trim(),
        });
      }

      currentGroup = null;
      return;
    }

    items.push({
      kind: "activity",
      key: `activity:${currentGroup.requestId}:${items.length}`,
      requestId: currentGroup.requestId,
      summary: summarizeActivityGroup(currentGroup.operations),
      operations: currentGroup.operations,
      isRunning,
      isThinking: false,
      reasoningText: undefined,
    });
    currentGroup = null;
  };

  const ensureGroup = (requestId: string) => {
    if (currentGroup == null) {
      currentGroup = {
        requestId,
        operations: [],
        reasoningText: "",
      };
      return currentGroup;
    }

    if (currentGroup.requestId !== requestId) {
      flushGroup();
      currentGroup = {
        requestId,
        operations: [],
        reasoningText: "",
      };
    }

    return currentGroup;
  };

  for (const message of messages) {
    switch (message.kind) {
      case "user":
      case "assistant":
      case "error":
        flushGroup();
        items.push({
          kind: "message",
          key: message.id,
          message,
        });
        break;
      case "reasoning": {
        const group = ensureGroup(message.requestId);
        if (group.operations.length > 0) {
          flushGroup();
        }

        const thinkingGroup = ensureGroup(message.requestId);
        thinkingGroup.reasoningText = mergeOutputText(
          thinkingGroup.reasoningText,
          message.text,
        );
        break;
      }
      case "tool_start": {
        if (hasPendingReasoningGroup(currentGroup, message.requestId)) {
          flushGroup();
        }

        const group = ensureGroup(message.requestId);
        group.operations.push({
          id: message.id,
          requestId: message.requestId,
          name: message.name,
          callId: message.callId,
          detail: message.detail,
          completed: false,
          isError: false,
        });
        break;
      }
      case "status":
        if (isDecorativeToolStatus(message)) {
          break;
        }

        flushGroup();
        items.push({
          kind: "message",
          key: message.id,
          message,
        });
        break;
      case "status_output": {
        const group = currentGroup as ActivityGroupBuilder | null;
        if (group == null || group.requestId !== message.requestId) {
          break;
        }

        const operation = findOperationForOutput(group.operations);
        if (operation != null) {
          operation.outputText = mergeOutputText(
            operation.outputText,
            message.text,
          );
        }
        break;
      }
      case "tool_end": {
        const group = ensureGroup(message.requestId);
        const operation =
          findMatchingOperation(
            group.operations,
            message.callId,
            message.name,
          ) ?? createFallbackOperation(message);

        operation.completed = true;
        operation.isError = message.isError;
        operation.summary = message.summary;
        operation.resultDetail = message.detail;

        if (!group.operations.includes(operation)) {
          group.operations.push(operation);
        }
        break;
      }
      default:
        break;
    }
  }

  flushGroup();
  return items;
}

function isDecorativeToolStatus(
  message: Extract<TranscriptMessage, { kind: "status" }>,
): boolean {
  return (
    message.category === "debug" &&
    (TOOL_DEBUG_TITLES.has(message.title) ||
      message.title.startsWith("Execute [") ||
      message.title.startsWith("Search for '"))
  );
}

function findOperationForOutput(
  operations: ActivityOperation[],
): ActivityOperation | undefined {
  return [...operations]
    .reverse()
    .find((operation) => !operation.completed || operation.outputText == null);
}

function findMatchingOperation(
  operations: ActivityOperation[],
  callId: string | undefined,
  name: string,
): ActivityOperation | undefined {
  if (callId != null) {
    return operations.find((operation) => operation.callId === callId);
  }

  return [...operations]
    .reverse()
    .find((operation) => !operation.completed && operation.name === name);
}

function createFallbackOperation(
  message: Extract<TranscriptMessage, { kind: "tool_end" }>,
): ActivityOperation {
  return {
    id: message.id,
    requestId: message.requestId,
    name: message.name,
    callId: message.callId,
    detail: { kind: "unknown", name: message.name },
    completed: false,
    isError: false,
  };
}

function hasPendingReasoningGroup(
  group: ActivityGroupBuilder | null,
  requestId: string,
): boolean {
  return (
    group != null &&
    group.requestId === requestId &&
    group.operations.length === 0 &&
    group.reasoningText.trim().length > 0
  );
}

function mergeOutputText(current: string | undefined, next: string): string {
  const trimmed = next.trim();
  if (trimmed.length === 0) {
    return current ?? "";
  }

  if (current == null || current.trim().length === 0) {
    return trimmed;
  }

  return `${current}\n\n${trimmed}`;
}

function summarizeActivityGroup(operations: ActivityOperation[]): string {
  let fileReads = 0;
  let fileUpdates = 0;
  let commands = 0;
  let searches = 0;
  let fetches = 0;
  let others = 0;

  for (const operation of operations) {
    switch (operation.detail.kind) {
      case "file_read":
        fileReads += 1;
        break;
      case "file_update":
        fileUpdates += 1;
        break;
      case "shell":
        commands += 1;
        break;
      case "search":
      case "codebase_search":
        searches += 1;
        break;
      case "fetch":
        fetches += 1;
        break;
      default:
        others += 1;
        break;
    }
  }

  const parts: string[] = [];
  if (fileReads > 0) {
    parts.push(`explored ${fileReads} file${fileReads === 1 ? "" : "s"}`);
  }
  if (commands > 0) {
    parts.push(`ran ${commands} command${commands === 1 ? "" : "s"}`);
  }
  if (fileUpdates > 0) {
    parts.push(`updated ${fileUpdates} file${fileUpdates === 1 ? "" : "s"}`);
  }
  if (searches > 0) {
    parts.push(`ran ${searches} search${searches === 1 ? "" : "es"}`);
  }
  if (fetches > 0) {
    parts.push(`fetched ${fetches} URL${fetches === 1 ? "" : "s"}`);
  }
  if (others > 0) {
    parts.push(`used ${others} tool${others === 1 ? "" : "s"}`);
  }

  if (parts.length === 0) {
    return "Activity";
  }

  const [first, ...rest] = parts;
  return `${first.charAt(0).toUpperCase()}${first.slice(1)}${rest.length > 0 ? `, ${rest.join(", ")}` : ""}`;
}
