import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ListTodo,
  LoaderCircle,
  XCircle,
} from "lucide-react";

import type { SessionTodo } from "@/services/desktop/contracts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SessionTodoDockProps {
  isRequestActive: boolean;
  todos: SessionTodo[];
}

export function SessionTodoDock({
  isRequestActive,
  todos,
}: SessionTodoDockProps) {
  const hasActiveTodo = todos.some(isActiveTodo);
  const isBusy = isRequestActive || hasActiveTodo;

  if (todos.length === 0) {
    return null;
  }

  return (
    <SessionTodoDockCard
      key={isBusy ? "busy" : "idle"}
      isBusy={isBusy}
      previewTodo={selectPreviewTodo(todos)}
      summary={buildTodoSummary(todos)}
      todos={todos}
    />
  );
}

function SessionTodoDockCard({
  isBusy,
  previewTodo,
  summary,
  todos,
}: {
  isBusy: boolean;
  previewTodo: SessionTodo | null;
  summary: string;
  todos: SessionTodo[];
}) {
  const [isIdleCollapsed, setIsIdleCollapsed] = useState(true);
  const open = isBusy || !isIdleCollapsed;

  return (
    <div className="mx-auto mb-3 w-full max-w-3xl">
      <Collapsible
        open={open}
        onOpenChange={(nextOpen) => {
          if (isBusy) {
            return;
          }

          setIsIdleCollapsed(!nextOpen);
        }}
      >
        <Card
          size="sm"
          className="border border-border/70 bg-background/90 shadow-sm"
        >
          <CardHeader className="gap-3">
            <CollapsibleTrigger className="group flex w-full items-start justify-between gap-3 text-left">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <ListTodo className="size-4 text-muted-foreground" />
                  <CardTitle>Task plan</CardTitle>
                </div>
                <CardDescription>{summary}</CardDescription>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {open ? "Hide" : "Show"}
                {open ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </span>
            </CollapsibleTrigger>

            {previewTodo != null ? (
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {previewLabel(previewTodo.status)}
                </p>
                <div className="mt-1 flex items-start gap-2 text-sm/relaxed">
                  <TodoStatusIcon status={previewTodo.status} />
                  <span className={todoTextClassName(previewTodo.status)}>
                    {previewTodo.content}
                  </span>
                </div>
              </div>
            ) : null}
          </CardHeader>

          <CollapsibleContent>
            <Separator />
            <CardContent className="pt-3">
              <div className="flex flex-col gap-2">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-start gap-2 text-sm/relaxed"
                  >
                    <TodoStatusIcon status={todo.status} />
                    <span className={todoTextClassName(todo.status)}>
                      {todo.content}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

function buildTodoSummary(todos: SessionTodo[]): string {
  let completedCount = 0;
  let activeCount = 0;

  for (const todo of todos) {
    if (todo.status === "completed") {
      completedCount += 1;
      continue;
    }

    if (isActiveTodo(todo)) {
      activeCount += 1;
    }
  }

  if (activeCount === 0) {
    return `${completedCount}/${todos.length} completed`;
  }

  return `${completedCount}/${todos.length} completed · ${activeCount} active`;
}

function selectPreviewTodo(todos: SessionTodo[]): SessionTodo | null {
  const inProgressTodo = todos.find((todo) => todo.status === "in_progress");
  if (inProgressTodo != null) {
    return inProgressTodo;
  }

  const pendingTodo = todos.find((todo) => todo.status === "pending");
  if (pendingTodo != null) {
    return pendingTodo;
  }

  for (let index = todos.length - 1; index >= 0; index -= 1) {
    const todo = todos[index];
    if (todo.status === "completed" || todo.status === "cancelled") {
      return todo;
    }
  }

  return todos.at(-1) ?? null;
}

function previewLabel(status: SessionTodo["status"]): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "pending":
      return "Next up";
    case "completed":
      return "Last completed";
    case "cancelled":
      return "Last removed";
    default:
      return "Task plan";
  }
}

function TodoStatusIcon({ status }: { status: SessionTodo["status"] }) {
  switch (status) {
    case "in_progress":
      return (
        <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-foreground" />
      );
    case "completed":
      return (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      );
    case "cancelled":
      return (
        <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      );
    case "pending":
    default:
      return (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      );
  }
}

function todoTextClassName(status: SessionTodo["status"]) {
  return cn(
    "min-w-0 flex-1",
    status === "in_progress" && "font-medium text-foreground",
    status === "completed" && "text-muted-foreground line-through",
    status === "cancelled" && "text-muted-foreground line-through",
    status === "pending" && "text-muted-foreground",
  );
}

function isActiveTodo(todo: SessionTodo) {
  return todo.status === "pending" || todo.status === "in_progress";
}
