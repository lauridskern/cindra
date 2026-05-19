import { useRef, useState, type DragEvent } from "react";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  GripVerticalIcon,
  MapIcon,
  PencilLineIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";

import type { QueuedPromptEntry } from "@/app/types/sessionStore";
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
import { useAutosizeTextarea } from "@/hooks/useAutosizeTextarea";
import { usePromptModelPicker } from "@/hooks/usePromptModelPicker";
import { cn } from "@/utils/cn";
import { formatReasoningEffortLabel } from "@/utils/reasoning";
import type { PromptInputCardProps } from "./types/prompt";

interface QueuedPromptListProps {
  queuedPrompts: QueuedPromptEntry[];
  deleteQueuedPrompt: (id: string) => void;
  editQueuedPrompt: (id: string) => void;
  reorderQueuedPrompt: (sourceId: string, targetId: string | null) => void;
}

export function PromptInputCard({
  canCompose,
  isRequestActive,
  isSendingPrompt,
  isPlanningMode,
  placeholder = "Ask about this workspace…",
  promptSettings,
  queuedPrompts,
  promptDraft,
  isInputDisabled = false,
  deleteQueuedPrompt,
  editQueuedPrompt,
  reorderQueuedPrompt,
  setPlanningMode,
  setPromptDraft,
  stopPrompt,
  submitPrompt,
  updatePromptSettings,
}: PromptInputCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isWorking = isRequestActive;
  const hasQueuedPrompts = queuedPrompts.length > 0;
  const hasPromptDraft = promptDraft.trim().length > 0;
  const isStopAction = isWorking && hasPromptDraft === false;
  const isSubmitDisabled =
    canCompose === false ||
    isSendingPrompt ||
    isInputDisabled ||
    hasPromptDraft === false;
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
    if (isSubmitDisabled) {
      return;
    }

    void submitPrompt();
  }

  function handlePrimaryAction() {
    if (isStopAction) {
      void stopPrompt();
      return;
    }

    handleSubmit();
  }

  function handlePlanningModeToggle() {
    setPlanningMode(isPlanningMode === false);
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
          {hasQueuedPrompts ? (
            <QueuedPromptList
              queuedPrompts={queuedPrompts}
              deleteQueuedPrompt={deleteQueuedPrompt}
              editQueuedPrompt={editQueuedPrompt}
              reorderQueuedPrompt={reorderQueuedPrompt}
            />
          ) : null}
          <Textarea
            ref={textareaRef}
            id="prompt"
            className="m-1 max-h-80 overflow-y-auto rounded-none border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none ring-0 placeholder:text-muted-foreground/80 focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
            placeholder={placeholder}
            value={promptDraft}
            onChange={(event) => setPromptDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.metaKey || event.ctrlKey) &&
                isSubmitDisabled === false
              ) {
                handleSubmit();
              }
            }}
            disabled={isInputDisabled || canCompose === false || isSendingPrompt}
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
                      isInputDisabled ||
                      isSendingPrompt ||
                      hasAvailableModels === false
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
                      isInputDisabled ||
                      isSendingPrompt ||
                      selectedReasoningEfforts.length === 0
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
              disabled={isInputDisabled || isSendingPrompt}
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
            aria-label={isStopAction ? "Stop" : "Send"}
            onClick={handlePrimaryAction}
            disabled={isStopAction ? false : isSubmitDisabled}
          >
            {isStopAction ? <SquareIcon /> : <ArrowUpIcon />}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function QueuedPromptList({
  queuedPrompts,
  deleteQueuedPrompt,
  editQueuedPrompt,
  reorderQueuedPrompt,
}: QueuedPromptListProps) {
  const [draggedQueuedPromptId, setDraggedQueuedPromptId] = useState<
    string | null
  >(null);

  function handleDragOver(event: DragEvent, targetId: string | null) {
    event.preventDefault();
    if (draggedQueuedPromptId == null || draggedQueuedPromptId === targetId) {
      return;
    }

    reorderQueuedPrompt(draggedQueuedPromptId, targetId);
  }

  return (
    <div
      className="mx-1 mb-2 overflow-hidden rounded-lg border border-border/70 bg-muted/35"
      onDragOver={(event) => handleDragOver(event, null)}
      onDrop={(event) => {
        event.preventDefault();
        setDraggedQueuedPromptId(null);
      }}
    >
      <div className="flex flex-col divide-y divide-border/70">
        {queuedPrompts.map((queuedPrompt, index) => {
          const isDragging = draggedQueuedPromptId === queuedPrompt.id;

          return (
            <div
              key={queuedPrompt.id}
              className={cn(
                "flex items-start gap-2 px-2 py-2 text-xs transition-colors",
                isDragging && "bg-background/80 opacity-60",
              )}
              onDragOver={(event) => {
                event.stopPropagation();
                const targetRect = event.currentTarget.getBoundingClientRect();
                const isAfterTarget =
                  event.clientY > targetRect.top + targetRect.height / 2;
                handleDragOver(
                  event,
                  isAfterTarget
                    ? (queuedPrompts[index + 1]?.id ?? null)
                    : queuedPrompt.id,
                );
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDraggedQueuedPromptId(null);
              }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="-ml-1 cursor-grab text-muted-foreground active:cursor-grabbing"
                aria-label="Reorder queued message"
                draggable
                onDragStart={(event) => {
                  setDraggedQueuedPromptId(queuedPrompt.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", queuedPrompt.id);
                }}
                onDragEnd={() => setDraggedQueuedPromptId(null)}
              >
                <GripVerticalIcon />
              </Button>
              <div className="min-w-0 flex-1 whitespace-pre-wrap break-words pt-0.5 text-muted-foreground">
                {queuedPrompt.value}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit queued message"
                  onClick={() => editQueuedPrompt(queuedPrompt.id)}
                >
                  <PencilLineIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete queued message"
                  onClick={() => deleteQueuedPrompt(queuedPrompt.id)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
