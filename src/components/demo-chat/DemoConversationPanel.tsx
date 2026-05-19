import { useMemo, useState } from "react";
import {
  FlaskConical,
  ListTodo,
  MessagesSquare,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

import {
  removeQueuedPrompt,
  replaceQueuedPromptWithDraftEdit,
  reorderQueuedPrompts,
} from "@/app/promptQueue";
import type { QueuedPromptEntry } from "@/app/types/sessionStore";
import { ChatThread } from "@/components/chat/ChatThread";
import { FollowupComposer } from "@/components/FollowupComposer";
import { ConversationSurface } from "@/components/conversation-panel/ConversationSurface";
import { PromptInputCard } from "@/components/PromptInputCard";
import { SessionTodoDock } from "@/components/conversation-panel/SessionTodoDock";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import type { PromptSettings } from "@/services/desktop/types/contracts";
import { cn } from "@/utils/cn";
import { DEFAULT_PROMPT_DRAFT } from "./constants/demoChat";

import {
  buildDemoActiveRequestIds,
  buildDemoMessages,
  DEMO_CHAT_WORKSPACE_PATH,
  DEMO_FOLLOWUP_REQUESTS,
  DEMO_PROMPT_SETTINGS,
  DEMO_REQUEST_TIMINGS,
  DEMO_TODO_PRESETS,
} from "./demoChatFixtures";
import type {
  DemoChatVisibility,
  DemoBooleanToggleProps,
  DemoComposerMode,
  DemoControlsSheetProps,
  DemoFollowupSubmitInput,
  DemoOptionGroupProps,
  DemoPromptSettingsUpdateInput,
  DemoPromptState,
  DemoTodoPreset,
} from "./types/demoChat";
import { buildPromptSettingsWithoutModels } from "./utils/promptSettings";

const DEMO_QUEUE_SEED: Array<Omit<QueuedPromptEntry, "id">> = [
  {
    isPlanningMode: false,
    value: "Autosaves after you stop typing.",
  },
  {
    isPlanningMode: true,
    value: "Check the queue edit path without sending this early.",
  },
];

let nextDemoQueueId = 0;

function createDemoQueueId(): string {
  nextDemoQueueId += 1;
  return `demo-queued-prompt-${nextDemoQueueId}`;
}

function createDemoQueuedPrompt(
  entry: Omit<QueuedPromptEntry, "id">,
): QueuedPromptEntry {
  return {
    ...entry,
    id: createDemoQueueId(),
  };
}

function DemoOptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: DemoOptionGroupProps<T>) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
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
}: DemoBooleanToggleProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start justify-between gap-4 rounded-xl border px-3 py-2 text-left transition",
        value
          ? "border-foreground/15 bg-foreground/5"
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
          "rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-widest",
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
  fakeQueueMode,
  promptDraft,
  queuedPromptCount,
  promptState,
  showCompaction,
  showFailure,
  showLiveRequest,
  showTodos,
  todoPreset,
  onClearDraft,
  onClearQueue,
  onComposerModeChange,
  onFakeQueueModeChange,
  onPromptStateChange,
  onSeedQueue,
  onSeedDraft,
  onShowCompactionChange,
  onShowFailureChange,
  onShowLiveRequestChange,
  onShowTodosChange,
  onTodoPresetChange,
}: DemoControlsSheetProps) {
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
        className="w-full max-w-md overflow-y-auto border-l border-border/80 bg-background/98 p-0"
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

                  <DemoBooleanToggle
                    label="Fake queue mode"
                    description="Keeps the prompt editable while simulating a running request, so sends add local queue rows."
                    value={fakeQueueMode}
                    onChange={onFakeQueueModeChange}
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
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={onSeedQueue}
                    >
                      Seed queue
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={onClearQueue}
                      disabled={queuedPromptCount === 0}
                    >
                      Clear queue
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
  const [fakeQueueMode, setFakeQueueMode] = useState(false);
  const [promptDraft, setPromptDraft] = useState(DEFAULT_PROMPT_DRAFT);
  const [editingQueuedPromptId, setEditingQueuedPromptId] = useState<
    string | null
  >(null);
  const [queuedPrompts, setQueuedPrompts] = useState<QueuedPromptEntry[]>([]);
  const [isPlanningMode, setPlanningMode] = useState(false);
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
  const isPromptRequestActive =
    promptState === "sending" || (fakeQueueMode && composerMode === "prompt");
  const isPromptSending =
    promptState === "sending" && fakeQueueMode === false;

  function resetDemo() {
    setShowCompaction(true);
    setShowFailure(true);
    setShowLiveRequest(true);
    setShowTodos(true);
    setTodoPreset("mixed");
    setComposerMode("prompt");
    setPromptState("interactive");
    setFakeQueueMode(false);
    setPromptDraft(DEFAULT_PROMPT_DRAFT);
    setEditingQueuedPromptId(null);
    setQueuedPrompts([]);
    setPlanningMode(false);
    setPromptSettings(DEMO_PROMPT_SETTINGS);
    setDemoNotice("Demo mode is local-only. Send and follow-up actions are intercepted.");
  }

  async function handlePromptSettingsUpdate(
    input: DemoPromptSettingsUpdateInput,
  ) {
    setPromptSettings((current) => ({
      ...current,
      selectedProviderId: input.providerId,
      selectedModelId: input.modelId,
      selectedReasoningEffort: input.reasoningEffort ?? null,
    }));
  }

  async function handlePromptSubmit() {
    const prompt = promptDraft.trim();
    if (prompt.length === 0) {
      setDemoNotice("Demo send was blocked because the draft is empty.");
      return;
    }

    if (fakeQueueMode) {
      setQueuedPrompts((current) => [
        ...current,
        createDemoQueuedPrompt({
          isPlanningMode,
          value: prompt,
        }),
      ]);
      setPromptDraft("");
      setEditingQueuedPromptId(null);
      setDemoNotice(`Added "${prompt}" to the fake queue.`);
      return;
    }

    setDemoNotice(`Intercepted send for "${prompt}".`);
  }

  async function handlePromptStop() {
    setDemoNotice("Intercepted a local stop action.");
  }

  function handleQueuedPromptDelete(id: string) {
    setQueuedPrompts((current) => removeQueuedPrompt(current, id));
    setDemoNotice("Removed a fake queued message.");
  }

  function handleQueuedPromptEdit(id: string) {
    const queuedPrompt = queuedPrompts.find((entry) => entry.id === id);
    if (queuedPrompt == null) {
      return;
    }

    setQueuedPrompts((current) =>
      replaceQueuedPromptWithDraftEdit(current, id, {
        editingQueuedPromptId,
        isPending: false,
        isPlanningMode,
        value: promptDraft,
      }),
    );
    setPromptDraft(queuedPrompt.value);
    setEditingQueuedPromptId(queuedPrompt.id);
    setPlanningMode(queuedPrompt.isPlanningMode);
    setDemoNotice("Moved a fake queued message back into the prompt input.");
  }

  function handleQueuedPromptReorder(sourceId: string, targetId: string | null) {
    setQueuedPrompts((current) =>
      reorderQueuedPrompts(current, sourceId, targetId),
    );
  }

  function seedFakeQueue() {
    setQueuedPrompts(DEMO_QUEUE_SEED.map(createDemoQueuedPrompt));
    setFakeQueueMode(true);
    setComposerMode("prompt");
    setPromptState("interactive");
    setEditingQueuedPromptId(null);
    setDemoNotice("Seeded the fake queue.");
  }

  async function handleFollowupSubmit(input: DemoFollowupSubmitInput) {
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
    <ConversationSurface>
      <header className="flex h-9.5 items-center justify-between gap-3 border-b border-black/5 px-3 pr-1.5 dark:border-white/5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-3.5 text-neutral-500 dark:text-neutral-400" />
            <span className="truncate text-xs font-medium tracking-tight text-neutral-800 dark:text-neutral-100">
              Demo chat
            </span>
            <span className="rounded-full bg-amber-500/12 px-1.5 py-0.5 text-xs font-medium uppercase tracking-widest text-amber-700 dark:bg-amber-400/12 dark:text-amber-300">
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
            fakeQueueMode={fakeQueueMode}
            promptDraft={promptDraft}
            queuedPromptCount={queuedPrompts.length}
            promptState={promptState}
            showCompaction={showCompaction}
            showFailure={showFailure}
            showLiveRequest={showLiveRequest}
            showTodos={showTodos}
            todoPreset={todoPreset}
            onClearDraft={() => {
              setPromptDraft("");
              setEditingQueuedPromptId(null);
            }}
            onClearQueue={() => {
              setQueuedPrompts([]);
              setDemoNotice("Cleared the fake queue.");
            }}
            onComposerModeChange={setComposerMode}
            onFakeQueueModeChange={setFakeQueueMode}
            onPromptStateChange={setPromptState}
            onSeedQueue={seedFakeQueue}
            onSeedDraft={() => {
              setPromptDraft(DEFAULT_PROMPT_DRAFT);
              setEditingQueuedPromptId(null);
            }}
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
            isRequestActive={isPromptRequestActive}
            isSendingPrompt={isPromptSending}
            isPlanningMode={isPlanningMode}
            promptSettings={resolvedPromptSettings}
            promptDraft={promptDraft}
            queuedPrompts={queuedPrompts}
            deleteQueuedPrompt={handleQueuedPromptDelete}
            editQueuedPrompt={handleQueuedPromptEdit}
            reorderQueuedPrompt={handleQueuedPromptReorder}
            setPlanningMode={setPlanningMode}
            setPromptDraft={setPromptDraft}
            stopPrompt={handlePromptStop}
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
    </ConversationSurface>
  );
}
