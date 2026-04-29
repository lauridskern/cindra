import { Suspense, lazy, useCallback } from "react";

import { openWorkspacePathInTarget } from "@/app/sessionClientActions";
import {
  EDITOR_APP_TARGET_IDS,
  appTargets,
} from "@/components/conversation-panel/constants/conversationHeader";
import { usePreferredOpenTarget } from "@/components/conversation-panel/hooks/usePreferredOpenTarget";
import { useWorkspaceMeta } from "@/hooks/useSession";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  ActivityResultCard,
  ActivityResultPreformattedBody,
} from "./ActivityResultCard";
import type { FileDiffResultProps } from "../types/chatComponents";
import {
  getFileDiffDisplayName,
  getFileDiffDisplayPath,
  getFileDiffPatchStats,
} from "./utils/fileDiff";

const LazyPatchDiff = lazy(async () => {
  const module = await import("@pierre/diffs/react");
  return { default: module.PatchDiff };
});

const diffBodyClassName = "max-h-[min(36rem,60vh)] overflow-auto overscroll-contain";

function FileDiffLoadingBody() {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 px-3 py-6 text-xs/relaxed text-neutral-500 dark:text-neutral-400">
      <LoadingSpinner className="size-4" />
      <span>Loading diff...</span>
    </div>
  );
}

export function FileDiffResult({ result, workspacePath }: FileDiffResultProps) {
  const workspaceMeta = useWorkspaceMeta(workspacePath);
  const isGitPatch = result.patch.startsWith("diff --git ");
  const patchStats = getFileDiffPatchStats(result.patch);
  const displayName = getFileDiffDisplayName(result.path);
  const displayPath = getFileDiffDisplayPath(result.path, workspacePath);
  const availableOpenTargets =
    workspaceMeta.runtimeStatus?.availableOpenTargets ?? [];
  const availableEditorTargets = appTargets.filter(
    (target) =>
      EDITOR_APP_TARGET_IDS.includes(target.id) &&
      availableOpenTargets.includes(target.id),
  );
  const { resolvedPreferredAppId } =
    usePreferredOpenTarget(availableEditorTargets);
  const canOpenInEditor =
    workspacePath != null && availableEditorTargets.length > 0;
  const handleOpenInEditor = useCallback(() => {
    if (workspacePath == null || availableEditorTargets.length === 0) {
      return;
    }

    void openWorkspacePathInTarget(
      workspacePath,
      resolvedPreferredAppId,
      result.path,
    );
  }, [availableEditorTargets.length, resolvedPreferredAppId, result.path, workspacePath]);

  const footer = {
    leading: (
      <code className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
        {displayPath}
      </code>
    ),
    trailing:
      patchStats == null ? null : (
        <span className="inline-flex items-center gap-2 font-mono text-xs">
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
            className="max-w-full cursor-pointer truncate font-mono text-xs text-neutral-950 underline decoration-transparent underline-offset-2 transition hover:text-sky-600 hover:decoration-current dark:text-neutral-100 dark:hover:text-sky-400"
          >
            {displayName}
          </button>
        ) : (
          <code className="font-mono text-xs text-neutral-950 dark:text-neutral-100">
            {displayName}
          </code>
        )
      }
      copyText={result.copyText}
      footer={footer}
    >
      {isGitPatch ? (
        <div className={diffBodyClassName}>
          <Suspense fallback={<FileDiffLoadingBody />}>
            <LazyPatchDiff
              patch={result.patch}
              disableWorkerPool
              className="block max-w-full text-xs/relaxed"
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
        </div>
      ) : (
        <div className={diffBodyClassName}>
          <ActivityResultPreformattedBody text={result.patch} />
        </div>
      )}
    </ActivityResultCard>
  );
}
