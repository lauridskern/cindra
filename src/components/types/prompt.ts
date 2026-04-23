import type {
  ChatBinding,
  FollowupRequest,
  PromptSettings,
} from "@/services/desktop/contracts";

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

export interface PromptSettingsUpdateInput {
  providerId: string;
  modelId: string;
  reasoningEffort?: string | null;
}

export interface PromptInputCardProps {
  canCompose: boolean;
  isRequestActive: boolean;
  isSendingPrompt: boolean;
  isPlanningMode: boolean;
  placeholder?: string;
  promptSettings: PromptSettings | null;
  promptDraft: string;
  setPlanningMode: (value: boolean) => void;
  setPromptDraft: (value: string) => void;
  stopPrompt: () => Promise<void>;
  submitPrompt: () => Promise<void>;
  updatePromptSettings: (input: PromptSettingsUpdateInput) => Promise<void>;
}
