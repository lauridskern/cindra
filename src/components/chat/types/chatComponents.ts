import type { LegendListRenderItemProps } from "@legendapp/list/react";
import type { ReactNode } from "react";

import type { RequestTimingInfo } from "@/app/SessionContext";
import type {
  StatusCategory,
  TranscriptMessage,
} from "@/services/desktop/contracts";

import type { ActivityResultModel } from "../activity-results/types/activityResult";
import type {
  ActivityItem,
  ActivityOperation,
  ChatThreadItem,
} from "./chatThread";

export interface ActivityChevronProps {
  open: boolean;
  className?: string;
}

export interface ActivityOperationRowProps {
  operation: ActivityOperation;
  workspacePath: string | null;
}

export interface ActivityResultCardProps {
  children: ReactNode;
  copyText?: string | null;
  footer: {
    leading: string;
    trailing: string;
  };
  title: string;
}

export interface ActivityResultPreformattedBodyProps {
  text: string;
}

export interface ActivityResultRendererProps {
  result: ActivityResultModel;
}

export interface ChatActivityRowProps {
  item: ActivityItem;
  workspacePath: string | null;
}

export type ChatContentMessage = Extract<
  TranscriptMessage,
  { kind: "user" | "assistant" | "reasoning" }
>;

export type ChatEventMessage = Extract<
  TranscriptMessage,
  | { kind: "context_compacted" }
  | { kind: "status" | "status_output" | "tool_start" | "tool_end" | "error" }
>;

export interface ChatEventRowProps {
  message: ChatEventMessage;
}

export interface ChatMessageRowProps {
  message: ChatContentMessage;
}

export interface ChatMarkdownProps {
  text: string;
  className?: string;
}

export interface ChatStatusLabelProps {
  active?: boolean;
  text: string;
}

export type ChatStatusMessage = Extract<
  TranscriptMessage,
  { kind: "status" | "status_output" }
>;

export interface ChatStatusEventRowProps {
  message: ChatStatusMessage;
}

export type ChatToolMessage = Extract<
  TranscriptMessage,
  { kind: "tool_start" | "tool_end" }
>;

export interface ChatToolEventRowProps {
  message: ChatToolMessage;
}

export interface ChatThreadProps {
  activeRequestIds: string[];
  messages: TranscriptMessage[];
  requestTimingsById: Record<string, RequestTimingInfo>;
  workspaceLabel: string;
  workspacePath: string | null;
}

export interface ChatWorkRowProps {
  item: Extract<ChatThreadItem, { kind: "request_work" }>;
  requestTiming?: RequestTimingInfo;
  workspacePath: string | null;
}

export interface FileDiffResultProps {
  result: Extract<ActivityResultModel, { kind: "file_diff" }>;
}

export interface MarkdownChatMessageProps {
  text: string;
  toneClassName: string;
}

export interface RenderChatThreadItemOptions {
  requestTimingsById: Record<string, RequestTimingInfo>;
  workspacePath: string | null;
  itemCount: number;
}

export interface ShellOutputResultProps {
  result: Extract<ActivityResultModel, { kind: "shell" }>;
}

export interface StatusOutputRowProps {
  text: string;
}

export interface StatusRowProps {
  category: StatusCategory;
  subtitle?: string | null;
  title: string;
}

export interface TextOnlyMessageProps {
  text: string;
}

export interface TextResultProps {
  result: Extract<ActivityResultModel, { kind: "text" }>;
}

export interface ToolEndRowProps {
  isError: boolean;
  name: string;
  summary?: string | null;
}

export interface ToolStartRowProps {
  name: string;
}

export interface WorkHeaderLabelProps {
  hasError: boolean;
  isRunning: boolean;
  requestTiming?: RequestTimingInfo;
}

export type ChatThreadRenderItem = LegendListRenderItemProps<ChatThreadItem>;
