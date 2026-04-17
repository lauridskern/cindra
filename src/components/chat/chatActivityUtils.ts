import type {
  OutputPreview,
  ToolResultDetail,
} from "../../services/desktop/contracts";
import type { ActivityOperation } from "./chatThreadModel";

function formatPath(path: string, workspacePath: string | null): string {
  if (workspacePath == null || !path.startsWith(workspacePath)) {
    return path;
  }

  const trimmed = path.slice(workspacePath.length).replace(/^\/+/, "");
  return trimmed.length === 0 ? "." : trimmed;
}

function formatLineRange(startLine?: number, endLine?: number): string {
  if (startLine == null && endLine == null) {
    return "";
  }
  if (startLine != null && endLine != null) {
    return `:${startLine}-${endLine}`;
  }
  if (startLine != null) {
    return `:${startLine}`;
  }

  return `:1-${endLine}`;
}

export function formatOperationLabel(
  operation: ActivityOperation,
  workspacePath: string | null,
): string {
  switch (operation.detail.kind) {
    case "file_read":
      return `Read ${formatPath(operation.detail.path, workspacePath)}${formatLineRange(operation.detail.startLine, operation.detail.endLine)}`;
    case "file_update": {
      const verb = (() => {
        switch (operation.detail.operation) {
          case "create":
            return "Created";
          case "overwrite":
            return "Overwrote";
          case "replace":
            return "Updated";
          case "remove":
            return "Removed";
          case "undo":
            return "Undid";
          default:
            return "Updated";
        }
      })();

      return `${verb} ${formatPath(operation.detail.path, workspacePath)}`;
    }
    case "shell":
      return operation.detail.command;
    case "search":
      return `Searched ${operation.detail.path ? formatPath(operation.detail.path, workspacePath) : "."} for ${operation.detail.pattern}`;
    case "codebase_search":
      return `Codebase search: ${operation.detail.queries.join(" · ")}`;
    case "fetch":
      return `Fetched ${operation.detail.url}`;
    case "followup":
      return `Asked follow-up: ${operation.detail.question}`;
    case "plan":
      return `Updated plan ${operation.detail.planName}`;
    case "skill":
      return `Loaded skill ${operation.detail.name}`;
    case "task":
      return `Delegated to ${operation.detail.agentId}`;
    case "todo_read":
      return "Read todos";
    case "todo_write":
      return `Updated ${operation.detail.count} todo item${operation.detail.count === 1 ? "" : "s"}`;
    case "unknown":
      return `Ran ${operation.detail.name}`;
    default:
      return operation.name;
  }
}

function buildPreviewText(
  command: string,
  stdout?: OutputPreview,
  stderr?: OutputPreview,
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

export function buildGenericOutputText(
  operation: ActivityOperation,
): string | null {
  const detail = operation.resultDetail;
  if (detail?.kind === "shell_output") {
    return buildPreviewText(detail.command, detail.stdout, detail.stderr);
  }

  const genericText =
    operation.outputText ??
    (detail?.kind === "text" ? detail.text : undefined) ??
    operation.summary;

  return genericText?.trim() ? genericText.trim() : null;
}

export function getShellDetail(detail: ToolResultDetail | undefined) {
  return detail?.kind === "shell_output" ? detail : null;
}
