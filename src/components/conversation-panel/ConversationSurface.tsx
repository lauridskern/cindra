import type { ComponentProps } from "react";

import { PaneSurface } from "@/components/ui/pane-surface";
import { cn } from "@/lib/utils";

type ConversationSurfaceProps = ComponentProps<"section">;

export function ConversationSurface({
  children,
  className,
  ...props
}: ConversationSurfaceProps) {
  return (
    <PaneSurface
      className={cn(
        "flex-1 shadow-xl shadow-neutral-950/5 dark:shadow-black/20",
        className,
      )}
      framed
      {...props}
    >
      {children}
    </PaneSurface>
  );
}
