import { useRef } from "react";
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
import { useAutosizeTextarea } from "@/hooks/useAutosizeTextarea";
import { usePromptModelPicker } from "@/hooks/usePromptModelPicker";
import { cn } from "@/utils/cn";
import { formatReasoningEffortLabel } from "@/utils/reasoning";
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
  const isControlDisabled = isSendingPrompt || isRequestActive || !canCompose;
  const isWorking = isRequestActive;
  const isSubmitDisabled =
    !canCompose || isSendingPrompt || promptDraft.trim().length === 0;
  const {
    handleModelChange,
    handleModelMenuOpenChange,
    handleReasoningChange,
    hasAvailableModels,
    isModelMenuOpen,
    modelSearchQuery,
    selectedModel,
    selectedModelValue,
    selectedReasoning,
    selectedReasoningEfforts,
    setModelSearchQuery,
    visibleModels,
  } = usePromptModelPicker({
    promptSettings,
    updatePromptSettings,
  });

  useAutosizeTextarea(textareaRef, promptDraft);

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

  function handlePlanningModeToggle() {
    setPlanningMode(!isPlanningMode);
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
              onOpenChange={handleModelMenuOpenChange}
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
                      !hasAvailableModels
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
                    onChange={(event) => {
                      setModelSearchQuery(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                    }}
                  />
                </div>
                <DropdownMenuGroup>
                  <DropdownMenuRadioGroup
                    value={selectedModelValue}
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
                      : formatReasoningEffortLabel(selectedReasoning)}
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
                        {formatReasoningEffortLabel(option)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Toggle planning mode"
              aria-pressed={isPlanningMode}
              className={cn(
                "text-muted-foreground hover:bg-transparent hover:text-foreground",
                isPlanningMode &&
                  "border-yellow-500/60 bg-yellow-500/10 text-foreground hover:bg-yellow-500/15",
              )}
              disabled={isControlDisabled}
              onClick={handlePlanningModeToggle}
            >
              <MapIcon data-icon="inline-start" />
              <span className="text-xs">Plan</span>
            </Button>
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
