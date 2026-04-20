import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronRight,
  GitFork,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import {
  DockviewReact,
  positionToDirection,
  type DockviewApi,
  type DockviewReadyEvent,
  type DockviewGroupPanel,
  type IDockviewHeaderActionsProps,
  type IDockviewPanelHeaderProps,
  type IDockviewPanel,
  type IDockviewPanelProps,
} from "dockview-react";

import { ConversationPanel } from "@/components/ConversationPanel";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { ScopedConversationProviders } from "./ScopedConversationProviders";
import { PlaceholderPane } from "./PlaceholderPane";
import { TerminalPane } from "./TerminalPane";
import {
  CHAT_PANE_ID,
  createTerminalSessionId,
  dispatchTerminalRestartRequest,
  INNER_CHAT_COMPONENT,
  INNER_PLACEHOLDER_COMPONENT,
  parseDockviewLayoutJson,
  type PlaceholderPaneParams,
  type TerminalPaneParams,
} from "./layout";
import {
  applyChatTileLayoutConstraints,
  buildDefaultChatTileLayout,
  isSingleChatSelfDrop,
  openChatTilePane,
  shouldPreventChatOverlay,
} from "./chatTileLayout";
import type { ChatBinding } from "@/services/desktop/contracts";
import * as desktopClient from "@/services/desktop/client";
import { BranchSwitcherMenu } from "../conversation-panel/BranchSwitcherMenu";
import { CommitChangesDialog } from "../conversation-panel/CommitChangesDialog";
import { ConversationHeaderActions } from "../conversation-panel/ConversationHeaderActions";
import { useConversationHeaderState } from "../conversation-panel/useConversationHeaderState";
import { useDockviewLayoutPersistence } from "./useDockviewLayoutPersistence";
import { useDockviewTheme } from "./useDockviewTheme";
import "./chat-tile-dockview.css";

function ChatPaneTab() {
  const {
    activeWorkspaceLabel,
    branchName,
    branchQuery,
    branchSearchInputRef,
    canCreateBranch,
    filteredBranches,
    handleBranchCreate,
    handleBranchMenuOpenChange,
    handleBranchSelect,
    isBranchMenuOpen,
    isGitActionPending,
    repoName,
    setBranchQuery,
  } = useConversationHeaderState();

  return (
    <div className="chat-pane-dockview-tab flex h-6 min-w-0 items-center overflow-hidden pl-3 text-xs font-medium tracking-tight text-neutral-800 select-none dark:text-neutral-100">
      {repoName ? (
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="min-w-0 flex-nowrap">
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                <GitFork
                  strokeWidth={2}
                  className="size-3 shrink-0 text-neutral-500 dark:text-neutral-500"
                />
                <span className="truncate">{repoName}</span>
              </BreadcrumbPage>
            </BreadcrumbItem>

            {branchName ? (
              <>
                <BreadcrumbSeparator className="text-neutral-400 dark:text-neutral-500">
                  <ChevronRight strokeWidth={2} className="size-2.5" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BranchSwitcherMenu
                    branchName={branchName}
                    branchQuery={branchQuery}
                    branches={filteredBranches}
                    canCreateBranch={canCreateBranch}
                    isBusy={isGitActionPending}
                    isOpen={isBranchMenuOpen}
                    searchInputRef={branchSearchInputRef}
                    onBranchQueryChange={setBranchQuery}
                    onCreateBranch={handleBranchCreate}
                    onOpenChange={handleBranchMenuOpenChange}
                    onSelectBranch={handleBranchSelect}
                  />
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
      ) : (
        <span className="truncate text-xs font-medium tracking-tight text-neutral-500 dark:text-neutral-400">
          {activeWorkspaceLabel}
        </span>
      )}
    </div>
  );
}

function AuxiliaryPaneTab({
  params,
}: IDockviewPanelHeaderProps<PlaceholderPaneParams>) {
  return (
    <div className="terminal-pane-tab inline-flex h-6 min-w-0 items-center gap-1.5 px-1.5 text-xs font-medium tracking-tight text-neutral-800 dark:text-neutral-100">
      <span className="truncate">{params.label}</span>
    </div>
  );
}

const headerActionsClassName =
  "relative z-20 ml-auto flex h-6 shrink-0 items-center gap-1.5 pointer-events-auto";

function AuxiliaryHeaderActions({
  activePanel,
}: IDockviewHeaderActionsProps) {
  const panelParams = activePanel?.params as Partial<PlaceholderPaneParams> | undefined;
  const kind = panelParams?.kind;

  if (activePanel == null || (kind !== "preview" && kind !== "terminal")) {
    return null;
  }

  const handleClose = () => {
    activePanel.api.close();
  };

  if (kind === "preview") {
    return (
      <div className={headerActionsClassName}>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Close preview"
          onClick={handleClose}
        >
          <XIcon />
        </Button>
      </div>
    );
  }

  const resolvedParams = panelParams ?? {};
  const workspacePath = typeof resolvedParams.workspacePath === "string"
    ? resolvedParams.workspacePath
    : "";
  const conversationId = typeof resolvedParams.conversationId === "string"
    ? resolvedParams.conversationId
    : "";
  const terminalId = createTerminalSessionId({
    workspacePath,
    conversationId,
  });

  return (
    <div className={headerActionsClassName}>
      <ButtonGroup aria-label="Terminal actions">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Restart terminal"
          onClick={() => {
            dispatchTerminalRestartRequest(terminalId);
          }}
        >
          <RotateCcwIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Close terminal"
          onClick={handleClose}
        >
          <XIcon />
        </Button>
      </ButtonGroup>
    </div>
  );
}

interface ChatHeaderActionsProps {
  canCloseChat: () => boolean;
  onCloseChat: () => void;
  onOpenPreview: () => void;
  onOpenTerminal: () => void;
}

function ChatHeaderActions({
  canCloseChat,
  onCloseChat,
  onOpenPreview,
  onOpenTerminal,
}: ChatHeaderActionsProps) {
  const {
    commitMessage,
    handleCommitDialogClose,
    handleCommitDialogOpenChange,
    handleCommitSubmit,
    handleOpenTarget,
    handlePush,
    isCommitDialogOpen,
    isCommitPending,
    isGitActionPending,
    isOpenTargetPending,
    openCommitDialog,
    openTargets,
    resolvedPreferredAppId,
    setCommitMessage,
  } = useConversationHeaderState();

  return (
    <>
      <ConversationHeaderActions
        canCloseChat={canCloseChat}
        isGitBusy={isGitActionPending}
        isOpenTargetBusy={isOpenTargetPending}
        onCloseChat={onCloseChat}
        onOpenCommitDialog={openCommitDialog}
        onOpenPreview={onOpenPreview}
        onOpenTerminal={onOpenTerminal}
        onPush={handlePush}
        onSelectOpenTarget={handleOpenTarget}
        openTargets={openTargets}
        preferredAppId={resolvedPreferredAppId}
      />

      <CommitChangesDialog
        commitMessage={commitMessage}
        isOpen={isCommitDialogOpen}
        isSubmitting={isCommitPending}
        onClose={handleCommitDialogClose}
        onCommitMessageChange={setCommitMessage}
        onOpenChange={handleCommitDialogOpenChange}
        onSubmit={handleCommitSubmit}
      />
    </>
  );
}

interface ChatTileProps {
  binding: ChatBinding;
  canCloseChat: () => boolean;
  onCloseChat: () => void;
  onActivate?: () => void;
}

export function ChatTile({
  binding,
  canCloseChat,
  onCloseChat,
  onActivate,
}: ChatTileProps) {
  const [layoutResetNonce, setLayoutResetNonce] = useState(0);
  const innerApiRef = useRef<DockviewApi | null>(null);
  const innerDisposablesRef = useRef<Array<{ dispose(): void }>>([]);
  const fallbackToDefaultLayoutRef = useRef(false);
  const draggedPanelRef = useRef<IDockviewPanel | null>(null);
  const draggedGroupRef = useRef<DockviewGroupPanel | null>(null);
  const theme = useDockviewTheme();
  const persistConversationLayout = useCallback(
    async (layoutJson: string) => {
      await desktopClient.saveConversationLayout({
        conversationId: binding.conversationId,
        layoutJson,
      });
    },
    [binding.conversationId],
  );
  const {
    isApplyingLayoutRef,
    markPersistedLayout,
    schedulePersist,
  } = useDockviewLayoutPersistence({
    onPersist: persistConversationLayout,
  });

  useEffect(() => {
    return () => {
      innerDisposablesRef.current.forEach((disposable) => disposable.dispose());
      innerDisposablesRef.current = [];
      draggedPanelRef.current = null;
      draggedGroupRef.current = null;
    };
  }, []);

  const scheduleInnerLayoutSave = useCallback(() => {
    schedulePersist(() => innerApiRef.current);
  }, [schedulePersist]);

  const handleOpenPane = useCallback(
    (kind: "preview" | "terminal") => {
      const api = innerApiRef.current;
      if (api == null) {
        return;
      }

      openChatTilePane(api, binding, kind);
      scheduleInnerLayoutSave();
    },
    [binding, scheduleInnerLayoutSave],
  );

  const components = useMemo(
    () => ({
      [INNER_CHAT_COMPONENT]: function ConversationPane() {
        return (
          <ScopedConversationProviders binding={binding}>
            <ConversationPanel
              canCloseChat={canCloseChat}
              embedded
              onCloseChat={onCloseChat}
              onOpenPreview={() => {
                handleOpenPane("preview");
              }}
              onOpenTerminal={() => {
                handleOpenPane("terminal");
              }}
              showHeader={false}
              windowDragEnabled={false}
            />
          </ScopedConversationProviders>
        );
      },
      [INNER_PLACEHOLDER_COMPONENT]: function AuxiliaryPane(
        props: IDockviewPanelProps<{
          workspacePath: string;
          conversationId: string;
          kind: "preview" | "terminal";
          label: string;
        }>,
      ) {
        if (props.params.kind === "terminal") {
          return <TerminalPane {...(props as IDockviewPanelProps<TerminalPaneParams>)} />;
        }

        return <PlaceholderPane {...props} />;
      },
    }),
    [binding, canCloseChat, handleOpenPane, onCloseChat],
  );

  const tabComponents = useMemo(
    () => ({
      [INNER_CHAT_COMPONENT]: ChatPaneTab,
      [INNER_PLACEHOLDER_COMPONENT]: AuxiliaryPaneTab,
    }),
    [],
  );

  const buildDefaultInnerLayout = useCallback(
    (api: DockviewApi) => {
      buildDefaultChatTileLayout(api, binding);
    },
    [binding],
  );

  const restoreInnerLayout = useCallback(
    async (api: DockviewApi) => {
      isApplyingLayoutRef.current = true;
      try {
        if (fallbackToDefaultLayoutRef.current) {
          fallbackToDefaultLayoutRef.current = false;
          markPersistedLayout(null);
          buildDefaultInnerLayout(api);
          return;
        }

        const savedLayoutJson = await desktopClient.getConversationLayout(
          binding.conversationId,
        );
        const savedLayout = parseDockviewLayoutJson(savedLayoutJson);
        if (savedLayout != null) {
          try {
            api.fromJSON(savedLayout, { reuseExistingPanels: false });
            markPersistedLayout(savedLayoutJson);
            applyChatTileLayoutConstraints(api);
            return;
          } catch {
            fallbackToDefaultLayoutRef.current = true;
            setLayoutResetNonce((current) => current + 1);
            return;
          }
        }

        markPersistedLayout(null);
        buildDefaultInnerLayout(api);
      } finally {
        isApplyingLayoutRef.current = false;
      }
    },
    [
      binding.conversationId,
      buildDefaultInnerLayout,
      isApplyingLayoutRef,
      markPersistedLayout,
    ],
  );

  const handleInnerReady = useCallback(
    (event: DockviewReadyEvent) => {
      innerDisposablesRef.current.forEach((disposable) => disposable.dispose());
      innerDisposablesRef.current = [];
      innerApiRef.current = event.api;

      innerDisposablesRef.current = [
        event.api.onDidLayoutChange(() => {
          draggedPanelRef.current = null;
          draggedGroupRef.current = null;
          applyChatTileLayoutConstraints(event.api);
          scheduleInnerLayoutSave();
        }),
        event.api.onWillDragPanel((dragEvent) => {
          draggedPanelRef.current = dragEvent.panel;
          draggedGroupRef.current = null;
        }),
        event.api.onWillDragGroup((dragEvent) => {
          draggedGroupRef.current = dragEvent.group;
          draggedPanelRef.current = null;
        }),
        event.api.onWillShowOverlay((overlayEvent) => {
          if (
            shouldPreventChatOverlay(
              draggedPanelRef.current,
              draggedGroupRef.current,
              overlayEvent.group,
              overlayEvent.position,
            )
          ) {
            overlayEvent.preventDefault();
          }
        }),
        event.api.onWillDrop((dropEvent) => {
          const draggedPanel = draggedPanelRef.current;
          const draggedGroup = draggedGroupRef.current;
          if (isSingleChatSelfDrop(draggedPanel, draggedGroup, dropEvent.group)) {
            dropEvent.preventDefault();
            draggedPanelRef.current = null;
            draggedGroupRef.current = null;
            return;
          }

          if (
            shouldPreventChatOverlay(
              draggedPanel,
              draggedGroup,
              dropEvent.group,
              dropEvent.position,
            )
          ) {
            dropEvent.preventDefault();
            return;
          }

          if (draggedPanel != null) {
            dropEvent.preventDefault();

            if (dropEvent.group != null) {
              draggedPanel.api.moveTo({
                group: dropEvent.group,
                position: dropEvent.position,
              });
            } else {
              const newGroup = event.api.addGroup({
                direction: positionToDirection(dropEvent.position),
              });
              draggedPanel.api.moveTo({
                group: newGroup,
              });
            }

            draggedPanelRef.current = null;
            draggedGroupRef.current = null;
            return;
          }

          const sourceGroup = draggedGroup;
          if (sourceGroup == null) {
            return;
          }

          dropEvent.preventDefault();

          if (dropEvent.group != null) {
            sourceGroup.api.moveTo({
              group: dropEvent.group,
              position: dropEvent.position,
            });
          } else {
            sourceGroup.api.moveTo({
              position: dropEvent.position,
            });
          }

          draggedPanelRef.current = null;
          draggedGroupRef.current = null;
        }),
      ];

      void restoreInnerLayout(event.api);
    },
    [restoreInnerLayout, scheduleInnerLayoutSave],
  );

  return (
    <section
      className="chat-tile-shell relative flex h-full min-h-0 min-w-0"
      onFocusCapture={() => {
        onActivate?.();
      }}
      onPointerDownCapture={() => {
        onActivate?.();
      }}
    >
      <DockviewReact
        key={`${binding.conversationId}:${layoutResetNonce}`}
        className="chat-tile-inner-dock h-full w-full"
        components={components}
        defaultTabComponent={AuxiliaryPaneTab}
        disableFloatingGroups
        hideBorders
        onReady={handleInnerReady}
        rightHeaderActionsComponent={(props) => {
          if (props.activePanel?.id === CHAT_PANE_ID) {
            return (
              <ChatHeaderActions
                canCloseChat={canCloseChat}
                onCloseChat={onCloseChat}
                onOpenPreview={() => {
                  handleOpenPane("preview");
                }}
                onOpenTerminal={() => {
                  handleOpenPane("terminal");
                }}
              />
            );
          }

          return <AuxiliaryHeaderActions {...props} />;
        }}
        singleTabMode="fullwidth"
        tabComponents={tabComponents}
        theme={theme}
      />
    </section>
  );
}
