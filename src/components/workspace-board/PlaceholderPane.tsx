import type {
  IDockviewPanelProps,
} from "dockview-react";

import { PaneSurface } from "@/components/ui/pane-surface";

import type { PlaceholderPaneParams } from "./layout";

export function PlaceholderPane({
  params,
}: IDockviewPanelProps<PlaceholderPaneParams>) {
  return (
    <PaneSurface className="items-center justify-center p-6 text-center">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-400 dark:text-neutral-500">
          {params.kind}
        </p>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {params.label}
        </p>
      </div>
    </PaneSurface>
  );
}
