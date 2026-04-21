import type {
  TranscriptMessage,
  ToolCallDetail,
  ToolResultDetail,
} from "../../services/desktop/contracts";

export interface ActivityOperation {
  id: string;
  requestId: string;
  name: string;
  callId?: string | null;
  detail: ToolCallDetail;
  completed: boolean;
  isError: boolean;
  outputText?: string;
  resultDetail?: ToolResultDetail | null;
  summary?: string | null;
}

export interface ActivityItem {
  kind: "activity";
  key: string;
  requestId: string;
  summary: string;
  operations: ActivityOperation[];
  isRunning: boolean;
  isThinking: boolean;
  hasError: boolean;
  reasoningText?: string;
}

export type ChatThreadItem =
  | {
      kind: "message";
      key: string;
      message: TranscriptMessage;
    }
  | {
      kind: "request_work";
      key: string;
      requestId: string;
      activities: ActivityItem[];
      isRunning: boolean;
      hasError: boolean;
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

function shouldDisplayOperationInActivity(operation: ActivityOperation): boolean {
  return (
    operation.detail.kind !== "todo_read" && operation.detail.kind !== "todo_write"
  );
}

export function buildChatThreadItems(
  messages: TranscriptMessage[],
  activeRequestIds: string[],
): ChatThreadItem[] {
  const items: ChatThreadItem[] = [];
  const activeRequestIdSet = new Set(activeRequestIds);
  const pendingActivitiesByRequestId = new Map<string, ActivityItem[]>();
  const emittedWorkItemRequestIds = new Set<string>();
  const requestIdsInEncounterOrder: string[] = [];
  const seenRequestIds = new Set<string>();
  let currentGroup: ActivityGroupBuilder | null = null;

  const trackRequestId = (requestId: string) => {
    if (seenRequestIds.has(requestId)) {
      return;
    }

    seenRequestIds.add(requestId);
    requestIdsInEncounterOrder.push(requestId);
  };

  const createActivityItems = (
    group: ActivityGroupBuilder,
    isRunning: boolean,
  ): ActivityItem[] => {
    const activityItems: ActivityItem[] = [];
    const visibleOperations = group.operations.filter(shouldDisplayOperationInActivity);

    if (group.reasoningText.trim().length > 0) {
      activityItems.push({
        kind: "activity",
        key: `activity:${group.requestId}:thinking`,
        requestId: group.requestId,
        summary: "Thinking",
        operations: [],
        isRunning,
        isThinking: true,
        hasError: false,
        reasoningText: group.reasoningText.trim(),
      });
    }

    const operationGroups = splitActivityOperationGroups(visibleOperations);
    operationGroups.forEach((operations, index) => {
      activityItems.push({
        kind: "activity",
        key: `activity:${group.requestId}:${index}`,
        requestId: group.requestId,
        summary: summarizeActivityGroup(operations),
        operations,
        isRunning: isRunning && index === operationGroups.length - 1,
        isThinking: false,
        hasError: operations.some((operation) => operation.isError),
        reasoningText: undefined,
      });
    });

    return activityItems;
  };

  const pushWorkItem = (
    requestId: string,
    activities: ActivityItem[],
    isRunning: boolean,
  ) => {
    trackRequestId(requestId);

    items.push({
      kind: "request_work",
      key: `request-work:${requestId}:${items.length}`,
      requestId,
      activities,
      isRunning,
      hasError: activities.some((activity) => activity.hasError),
    });
    emittedWorkItemRequestIds.add(requestId);
  };

  const appendPendingActivities = (
    requestId: string,
    activities: ActivityItem[],
  ) => {
    trackRequestId(requestId);
    if (activities.length === 0) {
      return;
    }

    const existingActivities = pendingActivitiesByRequestId.get(requestId) ?? [];
    pendingActivitiesByRequestId.set(requestId, [
      ...existingActivities,
      ...activities,
    ]);
  };

  const takePendingActivities = (requestId: string): ActivityItem[] => {
    trackRequestId(requestId);
    const activities = pendingActivitiesByRequestId.get(requestId) ?? [];
    pendingActivitiesByRequestId.delete(requestId);
    return activities;
  };

  const flushGroup = (options?: { includeEmpty?: boolean }) => {
    if (currentGroup == null) {
      return;
    }

    const isRunning = activeRequestIdSet.has(currentGroup.requestId);
    const activities = createActivityItems(currentGroup, isRunning);
    if (activities.length > 0) {
      appendPendingActivities(currentGroup.requestId, activities);
    } else if (options?.includeEmpty === true) {
      trackRequestId(currentGroup.requestId);
    }

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
      case "context_compacted":
        flushGroup();
        items.push({
          kind: "message",
          key: message.id,
          message,
        });
        break;
      case "assistant":
      case "error":
        flushGroup({ includeEmpty: true });
        pushWorkItem(
          message.requestId,
          takePendingActivities(message.requestId),
          activeRequestIdSet.has(message.requestId),
        );

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
        const operation = findOperationForStatusOutput(currentGroup, message);
        if (operation != null) {
          operation.outputText = mergeOutputText(
            operation.outputText,
            message.text,
          );
        } else {
          flushGroup();
          items.push({
            kind: "message",
            key: message.id,
            message,
          });
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

        if (group.operations.includes(operation) === false) {
          group.operations.push(operation);
        }
        break;
      }
      default:
        break;
    }
  }

  flushGroup();

  for (const requestId of activeRequestIds) {
    trackRequestId(requestId);
  }

  for (const requestId of requestIdsInEncounterOrder) {
    const activities = takePendingActivities(requestId);
    const isRunning = activeRequestIdSet.has(requestId);

    if (activities.length > 0) {
      pushWorkItem(requestId, activities, isRunning);
      continue;
    }

    if (!emittedWorkItemRequestIds.has(requestId) && isRunning) {
      pushWorkItem(requestId, activities, true);
    }
  }

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

function findOperationForStatusOutput(
  group: ActivityGroupBuilder | null,
  message: Extract<TranscriptMessage, { kind: "status_output" }>,
): ActivityOperation | undefined {
  if (group == null || group.requestId !== message.requestId) {
    return undefined;
  }

  return findOperationForOutput(group.operations);
}

function findMatchingOperation(
  operations: ActivityOperation[],
  callId: string | null | undefined,
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

function splitActivityOperationGroups(
  operations: ActivityOperation[],
): ActivityOperation[][] {
  const groups: ActivityOperation[][] = [];

  for (const operation of operations) {
    const previousGroup = groups.at(-1);
    if (
      previousGroup == null ||
      getOperationGroupKey(previousGroup[0]) !== getOperationGroupKey(operation)
    ) {
      groups.push([operation]);
      continue;
    }

    previousGroup.push(operation);
  }

  return groups;
}

function getOperationGroupKey(operation: ActivityOperation): string {
  switch (operation.detail.kind) {
    case "file_read":
      return "file_read";
    case "file_update":
      return "file_update";
    case "shell":
      return "shell";
    case "search":
    case "codebase_search":
      return "search";
    case "fetch":
      return "fetch";
    case "todo_read":
      return "todo_read";
    case "todo_write":
      return "todo_write";
    default:
      return operation.detail.kind;
  }
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

  if (fileReads > 0) {
    return `Explored ${fileReads} file${fileReads === 1 ? "" : "s"}`;
  }
  if (commands > 0) {
    return `Ran ${commands} command${commands === 1 ? "" : "s"}`;
  }
  if (fileUpdates > 0) {
    return `Updated ${fileUpdates} file${fileUpdates === 1 ? "" : "s"}`;
  }
  if (searches > 0) {
    return `Ran ${searches} search${searches === 1 ? "" : "es"}`;
  }
  if (fetches > 0) {
    return `Fetched ${fetches} URL${fetches === 1 ? "" : "s"}`;
  }
  if (others > 0) {
    return `Used ${others} tool${others === 1 ? "" : "s"}`;
  }

  return "Activity";
}
