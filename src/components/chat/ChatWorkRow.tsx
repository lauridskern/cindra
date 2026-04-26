import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

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

interface WorkHeaderLabelOptions {
  failedStepCount: number;
  isRunning: boolean;
  requestTiming?: RequestTimingInfo;
  nowMs?: number;
}

function formatFailedStepCountLabel(failedStepCount: number): string {
  return `Completed with ${failedStepCount} failed step${failedStepCount === 1 ? "" : "s"}`;
}

export function getWorkHeaderLabelText({
  failedStepCount,
  isRunning,
  requestTiming,
  nowMs,
}: WorkHeaderLabelOptions): string {
  if (requestTiming == null) {
    if (isRunning) {
      return "Working";
    }

    return failedStepCount > 0
      ? formatFailedStepCountLabel(failedStepCount)
      : "Worked";
  }

  const endTime = requestTiming.completedAtMs ?? nowMs ?? Date.now();
  const durationLabel = formatDurationLabel(endTime - requestTiming.startedAtMs);

  if (isRunning) {
    return `Working for ${durationLabel}`;
  }

  return failedStepCount > 0
    ? `${formatFailedStepCountLabel(failedStepCount)} after ${durationLabel}`
    : `Worked for ${durationLabel}`;
}

function WorkHeaderLabel({
  failedStepCount,
  isRunning,
  requestTiming,
}: {
  failedStepCount: number;
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

  const label = getWorkHeaderLabelText({
    failedStepCount,
    isRunning,
    requestTiming,
    nowMs: now,
  });

  return <ChatStatusLabel active={isRunning} text={label} />;
}

export function ChatWorkRow({
  item,
  requestTiming,
  workspacePath,
}: ChatWorkRowProps) {
  const [open, setOpen] = useState(item.isRunning || item.hasError);
  const canExpand = item.activities.length > 0;

  const header = (
    <>
      <WorkHeaderLabel
        failedStepCount={item.failedStepCount}
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
              key={`${activityItem.key}:${activityItem.isRunning ? "running" : activityItem.hasError ? "error" : "idle"}`}
              item={activityItem}
              workspacePath={workspacePath}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
