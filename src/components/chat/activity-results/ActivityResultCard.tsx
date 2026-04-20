import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

interface ActivityResultCardProps {
  children: ReactNode;
  copyText?: string | null;
  footer: {
    leading: string;
    trailing: string;
  };
  title: string;
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
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/70">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 text-[13px] leading-[1.4rem] text-neutral-950 dark:border-neutral-800 dark:text-neutral-400">
        <span>{title}</span>
        {canCopy ? (
          <button
            type="button"
            onClick={() => {
              void handleCopy();
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] leading-[1.4rem] text-neutral-950 transition hover:bg-neutral-200/70 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>
      {children}
      <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2 text-[13px] leading-[1.4rem] text-neutral-950 dark:border-neutral-800 dark:text-neutral-400">
        <span>{footer.leading}</span>
        <span>{footer.trailing}</span>
      </div>
    </div>
  );
}
