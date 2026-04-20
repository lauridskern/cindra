import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DockviewReact,
  positionToDirection,
  type DockviewApi,
  type DockviewReadyEvent,
  type DockviewGroupPanel,
  type IDockviewPanel,
  type IDockviewPanelProps,
} from "dockview-react";

import { ConversationPanel } from "@/components/ConversationPanel";
import { PlaceholderPane } from "./PlaceholderPane";
import {
  INNER_CHAT_COMPONENT,
  INNER_PLACEHOLDER_COMPONENT,
  parseDockviewLayoutJson,
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
import { useDockviewLayoutPersistence } from "./useDockviewLayoutPersistence";
import { useDockviewTheme } from "./useDockviewTheme";

function ChatPaneTab() {
  return <div className="chat-pane-dockview-tab" aria-hidden="true" />;
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
      [INNER_CHAT_COMPONENT]: function ConversationPane(
        props: IDockviewPanelProps<ChatBinding>,
      ) {
        return (
          <ConversationPanel
            binding={binding}
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
        );
      },
      [INNER_PLACEHOLDER_COMPONENT]: PlaceholderPane,
    }),
    [binding, canCloseChat, handleOpenPane, onCloseChat],
  );

  const tabComponents = useMemo(
    () => ({
      [INNER_CHAT_COMPONENT]: ChatPaneTab,
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
    <section className="chat-tile-shell relative flex h-full min-h-0 min-w-0">
      <DockviewReact
        key={`${binding.conversationId}:${layoutResetNonce}`}
        className="chat-tile-inner-dock h-full w-full"
        components={components}
        disableFloatingGroups
        onReady={handleInnerReady}
        singleTabMode="fullwidth"
        tabComponents={tabComponents}
        theme={theme}
      />
    </section>
  );
}
