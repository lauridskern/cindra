import type { PromptSettings } from "@/services/desktop/types/contracts";

import type { FollowupSubmitInput } from "@/components/types/prompt";

export type DemoComposerMode =
  | "prompt"
  | "followup-text"
  | "followup-single"
  | "followup-multi";

export type DemoPromptState =
  | "interactive"
  | "sending"
  | "disabled"
  | "no-models";

export type DemoTodoPreset = "mixed" | "busy" | "complete";

export interface DemoChatVisibility {
  showCompaction: boolean;
  showFailure: boolean;
  showLiveRequest: boolean;
}

export interface DemoOptionGroupProps<T extends string> {
  label: string;
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}

export interface DemoBooleanToggleProps {
  description: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export interface DemoControlsSheetProps {
  composerMode: DemoComposerMode;
  promptDraft: string;
  promptState: DemoPromptState;
  showCompaction: boolean;
  showFailure: boolean;
  showLiveRequest: boolean;
  showTodos: boolean;
  todoPreset: DemoTodoPreset;
  onClearDraft: () => void;
  onComposerModeChange: (value: DemoComposerMode) => void;
  onPromptStateChange: (value: DemoPromptState) => void;
  onSeedDraft: () => void;
  onShowCompactionChange: (value: boolean) => void;
  onShowFailureChange: (value: boolean) => void;
  onShowLiveRequestChange: (value: boolean) => void;
  onShowTodosChange: (value: boolean) => void;
  onTodoPresetChange: (value: DemoTodoPreset) => void;
}

export interface DemoPromptSettingsUpdateInput {
  providerId: string;
  modelId: string;
  reasoningEffort?: string | null;
}

export interface DemoPromptSettingsBuilder {
  (current: PromptSettings): PromptSettings;
}

export type DemoFollowupSubmitInput = FollowupSubmitInput;
