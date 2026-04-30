import { XIcon } from "lucide-react";

import type { SessionToast, ToastLevel } from "@/app/types/sessionStore";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

interface SessionToastStackProps {
  toasts: SessionToast[];
  onDismiss: (id: string) => void;
}

function getToastToneClass(level: ToastLevel): string {
  switch (level) {
    case "error":
      return "border-red-500/30 bg-red-50/95 text-red-950 shadow-red-950/5 dark:border-red-500/30 dark:bg-red-950/80 dark:text-red-100";
    case "warning":
      return "border-amber-500/30 bg-amber-50/95 text-amber-950 shadow-amber-950/5 dark:border-amber-500/30 dark:bg-amber-950/80 dark:text-amber-100";
    case "info":
      return "border-border bg-popover/95 text-popover-foreground shadow-black/5";
  }
}

export function SessionToastStack({
  toasts,
  onDismiss,
}: SessionToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 grid w-[min(24rem,calc(100vw-2rem))] gap-2"
    >
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={cn(
            "pointer-events-auto rounded-lg border p-3 pr-2 shadow-lg backdrop-blur",
            getToastToneClass(toast.level),
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-5">{toast.title}</p>
              {toast.detail ? (
                <p className="mt-1 line-clamp-3 text-xs leading-5 opacity-80">
                  {toast.detail}
                </p>
              ) : null}
            </div>
            <Button
              aria-label="Dismiss notification"
              className="-mr-1 -mt-1"
              size="icon-xs"
              type="button"
              variant="ghost"
              onClick={() => onDismiss(toast.id)}
            >
              <XIcon strokeWidth={2} className="size-3" />
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
