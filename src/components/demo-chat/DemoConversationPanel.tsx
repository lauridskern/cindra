import { useMemo, useState } from "react";
import {
  FlaskConical,
  ListTodo,
  MessagesSquare,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

import type { PromptSettings } from "@/services/desktop/contracts";
import { ChatThread } from "@/components/chat/ChatThread";
import { FollowupComposer } from "@/components/FollowupComposer";
import { PromptInputCard } from "@/components/PromptInputCard";
import { SessionTodoDock } from "@/components/conversation-panel/SessionTodoDock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  buildDemoActiveRequestIds,
  buildDemoMessages,
  DEMO_CHAT_WORKSPACE_PATH,
  DEMO_FOLLOWUP_REQUESTS,
  DEMO_PROMPT_SETTINGS,
  DEMO_REQUEST_TIMINGS,
  DEMO_TODO_PRESETS,
  type DemoChatVisibility,
  type DemoTodoPreset,
} from "./demoChatFixtures";

type DemoComposerMode =
  | "prompt"
  | "followup-text"
  | "followup-single"
  | "followup-multi";

type DemoPromptState =
  | "interactive"
  | "sending"
  | "disabled"
  | "no-models";

const DEFAULT_PROMPT_DRAFT =
  "Run the demo-only thread through every visible chat state.";

const EMPTY_PROMPT_SETTINGS: PromptSettings = {
  availableModels: [],
  selectedProviderId: null,
  selectedModelId: null,
  selectedReasoningEffort: null,
};

function buildPromptSettingsWithoutModels(
  current: PromptSettings,
): PromptSettings {
  return {
    ...EMPTY_PROMPT_SETTINGS,
    selectedReasoningEffort: current.selectedReasoningEffort,
  };
}

function DemoOptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="xs"
            variant={value === option.value ? "secondary" : "outline"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function DemoBooleanToggle({
  description,
  label,
  value,
  onChange,
}: {
  description: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start justify-between gap-4 rounded-xl border px-3 py-2 text-left transition",
        value
          ? "border-foreground/15 bg-foreground/[0.04]"
          : "border-border bg-background hover:bg-accent/50",
      )}
      onClick={() => onChange(!value)}
    >
      <div className="grid gap-1">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em]",
          value
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground",
        )}
      >
        {value ? "On" : "Off"}
      </span>
    </button>
  );
}

function DemoControlsSheet({
  composerMode,
  promptDraft,
  promptState,
  showCompaction,
  showFailure,
  showLiveRequest,
  showTodos,
  todoPreset,
  onClearDraft,
  onComposerModeChange,
  onPromptStateChange,
  onSeedDraft,
  onShowCompactionChange,
  onShowFailureChange,
  onShowLiveRequestChange,
  onShowTodosChange,
  onTodoPresetChange,
}: {
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
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <SlidersHorizontal />
        Controls
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[28rem] overflow-y-auto border-l border-border/80 bg-background/98 p-0"
      >
        <SheetHeader className="border-b border-border/70">
          <SheetTitle>Demo Controls</SheetTitle>
          <SheetDescription>
            Toggle the unusual chat states without touching a real conversation.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 p-6">
          <Card size="sm" className="border-border/70 bg-background/90 shadow-sm">
            <CardHeader className="gap-2">
              <CardTitle className="flex items-center gap-2">
                <MessagesSquare className="size-4 text-muted-foreground" />
                Transcript coverage
              </CardTitle>
              <CardDescription>
                The synthetic thread already includes grouped tool activity,
                diff and shell result cards, status rows, context compaction,
                a hard failure, and a live in-flight request.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card size="sm" className="border-border/70 bg-background/90 shadow-sm">
            <CardHeader className="gap-3">
              <CardTitle>Thread sections</CardTitle>
              <CardDescription>
                Enable or remove transcript segments from the live demo.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <DemoBooleanToggle
                label="Compacted context"
                description="Shows the compaction row, warning status, and standalone status output."
                value={showCompaction}
                onChange={onShowCompactionChange}
              />
              <DemoBooleanToggle
                label="Failure path"
                description="Shows a follow-up request, a failed shell command, and the final error row."
                value={showFailure}
                onChange={onShowFailureChange}
              />
              <DemoBooleanToggle
                label="Live request"
                description="Leaves one request running so the shimmer, timer, and open activity state stay visible."
                value={showLiveRequest}
                onChange={onShowLiveRequestChange}
              />
            </CardContent>
          </Card>

          <Card size="sm" className="border-border/70 bg-background/90 shadow-sm">
            <CardHeader className="gap-3">
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="size-4 text-muted-foreground" />
                Todo dock
              </CardTitle>
              <CardDescription>
                `todo_read` and `todo_write` surface here rather than in the
                thread activity list.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <DemoBooleanToggle
                label="Show todo dock"
                description="Turn the task-plan card on or off."
                value={showTodos}
                onChange={onShowTodosChange}
              />
              <DemoOptionGroup
                label="Todo preset"
                options={[
                  { label: "Mixed", value: "mixed" },
                  { label: "Busy", value: "busy" },
                  { label: "Complete", value: "complete" },
                ]}
                value={todoPreset}
                onChange={onTodoPresetChange}
              />
            </CardContent>
          </Card>

          <Card size="sm" className="border-border/70 bg-background/90 shadow-sm">
            <CardHeader className="gap-3">
              <CardTitle>Composer</CardTitle>
              <CardDescription>
                Switch between the regular prompt card and follow-up variants.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <DemoOptionGroup
                label="Composer mode"
                options={[
                  { label: "Prompt", value: "prompt" },
                  { label: "Follow-up text", value: "followup-text" },
                  { label: "Follow-up single", value: "followup-single" },
                  { label: "Follow-up multi", value: "followup-multi" },
                ]}
                value={composerMode}
                onChange={onComposerModeChange}
              />

              {composerMode === "prompt" ? (
                <>
                  <DemoOptionGroup
                    label="Prompt state"
                    options={[
                      { label: "Interactive", value: "interactive" },
                      { label: "Sending", value: "sending" },
                      { label: "Disabled", value: "disabled" },
                      { label: "No models", value: "no-models" },
                    ]}
                    value={promptState}
                    onChange={onPromptStateChange}
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={onSeedDraft}
                    >
                      Seed draft
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={onClearDraft}
                      disabled={promptDraft.length === 0}
                    >
                      Clear draft
                    </Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DemoConversationPanel() {
  const [showCompaction, setShowCompaction] = useState(true);
  const [showFailure, setShowFailure] = useState(true);
  const [showLiveRequest, setShowLiveRequest] = useState(true);
  const [showTodos, setShowTodos] = useState(true);
  const [todoPreset, setTodoPreset] = useState<DemoTodoPreset>("mixed");
  const [composerMode, setComposerMode] = useState<DemoComposerMode>("prompt");
  const [promptState, setPromptState] =
    useState<DemoPromptState>("interactive");
  const [promptDraft, setPromptDraft] = useState(DEFAULT_PROMPT_DRAFT);
  const [promptSettings, setPromptSettings] =
    useState<PromptSettings>(DEMO_PROMPT_SETTINGS);
  const [demoNotice, setDemoNotice] = useState<string | null>(
    "Demo mode is local-only. Send and follow-up actions are intercepted.",
  );

  const visibility = useMemo<DemoChatVisibility>(
    () => ({
      showCompaction,
      showFailure,
      showLiveRequest,
    }),
    [showCompaction, showFailure, showLiveRequest],
  );
  const messages = useMemo(() => buildDemoMessages(visibility), [visibility]);
  const activeRequestIds = useMemo(
    () => buildDemoActiveRequestIds(visibility),
    [visibility],
  );
  const todos = showTodos ? DEMO_TODO_PRESETS[todoPreset] : [];
  const resolvedPromptSettings =
    promptState === "no-models"
      ? buildPromptSettingsWithoutModels(promptSettings)
      : promptSettings;
  const followupRequest =
    composerMode === "followup-text"
      ? DEMO_FOLLOWUP_REQUESTS.text
      : composerMode === "followup-single"
        ? DEMO_FOLLOWUP_REQUESTS.single
        : composerMode === "followup-multi"
          ? DEMO_FOLLOWUP_REQUESTS.multi
          : null;

  function resetDemo() {
    setShowCompaction(true);
    setShowFailure(true);
    setShowLiveRequest(true);
    setShowTodos(true);
    setTodoPreset("mixed");
    setComposerMode("prompt");
    setPromptState("interactive");
    setPromptDraft(DEFAULT_PROMPT_DRAFT);
    setPromptSettings(DEMO_PROMPT_SETTINGS);
    setDemoNotice("Demo mode is local-only. Send and follow-up actions are intercepted.");
  }

  async function handlePromptSettingsUpdate(input: {
    providerId: string;
    modelId: string;
    reasoningEffort?: string | null;
  }) {
    setPromptSettings((current) => ({
      ...current,
      selectedProviderId: input.providerId,
      selectedModelId: input.modelId,
      selectedReasoningEffort: input.reasoningEffort ?? null,
    }));
  }

  async function handlePromptSubmit() {
    setDemoNotice(
      promptDraft.trim().length === 0
        ? "Demo send was blocked because the draft is empty."
        : `Intercepted send for "${promptDraft.trim()}".`,
    );
  }

  async function handleFollowupSubmit(input: {
    cancelled: boolean;
    text?: string;
    selectedOptionIds?: string[];
  }) {
    if (input.cancelled) {
      setDemoNotice("Intercepted a local follow-up cancel action.");
      return;
    }

    if (input.text?.trim()) {
      setDemoNotice(`Intercepted follow-up text: "${input.text.trim()}".`);
      return;
    }

    const selectedOptions = input.selectedOptionIds?.join(", ");
    setDemoNotice(
      selectedOptions && selectedOptions.length > 0
        ? `Intercepted follow-up choices: ${selectedOptions}.`
        : "Intercepted a local follow-up submission.",
    );
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white/80 shadow-xl shadow-neutral-950/5 backdrop-blur-xl dark:bg-neutral-900/80 dark:shadow-black/20">
      <header className="flex h-9.5 items-center justify-between gap-3 border-b border-black/5 px-3 pr-1.5 dark:border-white/5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-3.5 text-neutral-500 dark:text-neutral-400" />
            <span className="truncate text-xs font-medium tracking-tight text-neutral-800 dark:text-neutral-100">
              Demo chat
            </span>
            <span className="rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-400/12 dark:text-amber-300">
              Dev only
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={resetDemo}>
            <RefreshCw />
            Reset
          </Button>
          <DemoControlsSheet
            composerMode={composerMode}
            promptDraft={promptDraft}
            promptState={promptState}
            showCompaction={showCompaction}
            showFailure={showFailure}
            showLiveRequest={showLiveRequest}
            showTodos={showTodos}
            todoPreset={todoPreset}
            onClearDraft={() => setPromptDraft("")}
            onComposerModeChange={setComposerMode}
            onPromptStateChange={setPromptState}
            onSeedDraft={() => setPromptDraft(DEFAULT_PROMPT_DRAFT)}
            onShowCompactionChange={setShowCompaction}
            onShowFailureChange={setShowFailure}
            onShowLiveRequestChange={setShowLiveRequest}
            onShowTodosChange={setShowTodos}
            onTodoPresetChange={setTodoPreset}
          />
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-hidden select-text px-6">
        <ChatThread
          activeRequestIds={activeRequestIds}
          messages={messages}
          requestTimingsById={DEMO_REQUEST_TIMINGS}
          workspaceLabel="Demo chat"
          workspacePath={DEMO_CHAT_WORKSPACE_PATH}
        />
      </section>

      <div className="px-6 pb-6">
        <SessionTodoDock
          isRequestActive={activeRequestIds.length > 0}
          todos={todos}
        />

        {followupRequest != null ? (
          <FollowupComposer
            key={followupRequest.followupId}
            followupRequest={followupRequest}
            onSubmit={handleFollowupSubmit}
          />
        ) : (
          <PromptInputCard
            canCompose={promptState !== "disabled"}
            isSendingPrompt={promptState === "sending"}
            promptSettings={resolvedPromptSettings}
            promptDraft={promptDraft}
            setPromptDraft={setPromptDraft}
            submitPrompt={handlePromptSubmit}
            updatePromptSettings={handlePromptSettingsUpdate}
          />
        )}

        {demoNotice ? (
          <p className="mx-auto mt-3 max-w-3xl rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs text-muted-foreground">
            {demoNotice}
          </p>
        ) : null}
      </div>
    </section>
  );
}
