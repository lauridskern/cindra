import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  MapIcon,
  SquareIcon,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/utils/cn";
import type { PromptInputCardProps } from "./types/prompt";

export function PromptInputCard({
  canCompose,
  isRequestActive,
  isSendingPrompt,
  isPlanningMode,
  placeholder = "Ask about this workspace…",
  promptSettings,
  promptDraft,
  setPlanningMode,
  setPromptDraft,
  stopPrompt,
  submitPrompt,
  updatePromptSettings,
}: PromptInputCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const isControlDisabled = isSendingPrompt || isRequestActive || !canCompose;
  const isWorking = isRequestActive;
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
  const normalizedModelSearchQuery = modelSearchQuery.trim().toLowerCase();
  const visibleModels =
    normalizedModelSearchQuery.length === 0
      ? (promptSettings?.availableModels ?? [])
      : (promptSettings?.availableModels.filter((model) => {
          const searchableText = [
            model.modelName,
            model.modelId,
            model.providerName,
            model.providerId,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(normalizedModelSearchQuery);
        }) ?? []);

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
    setIsModelMenuOpen(false);
    setModelSearchQuery("");
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

  function handlePrimaryAction() {
    if (isWorking) {
      void stopPrompt();
      return;
    }

    handleSubmit();
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card
        className={cn(
          "relative gap-0 rounded-2xl border border-foreground/5 bg-background/50 p-2 transition-colors transition-shadow ring-0",
          isPlanningMode &&
            "border-yellow-500/80 ring-5 ring-yellow-500/10 dark:border-yellow-400/10 dark:ring-yellow-500/70 border-dashed",
        )}
      >
        <CardHeader className="sr-only">
          <CardTitle>Prompt</CardTitle>
          <CardDescription>Ask about the current workspace.</CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 p-0">
          <Textarea
            ref={textareaRef}
            id="prompt"
            className="m-1 max-h-80 overflow-y-auto rounded-none border-0 bg-transparent px-0 py-0 text-base leading-7 shadow-none outline-none ring-0 placeholder:text-muted-foreground/80 focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
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
            disabled={isControlDisabled}
            rows={3}
          />
        </CardContent>
        <CardFooter className="relative z-10 items-center justify-between p-0">
          <ButtonGroup aria-label="Prompt controls" className="-mb-1.5">
            <DropdownMenu
              open={isModelMenuOpen}
              onOpenChange={(open) => {
                setIsModelMenuOpen(open);
                if (!open) {
                  setModelSearchQuery("");
                }
              }}
            >
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground hover:bg-transparent hover:text-foreground"
                    disabled={
                      isControlDisabled ||
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
              <DropdownMenuContent align="start" className="max-h-80 w-72 pt-0">
                <div className="sticky z-10 top-0 bg-popover -mx-1 p-1.5">
                  <Input
                    value={modelSearchQuery}
                    placeholder="Search models"
                    className="h-8 bg-popover dark:bg-popover"
                    autoFocus
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setModelSearchQuery(event.target.value);
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                      event.stopPropagation();
                    }}
                  />
                </div>
                <DropdownMenuGroup>
                  <DropdownMenuRadioGroup
                    value={
                      selectedModel == null
                        ? ""
                        : `${selectedModel.providerId}:${selectedModel.modelId}`
                    }
                    onValueChange={handleModelChange}
                  >
                    {visibleModels.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No models match your search.
                      </div>
                    ) : (
                      visibleModels.map((option) => (
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
                      ))
                    )}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground hover:bg-transparent hover:text-foreground"
                    disabled={
                      isControlDisabled || selectedReasoningEfforts.length === 0
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
            <Toggle
              variant="outline"
              size="sm"
              aria-label="Toggle planning mode"
              pressed={isPlanningMode}
              className={cn(
                "text-muted-foreground hover:bg-transparent hover:text-foreground",
                isPlanningMode && "text-foreground",
              )}
              disabled={isControlDisabled}
              onPressedChange={setPlanningMode}
            >
              <MapIcon data-icon="inline-start" />
              {isPlanningMode ? <span className="text-xs">Plan</span> : null}
            </Toggle>
          </ButtonGroup>
          <Button
            type="button"
            size="icon-lg"
            className="rounded-full"
            aria-label={isWorking ? "Stop" : "Send"}
            onClick={handlePrimaryAction}
            disabled={isWorking ? false : isSubmitDisabled}
          >
            {isWorking ? <SquareIcon /> : <ArrowUpIcon />}
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
