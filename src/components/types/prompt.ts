import type {
  ChatBinding,
  FollowupRequest,
  PromptSettings,
} from "@/services/desktop/types/contracts";
import type { QueuedPromptEntry } from "@/app/types/sessionStore";
import type { WorkspacePromptSettingsUpdateInput } from "@/app/types/sessionClientActions";

export interface FollowupSubmitInput {
  cancelled: boolean;
  text?: string;
  selectedOptionIds?: string[];
}

export interface FollowupComposerProps {
  followupRequest: FollowupRequest;
  onSubmit?: (input: FollowupSubmitInput) => Promise<void> | void;
}

export interface PromptComposerProps {
  binding?: ChatBinding | null;
}

export type PromptSettingsUpdateInput = WorkspacePromptSettingsUpdateInput;

export interface PromptInputCardProps {
  canCompose: boolean;
  isRequestActive: boolean;
  isSendingPrompt: boolean;
  isPlanningMode: boolean;
  placeholder?: string;
  promptSettings: PromptSettings | null;
  promptDraft: string;
  queuedPrompts: QueuedPromptEntry[];
  isInputDisabled?: boolean;
  deleteQueuedPrompt: (id: string) => void;
  editQueuedPrompt: (id: string) => void;
  reorderQueuedPrompt: (sourceId: string, targetId: string | null) => void;
  setPlanningMode: (value: boolean) => void;
  setPromptDraft: (value: string) => void;
  stopPrompt: () => Promise<void>;
  submitPrompt: () => Promise<void>;
  updatePromptSettings: (input: PromptSettingsUpdateInput) => Promise<void>;
}
