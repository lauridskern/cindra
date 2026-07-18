import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  FileTextIcon,
  Loader2Icon,
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
import { useAutosizeTextarea } from "@/hooks/useAutosizeTextarea";
import { usePromptModelPicker } from "@/hooks/usePromptModelPicker";
import { searchWorkspaceFiles } from "@/services/desktop/client";
import { cn } from "@/utils/cn";
import { formatReasoningEffortLabel } from "@/utils/reasoning";
import type { PromptInputCardProps } from "./types/prompt";

const FILE_MENTION_LIMIT = 20;
const FILE_MENTION_PATTERN = /(^|\s)@([\w./\\-]*)$/;

export function PromptInputCard({
  canCompose,
  isRequestActive,
  isSendingPrompt,
  isPlanningMode,
  placeholder = "Ask about this workspace…",
  promptSettings,
  promptDraft,
  workspacePath,
  isInputDisabled = false,
  setPlanningMode,
  setPromptDraft,
  stopPrompt,
  submitPrompt,
  updatePromptSettings,
}: PromptInputCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [fileMentionResults, setFileMentionResults] = useState<string[]>([]);
  const [fileMentionQuery, setFileMentionQuery] = useState<string | null>(null);
  const [fileMentionIndex, setFileMentionIndex] = useState(0);
  const [dismissedFileMentionKey, setDismissedFileMentionKey] = useState<string | null>(null);
  const [isFileMentionLoading, setIsFileMentionLoading] = useState(false);
  const [fileMentionError, setFileMentionError] = useState<string | null>(null);
  const isControlDisabled =
    isSendingPrompt || isRequestActive || !canCompose || isInputDisabled;
  const isWorking = isRequestActive;
  const isSubmitDisabled =
    !canCompose ||
    isSendingPrompt ||
    isInputDisabled ||
    promptDraft.trim().length === 0;
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

  const fileMentionRange = useMemo(() => {
    const cursor = textareaRef.current?.selectionStart ?? promptDraft.length;
    const beforeCursor = promptDraft.slice(0, cursor);
    const match = FILE_MENTION_PATTERN.exec(beforeCursor);
    if (match == null) {
      return null;
    }

    const prefix = match[1] ?? "";
    return {
      end: cursor,
      query: match[2] ?? "",
      start: beforeCursor.length - match[0].length + prefix.length,
    };
  }, [promptDraft]);

  const fileMentionKey =
    fileMentionRange == null
      ? null
      : `${fileMentionRange.start}:${fileMentionRange.end}:${fileMentionRange.query}`;
  const fileMentionOpen =
    !isControlDisabled &&
    workspacePath != null &&
    fileMentionRange != null &&
    fileMentionKey !== dismissedFileMentionKey;

  const selectedFileMention = fileMentionResults[fileMentionIndex] ?? null;

  useEffect(() => {
    if (!fileMentionOpen || workspacePath == null || fileMentionRange == null) {
      setFileMentionResults([]);
      setFileMentionQuery(null);
      setFileMentionIndex(0);
      setIsFileMentionLoading(false);
      setFileMentionError(null);
      return;
    }

    let cancelled = false;
    setFileMentionQuery(fileMentionRange.query);
    setFileMentionIndex(0);
    setIsFileMentionLoading(true);
    setFileMentionError(null);

    const timeoutId = window.setTimeout(() => {
      searchWorkspaceFiles(
        workspacePath,
        fileMentionRange.query,
        FILE_MENTION_LIMIT,
      )
        .then((paths) => {
          if (!cancelled) {
            setFileMentionResults(paths);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setFileMentionResults([]);
            setFileMentionError(
              error instanceof Error ? error.message : "Unable to search files.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsFileMentionLoading(false);
          }
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [fileMentionOpen, fileMentionRange, workspacePath]);

  const insertFileMention = useCallback(
    (path: string) => {
      if (fileMentionRange == null) {
        return;
      }

      const insertedText = `@[${path}] `;
      const nextDraft =
        promptDraft.slice(0, fileMentionRange.start) +
        insertedText +
        promptDraft.slice(fileMentionRange.end);
      const nextCursor = fileMentionRange.start + insertedText.length;

      setPromptDraft(nextDraft);
      setFileMentionResults([]);
      setFileMentionQuery(null);
      setFileMentionIndex(0);
      setDismissedFileMentionKey(null);

      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [fileMentionRange, promptDraft, setPromptDraft],
  );

  function handleSubmit() {
    if (isSubmitDisabled) {
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
            className="m-1 max-h-80 overflow-y-auto rounded-none border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none ring-0 placeholder:text-muted-foreground/80 focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
            placeholder={placeholder}
            value={promptDraft}
            onChange={(event) => setPromptDraft(event.target.value)}
            onKeyDown={(event) => {
              if (fileMentionOpen) {
                if (event.key === "ArrowDown" && fileMentionResults.length > 0) {
                  event.preventDefault();
                  setFileMentionIndex((index) =>
                    Math.min(index + 1, fileMentionResults.length - 1),
                  );
                  return;
                }

                if (event.key === "ArrowUp" && fileMentionResults.length > 0) {
                  event.preventDefault();
                  setFileMentionIndex((index) => Math.max(index - 1, 0));
                  return;
                }

                if (
                  (event.key === "Enter" || event.key === "Tab") &&
                  selectedFileMention != null
                ) {
                  event.preventDefault();
                  insertFileMention(selectedFileMention);
                  return;
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  setFileMentionResults([]);
                  setFileMentionQuery(null);
                  setDismissedFileMentionKey(fileMentionKey);
                  return;
                }
              }

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
          {fileMentionOpen ? (
            <div className="absolute inset-x-0 bottom-full z-30 mb-2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                {isFileMentionLoading ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  <FileTextIcon className="size-3" />
                )}
                <span>
                  {fileMentionQuery == null || fileMentionQuery.length === 0
                    ? "Search files"
                    : `Search files matching “${fileMentionQuery}”`}
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto p-1">
                {fileMentionError != null ? (
                  <div className="px-2 py-2 text-xs text-destructive">
                    {fileMentionError}
                  </div>
                ) : fileMentionResults.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    {isFileMentionLoading ? "Searching…" : "No files found."}
                  </div>
                ) : (
                  fileMentionResults.map((path, index) => (
                    <button
                      key={path}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none transition-colors",
                        index === fileMentionIndex
                          ? "bg-accent text-accent-foreground"
                          : "text-popover-foreground hover:bg-accent/70 hover:text-accent-foreground",
                      )}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        insertFileMention(path);
                      }}
                    >
                      <FileTextIcon className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono">{path}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
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
                    disabled={isControlDisabled || !hasAvailableModels}
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
