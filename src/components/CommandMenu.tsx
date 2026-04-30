import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderOpenIcon,
  MessageSquarePlusIcon,
  PanelLeftIcon,
  PanelsTopLeftIcon,
  SearchIcon,
  Settings2Icon,
  WorkflowIcon,
} from "lucide-react";

import { sessionStore } from "@/app/sessionStore";
import type { SettingsSection } from "@/app/types/app";
import type { WorkspaceBoardSelection } from "@/app/types/sessionContext";
import { useSessionActions, useSessionStore } from "@/hooks/useSession";
import { cn } from "@/utils/cn";
import { Dialog, DialogContent, DialogTitle } from "./ui/Dialog";
import { Input } from "./ui/Input";

interface CommandMenuProps {
  isSidebarVisible: boolean;
  isSettingsViewOpen: boolean;
  onOpenSettings: () => void;
  onSelectSettingsSection: (section: SettingsSection) => void;
  onShowSidebar: () => void;
}

type CommandItem = {
  id: string;
  title: string;
  subtitle: string;
  keywords: string;
  icon: typeof SearchIcon;
  disabled?: boolean;
  run: () => void | Promise<void>;
};

function getConversationSelection(workspacePath: string, conversationId: string) {
  return {
    kind: "single-chat",
    chat: { workspacePath, conversationId },
  } satisfies WorkspaceBoardSelection;
}

function getWorkspaceDraftSelection(workspacePath: string) {
  return {
    kind: "workspace-draft",
    workspacePath,
  } satisfies WorkspaceBoardSelection;
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

function scoreCommand(command: CommandItem, query: string) {
  if (query.length === 0) {
    return 1;
  }

  const title = command.title.toLocaleLowerCase();
  const haystack = `${title} ${command.subtitle.toLocaleLowerCase()} ${command.keywords.toLocaleLowerCase()}`;
  if (title.startsWith(query)) {
    return 4;
  }

  if (title.includes(query)) {
    return 3;
  }

  return haystack.includes(query) ? 2 : 0;
}

export function CommandMenu({
  isSidebarVisible,
  isSettingsViewOpen,
  onOpenSettings,
  onSelectSettingsSection,
  onShowSidebar,
}: CommandMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const {
    openSavedWorkspace,
    openWorkspacePicker,
    selectConversation,
    startNewChat,
  } = useSessionActions();
  const { savedWorkspaces, workspaces } = useSessionStore((state) => ({
    savedWorkspaces: state.savedWorkspaces,
    workspaces: state.workspaces,
  }));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase() === "k"
      ) {
        event.preventDefault();
        setIsOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: "new-chat",
        title: "New chat",
        subtitle: "Start a fresh agent conversation",
        keywords: "create conversation prompt agent",
        icon: MessageSquarePlusIcon,
        run: async () => {
          await startNewChat();
        },
      },
      {
        id: "open-project",
        title: "Open project",
        subtitle: "Choose a workspace folder",
        keywords: "workspace folder repository directory",
        icon: FolderOpenIcon,
        run: async () => {
          await openWorkspacePicker();
        },
      },
      {
        id: "settings-general",
        title: "Open settings",
        subtitle: "View general app settings",
        keywords: "preferences general configuration",
        icon: Settings2Icon,
        run: () => {
          onSelectSettingsSection("general");
          onOpenSettings();
        },
      },
      {
        id: "settings-providers",
        title: "Open provider settings",
        subtitle: "Configure models and authentication",
        keywords: "providers models auth login configuration",
        icon: Settings2Icon,
        run: () => {
          onSelectSettingsSection("providers");
          onOpenSettings();
        },
      },
    ];

    if (!isSidebarVisible && !isSettingsViewOpen) {
      items.push({
        id: "show-sidebar",
        title: "Show sidebar",
        subtitle: "Reveal chats, projects, and workspaces",
        keywords: "navigation panel drawer",
        icon: PanelLeftIcon,
        run: onShowSidebar,
      });
    }

    for (const workspace of workspaces) {
      if (workspace.kind === "project") {
        items.push({
          id: `project:${workspace.workspacePath}`,
          title: `Open project: ${workspace.workspaceName}`,
          subtitle: workspace.workspacePath,
          keywords: "project workspace repository folder",
          icon: FolderOpenIcon,
          run: () => {
            sessionStore
              .getState()
              .setBoardSelection(
                getWorkspaceDraftSelection(workspace.workspacePath),
              );
          },
        });
      }

      for (const conversation of workspace.conversations) {
        items.push({
          id: `chat:${workspace.workspacePath}:${conversation.conversationId}`,
          title: conversation.title || "Untitled chat",
          subtitle: workspace.workspaceName,
          keywords: `chat conversation ${workspace.workspacePath}`,
          icon: MessageSquarePlusIcon,
          run: async () => {
            sessionStore
              .getState()
              .setBoardSelection(
                getConversationSelection(
                  workspace.workspacePath,
                  conversation.conversationId,
                ),
              );
            await selectConversation(
              workspace.workspacePath,
              conversation.conversationId,
            );
          },
        });
      }
    }

    for (const workspace of savedWorkspaces) {
      items.push({
        id: `saved-workspace:${workspace.id}`,
        title: `Open workspace: ${workspace.name}`,
        subtitle: "Saved panel layout",
        keywords: "saved workspace layout panels",
        icon: PanelsTopLeftIcon,
        run: async () => {
          await openSavedWorkspace(workspace.id);
        },
      });
    }

    if (import.meta.env.DEV) {
      items.push({
        id: "demo-chat",
        title: "Open demo chat",
        subtitle: "Preview chat states in development",
        keywords: "development fixture sample",
        icon: WorkflowIcon,
        run: () => {
          sessionStore.getState().setBoardSelection({ kind: "demo-chat" });
        },
      });
    }

    return items;
  }, [
    isSettingsViewOpen,
    isSidebarVisible,
    onOpenSettings,
    onSelectSettingsSection,
    onShowSidebar,
    openSavedWorkspace,
    openWorkspacePicker,
    savedWorkspaces,
    selectConversation,
    startNewChat,
    workspaces,
  ]);

  const visibleCommands = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return commands
      .map((command) => ({
        command,
        score: scoreCommand(command, normalizedQuery),
      }))
      .filter(({ score }) => score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.command.title.localeCompare(right.command.title),
      )
      .map(({ command }) => command)
      .slice(0, 12);
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex >= visibleCommands.length) {
      setActiveIndex(Math.max(visibleCommands.length - 1, 0));
    }
  }, [activeIndex, visibleCommands.length]);

  const runCommand = useCallback(
    (command: CommandItem | null | undefined) => {
      if (command == null || command.disabled) {
        return;
      }

      closeMenu();
      void command.run();
    },
    [closeMenu],
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="top-[18vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 shadow-2xl"
      >
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            placeholder="Search commands, chats, projects…"
            className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) =>
                  Math.min(
                    current + 1,
                    Math.max(visibleCommands.length - 1, 0),
                  ),
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                runCommand(visibleCommands[activeIndex]);
              }
            }}
          />
          <kbd className="rounded border border-border/70 bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-2">
          {visibleCommands.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No commands found
            </div>
          ) : (
            <div role="listbox" aria-label="Commands" className="grid gap-1">
              {visibleCommands.map((command, index) => {
                const Icon = command.icon;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={command.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/70",
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runCommand(command)}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground/5 text-muted-foreground">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {command.title}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {command.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
