import { describe, expect, test } from "bun:test";

import type { TranscriptMessage } from "../../services/desktop/contracts";
import { buildChatThreadItems } from "./chatThreadModel";

function userMessage(
  id: string,
  requestId: string,
  text: string,
): Extract<TranscriptMessage, { kind: "user" }> {
  return { kind: "user", id, requestId, text };
}

function assistantMessage(
  id: string,
  requestId: string,
  text: string,
): Extract<TranscriptMessage, { kind: "assistant" }> {
  return { kind: "assistant", id, requestId, text };
}

function reasoningMessage(
  id: string,
  requestId: string,
  text: string,
): Extract<TranscriptMessage, { kind: "reasoning" }> {
  return { kind: "reasoning", id, requestId, text };
}

function toolStartMessage(
  id: string,
  requestId: string,
  callId: string,
  detail: Extract<TranscriptMessage, { kind: "tool_start" }>["detail"],
): Extract<TranscriptMessage, { kind: "tool_start" }> {
  return {
    kind: "tool_start",
    id,
    requestId,
    name: detail.kind === "shell" ? "shell" : "tool",
    callId,
    detail,
  };
}

function toolEndMessage(
  id: string,
  requestId: string,
  callId: string,
  detail: Extract<TranscriptMessage, { kind: "tool_end" }>["detail"],
): Extract<TranscriptMessage, { kind: "tool_end" }> {
  return {
    kind: "tool_end",
    id,
    requestId,
    name: "tool",
    callId,
    summary: null,
    isError: false,
    detail,
  };
}

describe("buildChatThreadItems", () => {
  test("places a single work row before the last assistant message of a completed request", () => {
    const items = buildChatThreadItems(
      [
        userMessage("user-1", "req-1", "add a random comment"),
        reasoningMessage(
          "reasoning-1",
          "req-1",
          "I'll pick a random file and add a comment to it.",
        ),
        assistantMessage(
          "assistant-1",
          "req-1",
          "Let me first check what source files are available.",
        ),
        toolStartMessage("tool-start-1", "req-1", "call-1", {
          kind: "shell",
          command: "rg --files",
          cwd: null,
          description: null,
        }),
        toolEndMessage("tool-end-1", "req-1", "call-1", {
          kind: "text",
          text: "src/hooks/useRedditUserSubmissions.ts",
        }),
        assistantMessage(
          "assistant-2",
          "req-1",
          "Randomly selected src/hooks/useRedditUserSubmissions.ts.",
        ),
        toolStartMessage("tool-start-2", "req-1", "call-2", {
          kind: "file_read",
          path: "src/hooks/useRedditUserSubmissions.ts",
          startLine: null,
          endLine: null,
        }),
        toolEndMessage("tool-end-2", "req-1", "call-2", null),
        toolStartMessage("tool-start-3", "req-1", "call-3", {
          kind: "file_update",
          path: "src/hooks/useRedditUserSubmissions.ts",
          operation: "replace",
        }),
        toolEndMessage("tool-end-3", "req-1", "call-3", {
          kind: "file_diff",
          path: "src/hooks/useRedditUserSubmissions.ts",
          patch: "diff --git a/src/hooks/useRedditUserSubmissions.ts b/src/hooks/useRedditUserSubmissions.ts",
        }),
        assistantMessage("assistant-3", "req-1", "Done."),
      ],
      [],
    );

    expect(items.map((item) => item.kind)).toEqual([
      "message",
      "message",
      "message",
      "request_work",
      "message",
    ]);

    const workItem = items[3];
    expect(workItem.kind).toBe("request_work");
    if (workItem.kind !== "request_work") {
      return;
    }

    expect(workItem.isRunning).toBe(false);
    expect(workItem.activities.map((activity) => activity.summary)).toEqual([
      "Thinking",
      "Ran 1 command",
      "Explored 1 file",
      "Updated 1 file",
    ]);
    expect(items[4]).toEqual({
      kind: "message",
      key: "assistant-3",
      message: assistantMessage("assistant-3", "req-1", "Done."),
    });
  });

  test("keeps a single running work row at the end for active requests", () => {
    const items = buildChatThreadItems(
      [
        assistantMessage("assistant-1", "req-1", "Checking files."),
        toolStartMessage("tool-start-1", "req-1", "call-1", {
          kind: "shell",
          command: "rg --files",
          cwd: null,
          description: null,
        }),
        toolEndMessage("tool-end-1", "req-1", "call-1", {
          kind: "text",
          text: "src/hooks/useRedditUserSubmissions.ts",
        }),
        assistantMessage(
          "assistant-2",
          "req-1",
          "Randomly selected src/hooks/useRedditUserSubmissions.ts.",
        ),
      ],
      ["req-1"],
    );

    expect(items.map((item) => item.kind)).toEqual([
      "message",
      "message",
      "request_work",
    ]);

    const workItem = items[2];
    expect(workItem.kind).toBe("request_work");
    if (workItem.kind !== "request_work") {
      return;
    }

    expect(workItem.isRunning).toBe(true);
    expect(workItem.activities).toHaveLength(1);
    expect(workItem.activities[0]?.summary).toBe("Ran 1 command");
    expect(
      workItem.activities.filter((activity) => activity.isRunning),
    ).toHaveLength(1);
  });
});
