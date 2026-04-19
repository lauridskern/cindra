import type {
  IDockviewPanelProps,
} from "dockview-react";

import type { PlaceholderPaneParams } from "./layout";

export function PlaceholderPane({
  params,
}: IDockviewPanelProps<PlaceholderPaneParams>) {
  return (
    <section className="flex h-full min-h-0 min-w-0 items-center justify-center border border-white/60 bg-white/80 p-6 text-center shadow-xl shadow-neutral-950/5 dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/20">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-400 dark:text-neutral-500">
          {params.kind}
        </p>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {params.label}
        </p>
      </div>
    </section>
  );
}
