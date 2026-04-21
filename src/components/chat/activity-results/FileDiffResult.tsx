import { Suspense, lazy } from "react";

import {
  ActivityResultCard,
  ActivityResultPreformattedBody,
} from "./ActivityResultCard";
import type { ActivityResultModel } from "./activityResultModel";

interface FileDiffResultProps {
  result: Extract<ActivityResultModel, { kind: "file_diff" }>;
}

const LazyPatchDiff = lazy(async () => {
  const module = await import("@pierre/diffs/react");
  return { default: module.PatchDiff };
});

export function FileDiffResult({ result }: FileDiffResultProps) {
  return (
    <ActivityResultCard
      title={result.title}
      copyText={result.copyText}
      footer={result.footer}
    >
      <Suspense fallback={<ActivityResultPreformattedBody text={result.patch} />}>
        <LazyPatchDiff
          patch={result.patch}
          disableWorkerPool
          className="block max-w-full overflow-hidden"
          options={{
            diffStyle: "unified",
            lineDiffType: "word-alt",
            overflow: "scroll",
            themeType: "system",
          }}
        />
      </Suspense>
    </ActivityResultCard>
  );
}
