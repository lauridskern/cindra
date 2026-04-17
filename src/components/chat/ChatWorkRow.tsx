import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RequestTimingInfo } from "../../app/SessionContext";
import { ChatActivityRow } from "./ChatActivityRow";
import { ChatStatusLabel } from "./ChatStatusLabel";
import type { ChatThreadItem } from "./chatThreadModel";

interface ChatWorkRowProps {
  item: Extract<ChatThreadItem, { kind: "request_work" }>;
  requestTiming?: RequestTimingInfo;
  workspacePath: string | null;
}

function formatDurationLabel(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function WorkHeaderLabel({
  hasError,
  isRunning,
  requestTiming,
}: {
  hasError: boolean;
  isRunning: boolean;
  requestTiming?: RequestTimingInfo;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isRunning]);

  const label = useMemo(() => {
    if (requestTiming == null) {
      if (isRunning) {
        return "Working";
      }

      return hasError ? "Failed" : "Worked";
    }

    const endTime = requestTiming.completedAtMs ?? now;
    const durationLabel = formatDurationLabel(endTime - requestTiming.startedAtMs);
    if (isRunning) {
      return `Working for ${durationLabel}`;
    }

    return hasError
      ? `Failed after ${durationLabel}`
      : `Worked for ${durationLabel}`;
  }, [hasError, isRunning, now, requestTiming]);

  return <ChatStatusLabel active={isRunning} text={label} />;
}

export function ChatWorkRow({
  item,
  requestTiming,
  workspacePath,
}: ChatWorkRowProps) {
  const [open, setOpen] = useState(item.isRunning || item.hasError);
  const previousRunningRef = useRef(item.isRunning);
  const canExpand = item.activities.length > 0;

  useEffect(() => {
    if (previousRunningRef.current && item.isRunning === false) {
      setOpen(item.hasError);
    } else if (previousRunningRef.current === false && item.isRunning) {
      setOpen(true);
    }

    previousRunningRef.current = item.isRunning;
  }, [item.hasError, item.isRunning]);

  const header = (
    <>
      <WorkHeaderLabel
        hasError={item.hasError}
        isRunning={item.isRunning}
        requestTiming={requestTiming}
      />
      {!item.isRunning && canExpand ? (
        open ? (
          <ChevronDown className="size-4 text-current" />
        ) : (
          <ChevronRight className="size-4 text-current" />
        )
      ) : null}
    </>
  );

  return (
    <div className="grid min-w-0 gap-1">
      {!item.isRunning && canExpand ? (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex min-w-0 items-center justify-between gap-2 border-b border-neutral-200 pb-1 text-left text-[13px] leading-[1.4rem] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"
        >
          {header}
        </button>
      ) : (
        <div className="inline-flex min-w-0 items-center justify-between gap-2 border-b border-neutral-200 pb-1 text-[13px] leading-[1.4rem] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          {header}
        </div>
      )}
      {canExpand && (item.isRunning || open) ? (
        <div className="grid min-w-0 gap-1">
          {item.activities.map((activityItem) => (
            <ChatActivityRow
              key={activityItem.key}
              item={activityItem}
              workspacePath={workspacePath}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
