import { useEffect, useRef, useState } from "react";
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from "dockview-react";

import { ConversationPanel } from "@/components/ConversationPanel";
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

type ApplySavedWorkspaceLayoutResult =
  | { kind: "restored" }
  | { kind: "default"; bindings: ChatBinding[] }
  | { kind: "fallback"; bindings: ChatBinding[] };

type OuterDidDropEvent = Parameters<
  NonNullable<React.ComponentProps<typeof DockviewReact>["onDidDrop"]>
>[0];

function applySavedWorkspaceLayout(
  api: DockviewApi,
  layoutJson: string,
): ApplySavedWorkspaceLayoutResult {
  const savedLayout = parseDockviewLayoutJson(layoutJson);
  const savedBindings = extractBindingsFromLayoutJson(layoutJson);

  if (savedLayout == null) {
    return { kind: "default", bindings: savedBindings };
  }

  try {
    api.fromJSON(savedLayout, { reuseExistingPanels: false });
    return { kind: "restored" };
  } catch {
    return { kind: "fallback", bindings: savedBindings };
  }
}

function useWorkspaceBoardController() {
  const { isOpeningProject, runtimeStatus, uiError } = useConversationSession();
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

  async function persistWorkspaceLayout(layoutJson: string) {
    if (selection.kind !== "saved-workspace") {
      return;
    }

    const detail = await desktopClient.updateSavedWorkspaceLayout({
      workspaceId: selection.workspace.id,
      layoutJson,
    });
    setSelection({ kind: "saved-workspace", workspace: detail });
  }

  const { isApplyingLayoutRef, markPersistedLayout, schedulePersist } =
    useDockviewLayoutPersistence({
      onPersist: persistWorkspaceLayout,
    });

  useEffect(() => {
    return () => {
      disposablesRef.current.forEach((disposable) => disposable.dispose());
      disposablesRef.current = [];
    };
  }, []);

  function applyOuterLayoutConstraints(api: DockviewApi) {
    api.groups.forEach((group) => {
      group.locked = false;
      group.header.hidden = true;
      group.element.classList.add("workspace-board-outer-group");
    });
  }

  function addOuterChatPanel(
    api: DockviewApi,
    binding: ChatBinding,
    options?: { referencePanel?: string; position?: "left" | "right" },
  ) {
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
  }

  function buildDefaultOuterLayout(api: DockviewApi, bindings: ChatBinding[]) {
    api.clear();
    bindings.forEach((binding, index) => {
      addOuterChatPanel(
        api,
        binding,
        index === 0
          ? undefined
          : {
              referencePanel: createChatPanelId(bindings[index - 1]),
              position: "right",
            },
      );
    });
    applyOuterLayoutConstraints(api);
  }

  function persistSavedWorkspaceLayout() {
    if (selection.kind !== "saved-workspace") {
      return;
    }

    schedulePersist(() => outerApiRef.current);
  }

  function finishSelectionRestore(layoutJson: string | null) {
    markPersistedLayout(layoutJson);
    isApplyingLayoutRef.current = false;
  }

  function getReferenceBinding(
    api: DockviewApi,
    binding: ChatBinding,
    referenceBinding?: ChatBinding,
  ) {
    if (referenceBinding != null) {
      return referenceBinding;
    }

    if (selection.kind === "single-chat") {
      return selection.chat;
    }

    return (
      getActiveOuterBinding(api) ??
      extractBindingsFromSerializedLayout(api.toJSON())[0] ??
      binding
    );
  }

  async function focusChat(binding: ChatBinding) {
    try {
      const snapshot = await desktopClient.selectConversation(
        binding.workspacePath,
        binding.conversationId,
      );
      applySessionSnapshot(snapshot);
    } catch {
      return;
    }
  }

  function canCloseChatPanel(binding: ChatBinding) {
    const api = outerApiRef.current;
    if (selection.kind !== "saved-workspace" || api == null) {
      return false;
    }

    if (api.totalPanels <= 1) {
      return false;
    }

    return api.getPanel(createChatPanelId(binding)) != null;
  }

  function closeChatPanel(binding: ChatBinding) {
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
  }

  async function restoreSelection(api: DockviewApi) {
    isApplyingLayoutRef.current = true;
    if (fallbackBindingsRef.current != null) {
      const bindings = fallbackBindingsRef.current;
      fallbackBindingsRef.current = null;
      finishSelectionRestore(null);
      buildDefaultOuterLayout(api, bindings);
      return;
    }

    if (selection.kind === "single-chat") {
      finishSelectionRestore(null);
      buildDefaultOuterLayout(api, [selection.chat]);
      return;
    }

    if (selection.kind !== "saved-workspace") {
      finishSelectionRestore(null);
      api.clear();
      return;
    }

    const restoreResult = applySavedWorkspaceLayout(
      api,
      selection.workspace.layoutJson,
    );
    if (restoreResult.kind === "fallback") {
      fallbackBindingsRef.current = restoreResult.bindings;
      isApplyingLayoutRef.current = false;
      setLayoutResetNonce((current) => current + 1);
      return;
    }

    if (restoreResult.kind === "restored") {
      finishSelectionRestore(selection.workspace.layoutJson);
      applyOuterLayoutConstraints(api);
      return;
    }

    finishSelectionRestore(null);
    buildDefaultOuterLayout(api, restoreResult.bindings);
  }

  async function addChatToBoard(
    binding: ChatBinding,
    options?: { position?: "left" | "right"; referenceBinding?: ChatBinding },
  ) {
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

    const referencePanelId = createChatPanelId(
      getReferenceBinding(api, binding, options?.referenceBinding),
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
  }

  function handleOuterReady(event: DockviewReadyEvent) {
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
  }

  const components = {
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
  };

  function handleOuterDidDrop(event: OuterDidDropEvent) {
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
    const position = event.position === "left" ? "left" : "right";

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
  }

  return {
    components,
    handleOuterDidDrop,
    handleOuterReady,
    isOpeningProject,
    layoutResetNonce,
    runtimeStatus,
    selection,
    theme,
    uiError,
  };
}

export function WorkspaceBoard() {
  const {
    components,
    handleOuterDidDrop,
    handleOuterReady,
    isOpeningProject,
    layoutResetNonce,
    runtimeStatus,
    selection,
    theme,
    uiError,
  } = useWorkspaceBoardController();

  if (selection.kind === "empty") {
    return (
      <LandingScreen
        isOpeningProject={isOpeningProject}
        runtimeStatus={runtimeStatus}
        uiError={uiError}
      />
    );
  }

  if (selection.kind === "workspace-draft") {
    return <ConversationPanel />;
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
            (internalDropData.groupId === dropEvent.group?.id ||
              internalDropData.panelId === dropEvent.panel?.id)
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
