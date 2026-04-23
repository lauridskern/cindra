import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";

import { CHAT_BODY_TEXT_CLASS } from "../constants/chatStyles";
import type {
  ActivityResultCardProps,
  ActivityResultPreformattedBodyProps,
} from "../types/chatComponents";

export function ActivityResultPreformattedBody({
  text,
}: ActivityResultPreformattedBodyProps) {
  return (
    <pre className={`block max-h-72 w-full max-w-full overflow-x-auto overflow-y-auto whitespace-pre px-3 py-2.5 ${CHAT_BODY_TEXT_CLASS} text-neutral-950 dark:text-neutral-200`}>
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
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 text-xs/relaxed text-neutral-950 dark:border-neutral-800 dark:text-neutral-400">
        <div className="min-w-0 flex-1 truncate text-neutral-950 dark:text-neutral-200">
          {title}
        </div>
        {canCopy ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              void handleCopy();
            }}
            className="shrink-0 rounded-full text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        ) : null}
      </div>
      {children}
      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-3 py-2 text-xs/relaxed text-neutral-950 dark:border-neutral-800 dark:text-neutral-400">
        <span className="min-w-0 flex-1 truncate">{footer.leading}</span>
        <span className="shrink-0">{footer.trailing}</span>
      </div>
    </div>
  );
}
