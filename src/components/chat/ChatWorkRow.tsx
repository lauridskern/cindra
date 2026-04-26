import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { RequestTimingInfo } from "@/app/types/sessionContext";
import { formatDurationLabel } from "@/utils/time";

import { CHAT_MUTED_TEXT_CLASS } from "./constants/chatStyles";
import { useRunningNow } from "./hooks/useRunningNow";
import { ChatActivityRow } from "./ChatActivityRow";
import { ChatStatusLabel } from "./ChatStatusLabel";
import type {
  ChatWorkRowProps,
  WorkHeaderLabelProps,
} from "./types/chatComponents";

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
}: WorkHeaderLabelProps) {
  const now = useRunningNow(isRunning);

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
          className={`inline-flex min-w-0 items-center justify-between gap-2 border-b border-neutral-200 pb-1 text-left dark:border-neutral-800 ${CHAT_MUTED_TEXT_CLASS}`}
        >
          {header}
        </button>
      ) : (
        <div className={`inline-flex min-w-0 items-center justify-between gap-2 border-b border-neutral-200 pb-1 dark:border-neutral-800 ${CHAT_MUTED_TEXT_CLASS}`}>
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
