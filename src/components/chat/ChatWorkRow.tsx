import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { formatDurationLabel } from "@/utils/time";

import { CHAT_MUTED_TEXT_CLASS } from "./constants/chatStyles";
import { useRunningNow } from "./hooks/useRunningNow";
import { ChatActivityRow } from "./ChatActivityRow";
import { ChatStatusLabel } from "./ChatStatusLabel";
import type {
  ChatWorkRowProps,
  WorkHeaderLabelProps,
} from "./types/chatComponents";

function WorkHeaderLabel({
  hasError,
  isRunning,
  requestTiming,
}: WorkHeaderLabelProps) {
  const now = useRunningNow(isRunning);

  let label = "Worked";
  if (requestTiming == null) {
    if (isRunning) {
      label = "Working";
    } else {
      label = hasError ? "Failed" : "Worked";
    }
  } else {
    const endTime = requestTiming.completedAtMs ?? now;
    const durationLabel = formatDurationLabel(
      endTime - requestTiming.startedAtMs,
    );
    label = isRunning
      ? `Working for ${durationLabel}`
      : hasError
        ? `Failed after ${durationLabel}`
        : `Worked for ${durationLabel}`;
  }

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
