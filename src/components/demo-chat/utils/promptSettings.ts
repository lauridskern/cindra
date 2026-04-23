import type { PromptSettings } from "@/services/desktop/types/contracts";

const EMPTY_PROMPT_SETTINGS: PromptSettings = {
  availableModels: [],
  selectedProviderId: null,
  selectedModelId: null,
  selectedReasoningEffort: null,
};

export function buildPromptSettingsWithoutModels(
  current: PromptSettings,
): PromptSettings {
  return {
    ...EMPTY_PROMPT_SETTINGS,
    selectedReasoningEffort: current.selectedReasoningEffort,
  };
}
