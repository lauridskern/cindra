import type {
  DockviewApi,
  DockviewGroupPanel,
  IDockviewPanel,
} from "dockview-react";

import type { ChatBinding } from "@/services/desktop/contracts";

import {
  CHAT_PANE_ID,
  INNER_CHAT_COMPONENT,
  INNER_PLACEHOLDER_COMPONENT,
  PREVIEW_PANE_ID,
  TERMINAL_PANE_ID,
  type PlaceholderPaneParams,
} from "./layout";

export function groupContainsChatPanel(
  group: DockviewGroupPanel | null | undefined,
): boolean {
  return group?.panels.some((panel) => panel.id === CHAT_PANE_ID) ?? false;
}

export function applyChatTileLayoutConstraints(api: DockviewApi): void {
  api.groups.forEach((group) => {
    group.locked = false;
    group.header.hidden = groupContainsChatPanel(group) && group.size === 1;
  });
}

export function buildDefaultChatTileLayout(
  api: DockviewApi,
  binding: ChatBinding,
): void {
  const chatPanel = api.addPanel({
    id: CHAT_PANE_ID,
    component: INNER_CHAT_COMPONENT,
    tabComponent: INNER_CHAT_COMPONENT,
    title: "Chat",
    params: binding,
  });
  const previewPanel = api.addPanel<PlaceholderPaneParams>({
    id: PREVIEW_PANE_ID,
    component: INNER_PLACEHOLDER_COMPONENT,
    title: "Preview",
    params: {
      ...binding,
      kind: "preview",
      label: "Preview",
    },
    position: {
      direction: "right",
      referencePanel: chatPanel,
    },
  });

  api.addPanel<PlaceholderPaneParams>({
    id: TERMINAL_PANE_ID,
    component: INNER_PLACEHOLDER_COMPONENT,
    title: "Terminal",
    params: {
      ...binding,
      kind: "terminal",
      label: "Terminal",
    },
    position: {
      direction: "below",
      referencePanel: previewPanel,
    },
  });

  applyChatTileLayoutConstraints(api);
}

export function shouldPreventChatOverlay(
  draggedPanel: IDockviewPanel | null,
  draggedGroup: DockviewGroupPanel | null,
  targetGroup: DockviewGroupPanel | null | undefined,
  position: string,
): boolean {
  return (
    position === "center" &&
    (
      draggedPanel?.id === CHAT_PANE_ID ||
      groupContainsChatPanel(draggedGroup) ||
      groupContainsChatPanel(targetGroup)
    )
  );
}

export function isSingleChatSelfDrop(
  draggedPanel: IDockviewPanel | null,
  draggedGroup: DockviewGroupPanel | null,
  targetGroup: DockviewGroupPanel | null | undefined,
): boolean {
  const isSameChatPanelGroupDrop =
    draggedPanel?.id === CHAT_PANE_ID &&
    targetGroup != null &&
    draggedPanel.group === targetGroup &&
    targetGroup.panels.length === 1;
  const isSameChatGroupDrop =
    draggedGroup != null &&
    groupContainsChatPanel(draggedGroup) &&
    targetGroup != null &&
    draggedGroup === targetGroup &&
    targetGroup.panels.length === 1;

  return isSameChatPanelGroupDrop || isSameChatGroupDrop;
}
