import type {
  OutputPreview,
  ToolResultDetail,
} from "@/services/desktop/contracts";

import type { ActivityResultFooter, ActivityResultModel } from "../activity-results/types/activityResult";
import type { ActivityOperation } from "../types/chatThread";

function buildShellPreviewText(
  command: string,
  stdout?: OutputPreview | null,
  stderr?: OutputPreview | null,
): string {
  const lines = [`$ ${command}`];

  if (stdout?.content) {
    lines.push("", stdout.content);
  }
  if (stderr?.content) {
    lines.push("", "[stderr]", stderr.content);
  }

  return lines.join("\n").trim();
}

function buildResultFooter(
  operation: ActivityOperation,
  detail?: Extract<ToolResultDetail, { kind: "shell_output" }> | null,
): ActivityResultFooter {
  return {
    leading:
      detail?.stdout?.tailDisplayLines != null ||
      detail?.stderr?.tailDisplayLines != null
        ? "Showing Forge’s truncated output preview"
        : operation.isError
          ? "Exited with an error"
          : "Completed",
    trailing:
      detail?.exitCode != null
        ? `exit ${detail.exitCode}`
        : operation.isError
          ? "Error"
          : "Success",
  };
}

export function getActivityResultModel(
  operation: ActivityOperation,
): ActivityResultModel | null {
  if (operation.detail.kind === "file_read") {
    return null;
  }

  const detail = operation.resultDetail;
  if (detail?.kind === "shell_output") {
    const text = buildShellPreviewText(detail.command, detail.stdout, detail.stderr);

    return text.length === 0
      ? null
      : {
          kind: "shell",
          title: "Shell",
          text,
          copyText: text,
          footer: buildResultFooter(operation, detail),
        };
  }
  if (detail?.kind === "file_diff") {
    return {
      kind: "file_diff",
      title: "Diff",
      patch: detail.patch,
      copyText: detail.patch,
      footer: buildResultFooter(operation),
    };
  }

  const text =
    operation.outputText ??
    (detail?.kind === "text" ? detail.text : undefined) ??
    operation.summary;
  const trimmedText = text?.trim();

  return trimmedText
    ? {
        kind: "text",
        title: "Output",
        text: trimmedText,
        copyText: trimmedText,
        footer: buildResultFooter(operation),
      }
    : null;
}
