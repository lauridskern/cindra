import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { QueuedPromptEntry } from "@/app/types/sessionStore";
import type { PromptSettings } from "@/services/desktop/types/contracts";

import { PromptInputCard } from "./PromptInputCard";

const promptSettings: PromptSettings = {
  availableModels: [
    {
      contextLength: null,
      modelId: "gpt-5.4",
      modelName: "GPT-5.4",
      providerId: "openai",
      providerName: "OpenAI",
      reasoningEfforts: ["medium"],
      supportsReasoning: true,
    },
  ],
  selectedModelId: "gpt-5.4",
  selectedProviderId: "openai",
  selectedReasoningEffort: "medium",
};

function renderPromptInputCard(
  promptDraft: string,
  queuedPrompts: QueuedPromptEntry[] = [],
) {
  return renderToStaticMarkup(
    <PromptInputCard
      canCompose={true}
      isRequestActive={true}
      isSendingPrompt={false}
      isPlanningMode={false}
      promptSettings={promptSettings}
      promptDraft={promptDraft}
      queuedPrompts={queuedPrompts}
      deleteQueuedPrompt={() => {}}
      editQueuedPrompt={() => {}}
      reorderQueuedPrompt={() => {}}
      setPlanningMode={() => {}}
      setPromptDraft={() => {}}
      stopPrompt={async () => {}}
      submitPrompt={async () => {}}
      updatePromptSettings={async () => {}}
    />,
  );
}

describe("PromptInputCard", () => {
  test("shows stop while an agent is working with an empty draft", () => {
    expect(renderPromptInputCard("   ")).toContain('aria-label="Stop"');
  });

  test("shows send while an agent is working with a non-empty draft", () => {
    expect(renderPromptInputCard("add this to the queue")).toContain(
      'aria-label="Send"',
    );
  });

  test("renders queued messages with edit and delete actions", () => {
    const markup = renderPromptInputCard("", [
      {
        id: "queued-1",
        isPlanningMode: false,
        value: "Autosaves after you stop typing.",
      },
    ]);

    expect(markup).toContain("Autosaves after you stop typing.");
    expect(markup).toContain('aria-label="Edit queued message"');
    expect(markup).toContain('aria-label="Delete queued message"');
  });
});
