import type {
  ToolCallDetail,
  ToolResultDetail,
  TranscriptMessage,
} from "@/services/desktop/contracts";

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

export interface ActivityGroupBuilder {
  requestId: string;
  operations: ActivityOperation[];
  reasoningText: string;
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
