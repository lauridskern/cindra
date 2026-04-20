import { useEffect, useRef, useState } from "react";
import {
  DockviewReact,
  positionToDirection,
  type DockviewApi,
  type DockviewGroupPanel,
  type DockviewReadyEvent,
  type IDockviewPanel,
  type IDockviewPanelProps,
} from "dockview-react";

import { ConversationPanel } from "@/components/ConversationPanel";
import * as desktopClient from "@/services/desktop/client";
import type { ChatBinding } from "@/services/desktop/contracts";

import {
  applyChatTileLayoutConstraints,
  buildDefaultChatTileLayout,
  isSingleChatSelfDrop,
  openChatTilePane,
  shouldPreventChatOverlay,
} from "./chatTileLayout";
import { PlaceholderPane } from "./PlaceholderPane";
import { ScopedConversationProviders } from "./ScopedConversationProviders";
import { useDockviewLayoutPersistence } from "./useDockviewLayoutPersistence";
import { useDockviewTheme } from "./useDockviewTheme";
import {
  INNER_CHAT_COMPONENT,
  INNER_PLACEHOLDER_COMPONENT,
  parseDockviewLayoutJson,
} from "./layout";

function ChatPaneTab() {
  return <div className="chat-pane-dockview-tab" aria-hidden="true" />;
}

const CHAT_TILE_TAB_COMPONENTS = {
  [INNER_CHAT_COMPONENT]: ChatPaneTab,
};

function applySavedConversationLayout(
  api: DockviewApi,
  layoutJson: string | null,
) {
  if (layoutJson == null) {
    return { kind: "default" as const };
  }

  const savedLayout = parseDockviewLayoutJson(layoutJson);
  if (savedLayout == null) {
    return { kind: "default" as const };
  }

  try {
    api.fromJSON(savedLayout, { reuseExistingPanels: false });
    return { kind: "restored" as const };
  } catch {
    return { kind: "fallback" as const };
  }
}

interface ChatTileProps {
  binding: ChatBinding;
  canCloseChat: () => boolean;
  onCloseChat: () => void;
}

export function ChatTile({
  binding,
  canCloseChat,
  onCloseChat,
}: ChatTileProps) {
  const [layoutResetNonce, setLayoutResetNonce] = useState(0);
  const innerApiRef = useRef<DockviewApi | null>(null);
  const innerDisposablesRef = useRef<Array<{ dispose(): void }>>([]);
  const fallbackToDefaultLayoutRef = useRef(false);
  const draggedPanelRef = useRef<IDockviewPanel | null>(null);
  const draggedGroupRef = useRef<DockviewGroupPanel | null>(null);
  const theme = useDockviewTheme();

  async function persistConversationLayout(layoutJson: string) {
    await desktopClient.saveConversationLayout({
      conversationId: binding.conversationId,
      layoutJson,
    });
  }

  const { isApplyingLayoutRef, markPersistedLayout, schedulePersist } =
    useDockviewLayoutPersistence({
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

  function scheduleInnerLayoutSave() {
    schedulePersist(() => innerApiRef.current);
  }

  function handleOpenPane(kind: "preview" | "terminal") {
    const api = innerApiRef.current;
    if (api == null) {
      return;
    }

    openChatTilePane(api, binding, kind);
    scheduleInnerLayoutSave();
  }

  const components = {
    [INNER_CHAT_COMPONENT]: function ConversationPane(
      props: IDockviewPanelProps<ChatBinding>,
    ) {
      return (
        <ScopedConversationProviders binding={binding}>
          <ConversationPanel
            canCloseChat={canCloseChat}
            onCloseChat={onCloseChat}
            onOpenPreview={() => {
              handleOpenPane("preview");
            }}
            onOpenTerminal={() => {
              handleOpenPane("terminal");
            }}
            panelDragHandle={{
              containerApi: props.containerApi,
              group: props.api.group,
            }}
            panelDragEnabled
            windowDragEnabled={false}
          />
        </ScopedConversationProviders>
      );
    },
    [INNER_PLACEHOLDER_COMPONENT]: PlaceholderPane,
  };

  function buildDefaultInnerLayout(api: DockviewApi) {
    buildDefaultChatTileLayout(api, binding);
  }

  async function restoreInnerLayout(api: DockviewApi) {
    isApplyingLayoutRef.current = true;
    if (fallbackToDefaultLayoutRef.current) {
      fallbackToDefaultLayoutRef.current = false;
      markPersistedLayout(null);
      isApplyingLayoutRef.current = false;
      buildDefaultInnerLayout(api);
      return;
    }

    const savedLayoutJson = await desktopClient.getConversationLayout(
      binding.conversationId,
    );
    const restoreResult = applySavedConversationLayout(api, savedLayoutJson);
    if (restoreResult.kind === "restored") {
      markPersistedLayout(savedLayoutJson);
      applyChatTileLayoutConstraints(api);
      isApplyingLayoutRef.current = false;
      return;
    }

    if (restoreResult.kind === "fallback") {
      fallbackToDefaultLayoutRef.current = true;
      isApplyingLayoutRef.current = false;
      setLayoutResetNonce((current) => current + 1);
      return;
    }

    markPersistedLayout(null);
    isApplyingLayoutRef.current = false;
    buildDefaultInnerLayout(api);
  }

  function handleInnerReady(event: DockviewReadyEvent) {
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
  }

  return (
    <section className="chat-tile-shell relative flex h-full min-h-0 min-w-0">
      <DockviewReact
        key={`${binding.conversationId}:${layoutResetNonce}`}
        className="chat-tile-inner-dock h-full w-full"
        components={components}
        disableFloatingGroups
        onReady={handleInnerReady}
        singleTabMode="fullwidth"
        tabComponents={CHAT_TILE_TAB_COMPONENTS}
        theme={theme}
      />
    </section>
  );
}
