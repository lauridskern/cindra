import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivityResultCardProps {
  children: ReactNode;
  copyText?: string | null;
  footer: {
    leading: ReactNode;
    trailing: ReactNode;
  };
  title: ReactNode;
}

export function ActivityResultPreformattedBody({ text }: { text: string }) {
  return (
    <pre className="block max-h-72 w-full max-w-full overflow-x-auto overflow-y-auto whitespace-pre px-3 py-2.5 text-[13px] leading-[1.4rem] text-neutral-950 dark:text-neutral-200">
      <code className="inline-block min-w-full w-max align-top whitespace-pre">
        {text}
      </code>
    </pre>
  );
}

export function ActivityResultCard({
  children,
  copyText,
  footer,
  title,
}: ActivityResultCardProps) {
  const [copied, setCopied] = useState(false);
  const resetCopyTimeoutRef = useRef<number | null>(null);
  const canCopy = copyText != null && copyText.length > 0;

  const handleCopy = useCallback(async () => {
    if (!canCopy || navigator.clipboard?.writeText == null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      if (resetCopyTimeoutRef.current != null) {
        window.clearTimeout(resetCopyTimeoutRef.current);
      }
      resetCopyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        resetCopyTimeoutRef.current = null;
      }, 1200);
    } catch {
      setCopied(false);
    }
  }, [canCopy, copyText]);

  useEffect(() => {
    return () => {
      if (resetCopyTimeoutRef.current != null) {
        window.clearTimeout(resetCopyTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/70 my-1">
      <div className="flex items-center justify-between border-b border-neutral-200 pl-2.5 pr-1 py-1 text-[13px] text-neutral-950 dark:border-neutral-800 dark:text-neutral-400">
        <span className="min-w-0 truncate text-neutral-950 dark:text-neutral-200">
          {title}
        </span>
        {canCopy ? (
          <Button
            variant={"ghost"}
            size={"xs"}
            onClick={() => {
              void handleCopy();
            }}
          >
            {copied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        ) : null}
      </div>
      {children}
      <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-1 text-[13px] leading-[1.4rem] text-neutral-950 dark:border-neutral-800 dark:text-neutral-400">
        <span className="min-w-0 flex-1 truncate">{footer.leading}</span>
        <span className="ml-3 shrink-0">{footer.trailing}</span>
      </div>
    </div>
  );
}
