import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from "dockview-react";

import { LandingScreen } from "@/components/LandingScreen";
import { useConversationSession, useWorkspaceBoard } from "@/hooks/useSession";
import * as desktopClient from "@/services/desktop/client";
import type { ChatBinding } from "@/services/desktop/contracts";

import { ChatTile } from "./ChatTile";
import {
  OUTER_CHAT_COMPONENT,
  clearActiveDraggedChatBinding,
  createChatPanelId,
  extractBindingsFromLayoutJson,
  extractBindingsFromSerializedLayout,
  hasChatBindingDataTransfer,
  parseDockviewLayoutJson,
  readChatBindingFromDataTransfer,
  serializeDockviewLayout,
  type OuterChatPanelParams,
} from "./layout";
import {
  getActiveOuterBinding,
  getChatTitle,
  getOuterPanelBinding,
  getWorkspaceBoardSelectionKey,
} from "./workspaceBoardUtils";
import { useDockviewLayoutPersistence } from "./useDockviewLayoutPersistence";
import { useDockviewTheme } from "./useDockviewTheme";

export function WorkspaceBoard() {
  const {
    isOpeningProject,
    runtimeStatus,
    uiError,
  } = useConversationSession();
  const {
    applySessionSnapshot,
    getConversationSummary,
    getWorkspace,
    selection,
    setSelection,
  } = useWorkspaceBoard();
  const [layoutResetNonce, setLayoutResetNonce] = useState(0);
  const outerApiRef = useRef<DockviewApi | null>(null);
  const disposablesRef = useRef<Array<{ dispose(): void }>>([]);
  const fallbackBindingsRef = useRef<ChatBinding[] | null>(null);
  const theme = useDockviewTheme();
  const persistWorkspaceLayout = useCallback(
    async (layoutJson: string) => {
      if (selection.kind !== "saved-workspace") {
        return;
      }

      const detail = await desktopClient.updateSavedWorkspaceLayout({
        workspaceId: selection.workspace.id,
        layoutJson,
      });
      setSelection({ kind: "saved-workspace", workspace: detail });
    },
    [selection, setSelection],
  );
  const {
    isApplyingLayoutRef,
    markPersistedLayout,
    schedulePersist,
  } = useDockviewLayoutPersistence({
    onPersist: persistWorkspaceLayout,
  });

  useEffect(() => {
    return () => {
      disposablesRef.current.forEach((disposable) => disposable.dispose());
      disposablesRef.current = [];
    };
  }, []);

  const applyOuterLayoutConstraints = useCallback(
    (api: DockviewApi) => {
      api.groups.forEach((group) => {
        group.locked = false;
        group.header.hidden = true;
        group.element.classList.add("workspace-board-outer-group");
      });
    },
    [],
  );

  const addOuterChatPanel = useCallback(
    (
      api: DockviewApi,
      binding: ChatBinding,
      options?: { referencePanel?: string; position?: "left" | "right" },
    ) => {
      const panelId = createChatPanelId(binding);
      const existingPanel = api.getPanel(panelId);
      if (existingPanel != null) {
        existingPanel.focus();
        return existingPanel;
      }

      const title = getChatTitle(binding, getWorkspace, getConversationSummary);
      const panel = api.addPanel<OuterChatPanelParams>({
        id: panelId,
        component: OUTER_CHAT_COMPONENT,
        title,
        params: {
          ...binding,
          title,
        },
        position:
          options?.referencePanel != null
            ? {
                direction: options.position ?? "right",
                referencePanel: options.referencePanel,
              }
            : undefined,
      });
      applyOuterLayoutConstraints(api);
      return panel;
    },
    [applyOuterLayoutConstraints, getConversationSummary, getWorkspace],
  );

  const buildDefaultOuterLayout = useCallback(
    (api: DockviewApi, bindings: ChatBinding[]) => {
      api.clear();
      bindings.forEach((binding, index) => {
        addOuterChatPanel(api, binding, index === 0
          ? undefined
          : {
              referencePanel: createChatPanelId(bindings[index - 1]),
              position: "right",
            });
      });
      applyOuterLayoutConstraints(api);
    },
    [addOuterChatPanel, applyOuterLayoutConstraints],
  );

  const persistSavedWorkspaceLayout = useCallback(() => {
    if (selection.kind !== "saved-workspace") {
      return;
    }

    schedulePersist(() => outerApiRef.current);
  }, [schedulePersist, selection.kind]);

  const focusChat = useCallback(
    async (binding: ChatBinding) => {
      try {
        const snapshot = await desktopClient.selectConversation(
          binding.workspacePath,
          binding.conversationId,
        );
        applySessionSnapshot(snapshot);
      } catch {
        return;
      }
    },
    [applySessionSnapshot],
  );

  const canCloseChatPanel = useCallback(
    (binding: ChatBinding) => {
      const api = outerApiRef.current;
      if (selection.kind !== "saved-workspace" || api == null) {
        return false;
      }

      if (api.totalPanels <= 1) {
        return false;
      }

      return api.getPanel(createChatPanelId(binding)) != null;
    },
    [selection.kind],
  );

  const closeChatPanel = useCallback(
    (binding: ChatBinding) => {
      const api = outerApiRef.current;
      if (selection.kind !== "saved-workspace" || api == null) {
        return;
      }

      if (api.totalPanels <= 1) {
        return;
      }

      const panel = api.getPanel(createChatPanelId(binding));
      if (panel == null) {
        return;
      }

      api.removePanel(panel);
    },
    [selection.kind],
  );

  const restoreSelection = useCallback(
    async (api: DockviewApi) => {
      isApplyingLayoutRef.current = true;
      try {
        if (fallbackBindingsRef.current != null) {
          const bindings = fallbackBindingsRef.current;
          fallbackBindingsRef.current = null;
          markPersistedLayout(null);
          buildDefaultOuterLayout(api, bindings);
          return;
        }

        if (selection.kind === "single-chat") {
          markPersistedLayout(null);
          buildDefaultOuterLayout(api, [selection.chat]);
          return;
        }

        if (selection.kind !== "saved-workspace") {
          markPersistedLayout(null);
          api.clear();
          return;
        }

        const savedLayout = parseDockviewLayoutJson(selection.workspace.layoutJson);
        const savedBindings = extractBindingsFromLayoutJson(
          selection.workspace.layoutJson,
        );

        if (savedLayout != null) {
          try {
            api.fromJSON(savedLayout, { reuseExistingPanels: false });
            markPersistedLayout(selection.workspace.layoutJson);
            applyOuterLayoutConstraints(api);
            return;
          } catch {
            fallbackBindingsRef.current = savedBindings;
            setLayoutResetNonce((current) => current + 1);
            return;
          }
        }

        markPersistedLayout(null);
        buildDefaultOuterLayout(api, savedBindings);
      } finally {
        isApplyingLayoutRef.current = false;
      }
    },
    [
      applyOuterLayoutConstraints,
      buildDefaultOuterLayout,
      isApplyingLayoutRef,
      markPersistedLayout,
      selection,
    ],
  );

  const addChatToBoard = useCallback(
    async (
      binding: ChatBinding,
      options?: { position?: "left" | "right"; referenceBinding?: ChatBinding },
    ) => {
      try {
        const ensuredSnapshot = await desktopClient.ensureConversationView(
          binding.workspacePath,
          binding.conversationId,
        );
        applySessionSnapshot(ensuredSnapshot);
      } catch {
        return;
      }

      if (selection.kind === "empty") {
        setSelection({ kind: "single-chat", chat: binding });
        void focusChat(binding);
        return;
      }

      const api = outerApiRef.current;
      if (api == null) {
        return;
      }

      const existingPanel = api.getPanel(createChatPanelId(binding));
      if (existingPanel != null) {
        existingPanel.focus();
        void focusChat(binding);
        return;
      }

      const referencePanelId =
        options?.referenceBinding != null
          ? createChatPanelId(options.referenceBinding)
          : createChatPanelId(
              selection.kind === "single-chat"
                ? selection.chat
                : getActiveOuterBinding(api) ??
                    extractBindingsFromSerializedLayout(api.toJSON())[0] ??
                    binding,
            );

      addOuterChatPanel(api, binding, {
        position: options?.position ?? "right",
        referencePanel: referencePanelId,
      });

      if (selection.kind === "single-chat") {
        const layout = api.toJSON();
        const layoutJson = serializeDockviewLayout(layout);
        const detail = await desktopClient.createSavedWorkspace({
          chats: extractBindingsFromSerializedLayout(layout),
          layoutJson,
        });
        markPersistedLayout(layoutJson);
        setSelection({ kind: "saved-workspace", workspace: detail });
      } else {
        persistSavedWorkspaceLayout();
      }

      void focusChat(binding);
    },
    [
      addOuterChatPanel,
      applySessionSnapshot,
      focusChat,
      markPersistedLayout,
      persistSavedWorkspaceLayout,
      selection,
      setSelection,
    ],
  );

  const handleOuterReady = useCallback(
    (event: DockviewReadyEvent) => {
      disposablesRef.current.forEach((disposable) => disposable.dispose());
      disposablesRef.current = [];
      outerApiRef.current = event.api;
      disposablesRef.current = [
        event.api.onDidActivePanelChange((panel) => {
          const binding = getOuterPanelBinding(panel);
          if (binding == null) {
            return;
          }

          void focusChat(binding);
        }),
        event.api.onDidLayoutChange(() => {
          applyOuterLayoutConstraints(event.api);
          persistSavedWorkspaceLayout();
        }),
        event.api.onUnhandledDragOverEvent((dragEvent) => {
          if (hasChatBindingDataTransfer(dragEvent.nativeEvent.dataTransfer)) {
            dragEvent.accept();
          }
        }),
      ];

      void restoreSelection(event.api);
    },
    [
      applyOuterLayoutConstraints,
      focusChat,
      persistSavedWorkspaceLayout,
      restoreSelection,
    ],
  );

  const components = useMemo(
    () => ({
      [OUTER_CHAT_COMPONENT]: function ChatTilePanel({
        params,
      }: IDockviewPanelProps<OuterChatPanelParams>) {
        const binding = {
          workspacePath: params.workspacePath,
          conversationId: params.conversationId,
        };

        return (
          <ChatTile
            binding={binding}
            canCloseChat={() => canCloseChatPanel(binding)}
            onCloseChat={() => {
              closeChatPanel(binding);
            }}
          />
        );
      },
    }),
    [canCloseChatPanel, closeChatPanel],
  );

  const handleOuterDidDrop = useCallback(
    (event: Parameters<NonNullable<React.ComponentProps<typeof DockviewReact>["onDidDrop"]>>[0]) => {
      const binding = readChatBindingFromDataTransfer(
        event.nativeEvent.dataTransfer,
      );
      if (binding == null) {
        clearActiveDraggedChatBinding();
        return;
      }

      const referenceBinding =
        event.group?.activePanel != null
          ? getOuterPanelBinding(event.group.activePanel)
          : getActiveOuterBinding(outerApiRef.current);
      const position =
        event.position === "left" ? "left" : "right";

      void addChatToBoard(
        binding,
        referenceBinding == null
          ? undefined
          : {
              referenceBinding,
              position,
            },
      );
      clearActiveDraggedChatBinding();
    },
    [addChatToBoard],
  );

  if (selection.kind === "empty") {
    return (
      <LandingScreen
        isOpeningProject={isOpeningProject}
        runtimeStatus={runtimeStatus}
        uiError={uiError}
      />
    );
  }

  return (
    <section className="workspace-board relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <DockviewReact
        key={`${getWorkspaceBoardSelectionKey(selection)}:${layoutResetNonce}`}
        className="workspace-board-dock h-full w-full"
        components={components}
        disableFloatingGroups
        dndEdges={{
          activationSize: { value: 24, type: "pixels" },
          size: { value: 24, type: "pixels" },
        }}
        onDidDrop={handleOuterDidDrop}
        onReady={handleOuterReady}
        onWillDrop={(dropEvent) => {
          const internalDropData = dropEvent.getData();

          if (
            dropEvent.position === "center" ||
            dropEvent.position === "top" ||
            dropEvent.position === "bottom"
          ) {
            dropEvent.preventDefault();
            return;
          }

          if (
            internalDropData != null &&
            (
              internalDropData.groupId === dropEvent.group?.id ||
              internalDropData.panelId === dropEvent.panel?.id
            )
          ) {
            dropEvent.preventDefault();
          }
        }}
        singleTabMode="fullwidth"
        theme={theme}
      />
    </section>
  );
}
