import type { RequestTimingInfo } from "@/app/SessionContext";
import type {
  FollowupKind,
  FollowupRequest,
  OutputPreview,
  PromptSettings,
  SessionMessage,
  SessionTodo,
  StatusCategory,
  ToolCallDetail,
  ToolResultDetail,
} from "@/services/desktop/contracts";

export const DEMO_CHAT_WORKSPACE_PATH = "/demo/agent-ui";

const DEMO_REQUEST_SUCCESS_ID = "demo-request-success";
const DEMO_REQUEST_FAILURE_ID = "demo-request-failure";
const DEMO_REQUEST_LIVE_ID = "demo-request-live";

const FIXTURE_CREATED_AT_MS = Date.now();

export type DemoTodoPreset = "mixed" | "busy" | "complete";

export interface DemoChatVisibility {
  showCompaction: boolean;
  showFailure: boolean;
  showLiveRequest: boolean;
}

function createOutputPreview(
  content: string,
  overrides?: Partial<OutputPreview>,
): OutputPreview {
  const lineCount = content.length === 0 ? 0 : content.split("\n").length;

  return {
    content,
    totalLines: lineCount,
    headDisplayLines: null,
    tailDisplayLines: null,
    fullOutputPath: null,
    ...overrides,
  };
}

function user(id: string, requestId: string, text: string): SessionMessage {
  return { kind: "user", id, requestId, text };
}

function assistant(id: string, requestId: string, text: string): SessionMessage {
  return { kind: "assistant", id, requestId, text };
}

function reasoning(id: string, requestId: string, text: string): SessionMessage {
  return { kind: "reasoning", id, requestId, text };
}

function contextCompacted(
  id: string,
  requestId: string,
  text: string,
): SessionMessage {
  return { kind: "context_compacted", id, requestId, text };
}

function status(
  id: string,
  requestId: string,
  title: string,
  subtitle: string | null,
  category: StatusCategory,
): SessionMessage {
  return { kind: "status", id, requestId, title, subtitle, category };
}

function statusOutput(
  id: string,
  requestId: string,
  text: string,
): SessionMessage {
  return { kind: "status_output", id, requestId, text };
}

function toolStart(
  id: string,
  requestId: string,
  name: string,
  callId: string,
  detail: ToolCallDetail,
): SessionMessage {
  return { kind: "tool_start", id, requestId, name, callId, detail };
}

function toolEnd(
  id: string,
  requestId: string,
  name: string,
  callId: string,
  summary: string | null,
  isError: boolean,
  detail: ToolResultDetail | null,
): SessionMessage {
  return {
    kind: "tool_end",
    id,
    requestId,
    name,
    callId,
    summary,
    isError,
    detail,
  };
}

function errorMessage(
  id: string,
  requestId: string,
  message: string,
): SessionMessage {
  return { kind: "error", id, requestId, message };
}

function textResult(text: string): ToolResultDetail {
  return { kind: "text", text };
}

const successMessages: SessionMessage[] = [
  user(
    "demo-user-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Build a dev-only demo chat in the sidebar that exercises every rendered chat state without ever sending a real prompt.",
  ),
  reasoning(
    "demo-reasoning-1",
    DEMO_REQUEST_SUCCESS_ID,
    "I’ll reuse the live chat renderer and seed it with a synthetic transcript that touches grouped tool activity, context compaction, failures, todo states, and composer variants.",
  ),
  toolStart(
    "demo-tool-start-skill-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Skill",
    "skill-1",
    { kind: "skill", name: "frontend-design" },
  ),
  toolEnd(
    "demo-tool-end-skill-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Skill",
    "skill-1",
    "Loaded frontend-design",
    false,
    textResult(
      "Loaded the frontend-design skill so the demo surface stays aligned with the existing UI language instead of drifting into a disconnected mock.",
    ),
  ),
  toolStart(
    "demo-tool-start-plan-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Plan",
    "plan-1",
    { kind: "plan", planName: "Demo chat rollout" },
  ),
  toolEnd(
    "demo-tool-end-plan-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Plan",
    "plan-1",
    "Updated the rollout plan",
    false,
    textResult(
      "Tracked four pieces: dev-only sidebar entry, synthetic transcript, prompt-state controls, and todo-state controls.",
    ),
  ),
  toolStart(
    "demo-tool-start-codebase-search-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Codebase Search",
    "codebase-search-1",
    {
      kind: "codebase_search",
      queries: [
        "ChatThread",
        "PromptInputCard",
        "SessionTodoDock",
      ],
    },
  ),
  toolEnd(
    "demo-tool-end-codebase-search-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Codebase Search",
    "codebase-search-1",
    "Found the primary chat surfaces",
    false,
    textResult(
      "The conversation thread, todo dock, and prompt input already render independently, which makes them safe to reuse with local dev-only state.",
    ),
  ),
  toolStart(
    "demo-tool-start-search-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Search",
    "search-1",
    {
      kind: "search",
      pattern: "context_compacted",
      path: `${DEMO_CHAT_WORKSPACE_PATH}/src/components/chat`,
      glob: "*.tsx",
      fileType: "tsx",
    },
  ),
  toolEnd(
    "demo-tool-end-search-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Search",
    "search-1",
    "Matched compaction and error rows",
    false,
    textResult(
      "Found compacted-context, status, and error row renderers so the demo can cover the less common transcript states too.",
    ),
  ),
  toolStart(
    "demo-tool-start-fetch-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Fetch",
    "fetch-1",
    {
      kind: "fetch",
      url: "https://design.local/demo-chat/reference",
    },
  ),
  toolEnd(
    "demo-tool-end-fetch-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Fetch",
    "fetch-1",
    "Loaded reference notes",
    false,
    textResult(
      "Pulled the design checklist for the demo panel: user message, assistant response, work log, compaction row, error path, live request, todo states, and composer variants.",
    ),
  ),
  toolStart(
    "demo-tool-start-read-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Read",
    "read-1",
    {
      kind: "file_read",
      path: `${DEMO_CHAT_WORKSPACE_PATH}/src/components/ConversationPanel.tsx`,
      startLine: 1,
      endLine: 120,
    },
  ),
  toolEnd(
    "demo-tool-end-read-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Read",
    "read-1",
    "Read ConversationPanel.tsx",
    false,
    null,
  ),
  toolStart(
    "demo-tool-start-read-2",
    DEMO_REQUEST_SUCCESS_ID,
    "Read",
    "read-2",
    {
      kind: "file_read",
      path: `${DEMO_CHAT_WORKSPACE_PATH}/src/components/PromptInputCard.tsx`,
      startLine: 1,
      endLine: 200,
    },
  ),
  toolEnd(
    "demo-tool-end-read-2",
    DEMO_REQUEST_SUCCESS_ID,
    "Read",
    "read-2",
    "Read PromptInputCard.tsx",
    false,
    null,
  ),
  toolStart(
    "demo-tool-start-shell-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Shell",
    "shell-1",
    {
      kind: "shell",
      command: "rg --files src/components | rg 'Chat|Prompt|Todo'",
      cwd: DEMO_CHAT_WORKSPACE_PATH,
      description: "Locate the live chat primitives to reuse in the demo panel.",
    },
  ),
  toolEnd(
    "demo-tool-end-shell-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Shell",
    "shell-1",
    "Collected the chat surface files",
    false,
    {
      kind: "shell_output",
      command: "rg --files src/components | rg 'Chat|Prompt|Todo'",
      shell: "zsh",
      exitCode: 0,
      description: "Locate the live chat primitives to reuse in the demo panel.",
      stdout: createOutputPreview(
        [
          "src/components/ConversationPanel.tsx",
          "src/components/PromptInputCard.tsx",
          "src/components/conversation-panel/SessionTodoDock.tsx",
          "src/components/chat/ChatThread.tsx",
        ].join("\n"),
        {
          totalLines: 12,
          tailDisplayLines: "8 more matches hidden",
        },
      ),
      stderr: null,
    },
  ),
  toolStart(
    "demo-tool-start-file-update-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Replace",
    "file-update-1",
    {
      kind: "file_update",
      path: `${DEMO_CHAT_WORKSPACE_PATH}/src/components/demo-chat/DemoConversationPanel.tsx`,
      operation: "replace",
    },
  ),
  toolEnd(
    "demo-tool-end-file-update-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Replace",
    "file-update-1",
    "Patched the demo conversation panel",
    false,
    {
      kind: "file_diff",
      path: "src/components/demo-chat/DemoConversationPanel.tsx",
      patch: [
        "diff --git a/src/components/demo-chat/DemoConversationPanel.tsx b/src/components/demo-chat/DemoConversationPanel.tsx",
        "index 6f6d7c2..f2c1c9b 100644",
        "--- a/src/components/demo-chat/DemoConversationPanel.tsx",
        "+++ b/src/components/demo-chat/DemoConversationPanel.tsx",
        "@@ -1,7 +1,7 @@",
        " export function DemoConversationPanel() {",
        "   return (",
        '-    <section className="demo-chat-shell">',
        '+    <section className="demo-chat">',
        "       <h1>Demo chat</h1>",
        "     </section>",
        "   );",
        " }",
      ].join("\n"),
    },
  ),
  toolStart(
    "demo-tool-start-task-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Task",
    "task-1",
    {
      kind: "task",
      agentId: "worker-demo-1",
    },
  ),
  toolEnd(
    "demo-tool-end-task-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Task",
    "task-1",
    "Delegated a coverage pass",
    false,
    textResult(
      "Asked a worker to verify that the synthetic transcript exercises every row type already implemented in the chat surface.",
    ),
  ),
  toolStart(
    "demo-tool-start-followup-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Follow-up",
    "followup-1",
    {
      kind: "followup",
      question: "Should the demo sheet switch between prompt and follow-up composer states?",
    },
  ),
  toolEnd(
    "demo-tool-end-followup-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Follow-up",
    "followup-1",
    "Captured the composer-state requirement",
    false,
    textResult(
      "Confirmed the demo needs both the regular prompt input and follow-up composer surfaces so state previews stay grounded in the real UI.",
    ),
  ),
  toolStart(
    "demo-tool-start-unknown-1",
    DEMO_REQUEST_SUCCESS_ID,
    "DemoOverlay",
    "unknown-1",
    {
      kind: "unknown",
      name: "demo_overlay",
    },
  ),
  toolEnd(
    "demo-tool-end-unknown-1",
    DEMO_REQUEST_SUCCESS_ID,
    "DemoOverlay",
    "unknown-1",
    "Registered local dev toggles",
    false,
    textResult(
      "Added local controls for thread sections, todo presets, and prompt-state variants without wiring any of them to the backend.",
    ),
  ),
  assistant(
    "demo-assistant-1",
    DEMO_REQUEST_SUCCESS_ID,
    [
      "The synthetic thread covers the full chat surface instead of inventing a one-off mock.",
      "",
      "- Real user and assistant messages",
      "- Grouped tool activity with text, shell, and diff result cards",
      "- Status rows, context compaction, a failed request, and an in-flight request",
      "- Dev controls for todo states and composer variants",
    ].join("\n"),
  ),
  status(
    "demo-status-completion-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Demo transcript assembled",
    "The sidebar entry stays local to dev builds and never sends a real prompt.",
    "completion",
  ),
];

const compactionMessages: SessionMessage[] = [
  contextCompacted(
    "demo-context-compacted-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Earlier design exploration was compacted to keep the conversation moving.",
  ),
  status(
    "demo-status-warning-1",
    DEMO_REQUEST_SUCCESS_ID,
    "Context nearing the limit",
    "Summarizing the prior pass before continuing with the failure case.",
    "warning",
  ),
  statusOutput(
    "demo-status-output-1",
    DEMO_REQUEST_SUCCESS_ID,
    "compaction summary:\n- kept the accepted UI direction\n- dropped duplicate file reads\n- preserved the active todo state",
  ),
];

const failureMessages: SessionMessage[] = [
  user(
    "demo-user-2",
    DEMO_REQUEST_FAILURE_ID,
    "Show me the failure path too, including the follow-up ask and the final error state.",
  ),
  status(
    "demo-status-info-1",
    DEMO_REQUEST_FAILURE_ID,
    "Resume",
    "Using the compacted summary to continue the demo conversation.",
    "info",
  ),
  reasoning(
    "demo-reasoning-2",
    DEMO_REQUEST_FAILURE_ID,
    "I’ll surface a follow-up request first, then fail the preview command so the error work row and final error message both render.",
  ),
  toolStart(
    "demo-tool-start-followup-2",
    DEMO_REQUEST_FAILURE_ID,
    "Follow-up",
    "followup-2",
    {
      kind: "followup",
      question: "Should I retry the preview server on another port if 1420 is busy?",
    },
  ),
  toolEnd(
    "demo-tool-end-followup-2",
    DEMO_REQUEST_FAILURE_ID,
    "Follow-up",
    "followup-2",
    "Asked for retry confirmation",
    false,
    textResult(
      "Queued a follow-up so the composer can switch into text, single-select, or multi-select response modes inside the demo panel.",
    ),
  ),
  toolStart(
    "demo-tool-start-shell-2",
    DEMO_REQUEST_FAILURE_ID,
    "Shell",
    "shell-2",
    {
      kind: "shell",
      command: "bun run dev -- --port 1420",
      cwd: DEMO_CHAT_WORKSPACE_PATH,
      description: "Launch the preview server to validate the dev-only demo chat.",
    },
  ),
  toolEnd(
    "demo-tool-end-shell-2",
    DEMO_REQUEST_FAILURE_ID,
    "Shell",
    "shell-2",
    "Preview failed",
    true,
    {
      kind: "shell_output",
      command: "bun run dev -- --port 1420",
      shell: "zsh",
      exitCode: 1,
      description: "Launch the preview server to validate the dev-only demo chat.",
      stdout: createOutputPreview("vite v8.0.4 dev server starting…"),
      stderr: createOutputPreview(
        [
          "Error: listen EADDRINUSE: address already in use :::1420",
          "Hint: stop the existing dev server or pick another port.",
        ].join("\n"),
      ),
    },
  ),
  status(
    "demo-status-error-1",
    DEMO_REQUEST_FAILURE_ID,
    "Preview failed",
    "Port 1420 is already in use, so the validation pass stopped here.",
    "error",
  ),
  errorMessage(
    "demo-error-1",
    DEMO_REQUEST_FAILURE_ID,
    "The preview server could not start because port 1420 is already in use.",
  ),
];

const liveMessages: SessionMessage[] = [
  user(
    "demo-user-3",
    DEMO_REQUEST_LIVE_ID,
    "Leave one request running so the active shimmer, timer, and open activity rows stay visible.",
  ),
  reasoning(
    "demo-reasoning-3",
    DEMO_REQUEST_LIVE_ID,
    "Still rendering the live state preview and keeping the last request open.",
  ),
  toolStart(
    "demo-tool-start-shell-3",
    DEMO_REQUEST_LIVE_ID,
    "Shell",
    "shell-3",
    {
      kind: "shell",
      command: "bun run lint",
      cwd: DEMO_CHAT_WORKSPACE_PATH,
      description: "Keep one live request open so the working state stays visible.",
    },
  ),
];

export function buildDemoMessages({
  showCompaction,
  showFailure,
  showLiveRequest,
}: DemoChatVisibility): SessionMessage[] {
  return [
    ...successMessages,
    ...(showCompaction ? compactionMessages : []),
    ...(showFailure ? failureMessages : []),
    ...(showLiveRequest ? liveMessages : []),
  ];
}

export function buildDemoActiveRequestIds({
  showLiveRequest,
}: DemoChatVisibility): string[] {
  return showLiveRequest ? [DEMO_REQUEST_LIVE_ID] : [];
}

export const DEMO_REQUEST_TIMINGS: Record<string, RequestTimingInfo> = {
  [DEMO_REQUEST_SUCCESS_ID]: {
    startedAtMs: FIXTURE_CREATED_AT_MS - 182_000,
    completedAtMs: FIXTURE_CREATED_AT_MS - 131_000,
  },
  [DEMO_REQUEST_FAILURE_ID]: {
    startedAtMs: FIXTURE_CREATED_AT_MS - 84_000,
    completedAtMs: FIXTURE_CREATED_AT_MS - 43_000,
  },
  [DEMO_REQUEST_LIVE_ID]: {
    startedAtMs: FIXTURE_CREATED_AT_MS - 14_000,
    completedAtMs: null,
  },
};

export const DEMO_TODO_PRESETS: Record<DemoTodoPreset, SessionTodo[]> = {
  mixed: [
    {
      id: "demo-todo-pending",
      content: "Expose a dev-only demo chat entry in the sidebar",
      status: "pending",
    },
    {
      id: "demo-todo-progress",
      content: "Wire the synthetic transcript into the real thread renderer",
      status: "in_progress",
    },
    {
      id: "demo-todo-completed",
      content: "Cover compacted context and shell/diff result cards",
      status: "completed",
    },
    {
      id: "demo-todo-cancelled",
      content: "Ship the demo as a production feature flag",
      status: "cancelled",
    },
  ],
  busy: [
    {
      id: "demo-todo-busy-1",
      content: "Keep the live request row visible",
      status: "in_progress",
    },
    {
      id: "demo-todo-busy-2",
      content: "Exercise pending todos in the dock preview",
      status: "pending",
    },
    {
      id: "demo-todo-busy-3",
      content: "Lock down real message sending in demo mode",
      status: "pending",
    },
  ],
  complete: [
    {
      id: "demo-todo-complete-1",
      content: "Show the completed todo state",
      status: "completed",
    },
    {
      id: "demo-todo-complete-2",
      content: "Show the removed todo state",
      status: "cancelled",
    },
    {
      id: "demo-todo-complete-3",
      content: "Show the collapsed idle task-plan card",
      status: "completed",
    },
  ],
};

export const DEMO_PROMPT_SETTINGS: PromptSettings = {
  availableModels: [
    {
      providerId: "openai",
      providerName: "OpenAI",
      modelId: "gpt-5.4",
      modelName: "GPT-5.4",
      contextLength: 272_000n,
      supportsReasoning: true,
      reasoningEfforts: ["low", "medium", "high", "xhigh"],
    },
    {
      providerId: "anthropic",
      providerName: "Anthropic",
      modelId: "claude-opus-4.1",
      modelName: "Claude Opus 4.1",
      contextLength: 200_000n,
      supportsReasoning: true,
      reasoningEfforts: ["low", "medium", "high"],
    },
  ],
  selectedProviderId: "openai",
  selectedModelId: "gpt-5.4",
  selectedReasoningEffort: "high",
};

function createFollowupRequest(kind: FollowupKind): FollowupRequest {
  return {
    followupId: `demo-followup-${kind}`,
    workspacePath: DEMO_CHAT_WORKSPACE_PATH,
    conversationId: "demo-chat",
    requestId: DEMO_REQUEST_FAILURE_ID,
    kind,
    question:
      kind === "text"
        ? "How should the demo react when someone presses Send?"
        : "Which follow-up state do you want to preview?",
    options:
      kind === "text"
        ? null
        : [
            { id: "retry", label: "Retry on another port" },
            { id: "keep-demo", label: "Keep the demo local-only" },
            { id: "show-both", label: "Preview both composer surfaces" },
          ],
  };
}

export const DEMO_FOLLOWUP_REQUESTS = {
  text: createFollowupRequest("text"),
  single: createFollowupRequest("single"),
  multi: createFollowupRequest("multi"),
} as const;
