import { useLayoutEffect, useRef } from "react";
import { ChevronDownIcon } from "lucide-react";

import type { PromptSettings } from "@/services/desktop/contracts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PromptInputCardProps {
  canCompose: boolean;
  isSendingPrompt: boolean;
  placeholder?: string;
  promptSettings: PromptSettings | null;
  promptDraft: string;
  setPromptDraft: (value: string) => void;
  submitPrompt: () => Promise<void>;
  updatePromptSettings: (input: {
    providerId: string;
    modelId: string;
    reasoningEffort?: string | null;
  }) => Promise<void>;
}

export function PromptInputCard({
  canCompose,
  isSendingPrompt,
  placeholder = "Ask about this workspace…",
  promptSettings,
  promptDraft,
  setPromptDraft,
  submitPrompt,
  updatePromptSettings,
}: PromptInputCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isSubmitDisabled =
    !canCompose || isSendingPrompt || promptDraft.trim().length === 0;
  const selectedModel =
    promptSettings?.availableModels.find(
      (model) =>
        model.providerId === promptSettings.selectedProviderId &&
        model.modelId === promptSettings.selectedModelId,
    ) ?? null;
  const selectedReasoningEfforts = selectedModel?.reasoningEfforts ?? [];
  const selectedReasoning =
    promptSettings?.selectedReasoningEffort != null &&
    selectedReasoningEfforts.includes(promptSettings.selectedReasoningEffort)
      ? promptSettings.selectedReasoningEffort
      : null;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea == null) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [promptDraft]);

  function handleModelChange(value: string) {
    const nextModel = promptSettings?.availableModels.find(
      (model) => `${model.providerId}:${model.modelId}` === value,
    );
    if (nextModel == null) {
      return;
    }

    const nextReasoning =
      selectedReasoning != null &&
      nextModel.reasoningEfforts.includes(selectedReasoning)
        ? selectedReasoning
        : (nextModel.reasoningEfforts[0] ?? null);

    void updatePromptSettings({
      providerId: nextModel.providerId,
      modelId: nextModel.modelId,
      reasoningEffort: nextReasoning,
    });
  }

  function handleReasoningChange(value: string) {
    if (selectedModel == null) {
      return;
    }

    void updatePromptSettings({
      providerId: selectedModel.providerId,
      modelId: selectedModel.modelId,
      reasoningEffort: value,
    });
  }

  function handleSubmit() {
    if (!canCompose || promptDraft.trim().length === 0) {
      return;
    }

    void submitPrompt();
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card className="gap-0 rounded-xl border border-foreground/10 bg-accent p-3 ring-0">
        <CardHeader className="sr-only">
          <CardTitle>Prompt</CardTitle>
          <CardDescription>Ask about the current workspace.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Label className="sr-only" htmlFor="prompt">
            Prompt
          </Label>
          <Textarea
            ref={textareaRef}
            id="prompt"
            className="max-h-80 overflow-y-auto rounded-none border-0 bg-transparent px-0 py-0 text-base leading-7 shadow-none outline-none ring-0 placeholder:text-muted-foreground/80 focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
            placeholder={placeholder}
            value={promptDraft}
            onChange={(event) => setPromptDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.metaKey || event.ctrlKey) &&
                !isSubmitDisabled
              ) {
                handleSubmit();
              }
            }}
            disabled={!canCompose || isSendingPrompt}
            rows={3}
          />
        </CardContent>
        <CardFooter className="items-center justify-between p-0">
          <div className="flex items-center gap-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:bg-transparent hover:text-foreground"
                    disabled={
                      isSendingPrompt ||
                      (promptSettings?.availableModels.length ?? 0) === 0
                    }
                  />
                }
              >
                <span>
                  {selectedModel?.modelName ??
                    selectedModel?.modelId ??
                    "Model"}
                </span>
                <ChevronDownIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuGroup>
                  <DropdownMenuRadioGroup
                    value={
                      selectedModel == null
                        ? ""
                        : `${selectedModel.providerId}:${selectedModel.modelId}`
                    }
                    onValueChange={handleModelChange}
                  >
                    {promptSettings?.availableModels.map((option) => (
                      <DropdownMenuRadioItem
                        key={`${option.providerId}:${option.modelId}`}
                        value={`${option.providerId}:${option.modelId}`}
                      >
                        <span className="truncate">
                          {option.modelName ?? option.modelId}
                        </span>
                        <span className="ml-auto text-muted-foreground">
                          {option.providerName}
                        </span>
                      </DropdownMenuRadioItem>
                    )) ?? null}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:bg-transparent hover:text-foreground"
                    disabled={
                      isSendingPrompt || selectedReasoningEfforts.length === 0
                    }
                  />
                }
              >
                <span>
                  {selectedReasoning == null
                    ? "Reasoning"
                    : formatReasoningLabel(selectedReasoning)}
                </span>
                <ChevronDownIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuGroup>
                  <DropdownMenuRadioGroup
                    value={selectedReasoning ?? ""}
                    onValueChange={handleReasoningChange}
                  >
                    {selectedReasoningEfforts.map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {formatReasoningLabel(option)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            type="button"
            size="lg"
            aria-label="Send"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
          >
            {isSendingPrompt ? "Sending" : "Send"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function formatReasoningLabel(value: string) {
  if (value === "xhigh") {
    return "XHigh";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}
