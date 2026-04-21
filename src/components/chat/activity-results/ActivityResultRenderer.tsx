import type { ActivityResultModel } from "./activityResultModel";
import { FileDiffResult } from "./FileDiffResult";
import { ShellOutputResult } from "./ShellOutputResult";
import { TextResult } from "./TextResult";

interface ActivityResultRendererProps {
  result: ActivityResultModel;
}

export function ActivityResultRenderer({
  result,
}: ActivityResultRendererProps) {
  switch (result.kind) {
    case "file_diff":
      return <FileDiffResult result={result} />;
    case "shell":
      return <ShellOutputResult result={result} />;
    case "text":
      return <TextResult result={result} />;
    default:
      return null;
  }
}
