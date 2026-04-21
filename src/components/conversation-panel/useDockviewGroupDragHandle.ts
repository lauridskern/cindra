import { useEffect, type RefObject } from "react";
import type { DockviewApi, DockviewGroupPanel } from "dockview-react";
import { GroupDragHandler } from "dockview-core/dist/esm/dnd/groupDragHandler";

interface DockviewGroupDragHandle {
  containerApi: DockviewApi;
  group: DockviewGroupPanel;
}

interface UseDockviewGroupDragHandleOptions {
  dragHandle: DockviewGroupDragHandle | undefined;
  elementRef: RefObject<HTMLElement | null>;
  enabled: boolean;
}

export function useDockviewGroupDragHandle({
  dragHandle,
  elementRef,
  enabled,
}: UseDockviewGroupDragHandleOptions) {
  useEffect(() => {
    const element = elementRef.current;
    if (!enabled || dragHandle == null || element == null) {
      return;
    }

    element.draggable = true;
    const handlePointerDown = () => {
      dragHandle.group.api.setActive();
    };
    element.addEventListener("pointerdown", handlePointerDown);

    const handler = new GroupDragHandler(
      element,
      dragHandle.containerApi as never,
      dragHandle.group as never,
      false,
    );

    return () => {
      element.draggable = false;
      element.removeEventListener("pointerdown", handlePointerDown);
      handler.dispose();
    };
  }, [dragHandle, elementRef, enabled]);
}
