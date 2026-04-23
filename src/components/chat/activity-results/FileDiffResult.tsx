import { Suspense, lazy, useCallback, useMemo } from "react";

import { openWorkspacePathInTarget } from "@/app/sessionClientActions";
import {
  EDITOR_APP_TARGET_IDS,
  OPEN_IN_PREFERRED_APP_STORAGE_KEY,
  isAppTargetId,
} from "@/components/conversation-panel/model";
import { useWorkspaceMeta } from "@/hooks/useSession";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  ActivityResultCard,
  ActivityResultPreformattedBody,
} from "./ActivityResultCard";
import type { ActivityResultModel } from "./activityResultModel";
import { getFileDiffPatchStats } from "./fileDiffUtils";

interface FileDiffResultProps {
  result: Extract<ActivityResultModel, { kind: "file_diff" }>;
  workspacePath: string | null;
}

const LazyPatchDiff = lazy(async () => {
  const module = await import("@pierre/diffs/react");
  return { default: module.PatchDiff };
});

function getDisplayName(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const segments = normalizedPath.split("/");
  return segments.at(-1) || path || "Diff";
}

function getDisplayPath(path: string, workspacePath: string | null): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const normalizedWorkspacePath = workspacePath?.replace(/\\/g, "/");

  if (
    normalizedWorkspacePath != null &&
    normalizedPath.startsWith(normalizedWorkspacePath)
  ) {
    const trimmed = normalizedPath
      .slice(normalizedWorkspacePath.length)
      .replace(/^\/+/, "");
    return trimmed.length > 0 ? trimmed : ".";
  }

  return normalizedPath;
}

function FileDiffLoadingBody() {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 px-3 py-6 text-[13px] text-neutral-500 dark:text-neutral-400">
      <LoadingSpinner className="size-4" />
      <span>Loading diff...</span>
    </div>
  );
}

export function FileDiffResult({ result, workspacePath }: FileDiffResultProps) {
  const workspaceMeta = useWorkspaceMeta(workspacePath);
  const isGitPatch = result.patch.startsWith("diff --git ");
  const patchStats = getFileDiffPatchStats(result.patch);
  const displayName = getDisplayName(result.path);
  const displayPath = getDisplayPath(result.path, workspacePath);
  const availableOpenTargets =
    workspaceMeta.runtimeStatus?.availableOpenTargets ?? [];
  const preferredEditorTargetId = useMemo(() => {
    const availableEditorTargetIds = EDITOR_APP_TARGET_IDS.filter((targetId) =>
      availableOpenTargets.includes(targetId),
    );
    const storedPreferredTargetId =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(OPEN_IN_PREFERRED_APP_STORAGE_KEY);

    if (
      storedPreferredTargetId != null &&
      isAppTargetId(storedPreferredTargetId) &&
      availableEditorTargetIds.includes(storedPreferredTargetId)
    ) {
      return storedPreferredTargetId;
    }

    return availableEditorTargetIds[0] ?? null;
  }, [availableOpenTargets]);
  const canOpenInEditor =
    workspacePath != null && preferredEditorTargetId != null;
  const handleOpenInEditor = useCallback(() => {
    if (workspacePath == null || preferredEditorTargetId == null) {
      return;
    }

    void openWorkspacePathInTarget(
      workspacePath,
      preferredEditorTargetId,
      result.path,
    );
  }, [preferredEditorTargetId, result.path, workspacePath]);

  const footer = {
    leading: (
      <code className="font-mono text-[12px] text-neutral-500 dark:text-neutral-400">
        {displayPath}
      </code>
    ),
    trailing:
      patchStats == null ? null : (
        <span className="inline-flex items-center gap-2 font-mono text-[12px]">
          <span className="text-emerald-600 dark:text-emerald-400">
            +{patchStats.additions}
          </span>
          <span className="text-red-600 dark:text-red-400">
            -{patchStats.deletions}
          </span>
        </span>
      ),
  };

  return (
    <ActivityResultCard
      title={
        canOpenInEditor ? (
          <button
            type="button"
            onClick={handleOpenInEditor}
            className="cursor-pointer font-mono text-[12px] text-neutral-950 underline decoration-transparent underline-offset-2 transition hover:text-sky-600 hover:decoration-current dark:text-neutral-100 dark:hover:text-sky-400"
          >
            {displayName}
          </button>
        ) : (
          <code className="font-mono text-[12px] text-neutral-950 dark:text-neutral-100">
            {displayName}
          </code>
        )
      }
      copyText={result.copyText}
      footer={footer}
    >
      {isGitPatch ? (
        <Suspense fallback={<FileDiffLoadingBody />}>
          <LazyPatchDiff
            patch={result.patch}
            disableWorkerPool
            className="block max-w-full overflow-hidden text-xs"
            options={{
              diffIndicators: "bars",
              diffStyle: "unified",
              lineDiffType: "word-alt",
              overflow: "scroll",
              disableFileHeader: true,
              themeType: "system",
            }}
          />
        </Suspense>
      ) : (
        <ActivityResultPreformattedBody text={result.patch} />
      )}
    </ActivityResultCard>
  );
}
