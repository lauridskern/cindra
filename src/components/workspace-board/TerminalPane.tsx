import { useRef } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import "@wterm/dom/css";

import { PaneSurface } from "@/components/ui/PaneSurface";
import { useTerminalSession } from "./hooks/useTerminalSession";
import type { TerminalPaneParams } from "./types/layout";

export function TerminalPane({
  params,
}: IDockviewPanelProps<TerminalPaneParams>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { status } = useTerminalSession(params, containerRef);

  return (
    <PaneSurface className="terminal-pane-shell relative">
      <div className="relative flex min-h-0 flex-1">
        <div className="h-full min-h-0 w-full min-w-0 px-3 py-2.5">
          <div ref={containerRef} className="h-full min-h-0 w-full min-w-0" />
        </div>
        {status != null ? (
          <div className="pointer-events-none absolute inset-x-4 top-4 rounded-md border border-neutral-200 bg-white/90 px-3 py-2 text-xs text-neutral-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/80 dark:text-neutral-200">
            {status.message}
          </div>
        ) : null}
      </div>
    </PaneSurface>
  );
}
