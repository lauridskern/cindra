import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type ConversationSurfaceProps = ComponentProps<"section">;

export function ConversationSurface({
  children,
  className,
  ...props
}: ConversationSurfaceProps) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white/80 shadow-xl shadow-neutral-950/5 backdrop-blur-xl dark:bg-neutral-900/80 dark:shadow-black/20",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
