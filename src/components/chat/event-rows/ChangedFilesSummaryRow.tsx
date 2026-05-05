import { useMemo, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type {
  ToolResultDetail,
  TranscriptMessage,
} from "@/services/desktop/types/contracts";
import { ActivityResultCard } from "../activity-results/ActivityResultCard";
import { FileDiffBody } from "../activity-results/FileDiffResult";
import type { ChangedFilesSummary } from "../utils/changedFilesSummary";

interface ChangedFilesSummaryDiff {
  path: string;
  detail: Extract<ToolResultDetail, { kind: "file_diff" }>;
}

interface ChangedFilesSummaryRowProps {
  messages: TranscriptMessage[];
  requestId: string;
  summary: ChangedFilesSummary;
}

function changedFilesTitle(count: number) {
  return `${count} ${count === 1 ? "file" : "files"} changed`;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function collectSummaryDiffs(
  messages: TranscriptMessage[],
  requestId: string,
): ChangedFilesSummaryDiff[] {
  return messages.flatMap((message) => {
    if (
      message.kind !== "tool_end" ||
      message.requestId !== requestId ||
      message.detail?.kind !== "file_diff"
    ) {
      return [];
    }

    return [{
      path: normalizePath(message.detail.path),
      detail: message.detail,
    }];
  });
}

function formatStat(value: number | null, prefix: "+" | "-") {
  return value == null ? `${prefix}-` : `${prefix}${value}`;
}

function getTotalStat(
  files: ChangedFilesSummary["files"],
  key: "additions" | "deletions",
) {
  if (files.some((file) => file[key] == null)) {
    return null;
  }

  return files.reduce((total, file) => total + (file[key] ?? 0), 0);
}

export function ChangedFilesSummaryRow({
  messages,
  requestId,
  summary,
}: ChangedFilesSummaryRowProps) {
  const [openDiffPath, setOpenDiffPath] = useState<string | null>(null);
  const diffsByPath = useMemo(() => {
    return new Map(
      collectSummaryDiffs(messages, requestId).map((diff) => [diff.path, diff]),
    );
  }, [messages, requestId]);
  const totalAdditions = getTotalStat(summary.files, "additions");
  const totalDeletions = getTotalStat(summary.files, "deletions");

  return (
    <article className="max-w-3xl">
      <ActivityResultCard
        title={
          <span className="inline-flex min-w-0 items-baseline gap-1.5 text-sm/6 font-normal text-neutral-950 dark:text-neutral-100">
            <span>{changedFilesTitle(summary.count)}</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              {formatStat(totalAdditions, "+")}
            </span>
            <span className="font-mono text-red-600 dark:text-red-400">
              {formatStat(totalDeletions, "-")}
            </span>
          </span>
        }
        actions={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled
            title="Undo changed files"
            className="shrink-0 rounded-full text-neutral-500 disabled:opacity-100 dark:text-neutral-400"
          >
            <RotateCcw className="size-3" />
            Undo
          </Button>
        }
      >
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {summary.files.map((file) => {
            const normalizedPath = normalizePath(file.path);
            const isOpen = openDiffPath === normalizedPath;
            const diff = diffsByPath.get(normalizedPath);

            return (
              <div key={file.path} className="grid min-w-0">
                <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2.5 text-left">
                  <code className="min-w-0 truncate font-mono text-xs/6 text-neutral-950 dark:text-neutral-100">
                    {file.path}
                  </code>
                  <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs/6">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatStat(file.additions, "+")}
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      {formatStat(file.deletions, "-")}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={diff == null}
                    title={`Open diff for ${file.path}`}
                    onClick={() => {
                      setOpenDiffPath((current) =>
                        current === normalizedPath ? null : normalizedPath,
                      );
                    }}
                    className="text-neutral-500 dark:text-neutral-400"
                  >
                    <ChevronDown
                      className={
                        isOpen
                          ? "size-3.5 rotate-180 transition-transform"
                          : "size-3.5 transition-transform"
                      }
                    />
                  </Button>
                </div>
                {isOpen && diff != null ? (
                  <div className="border-t border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-950/40">
                    <FileDiffBody patch={diff.detail.patch} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </ActivityResultCard>
    </article>
  );
}
