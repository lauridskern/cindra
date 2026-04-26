import type { LucideIcon } from "lucide-react";
import {
  BotIcon,
  FolderIcon,
  GhostIcon,
  HammerIcon,
  SmartphoneIcon,
  SquareTerminalIcon,
  TerminalIcon,
} from "lucide-react";

export type AppTargetId =
  | "cursor"
  | "zed"
  | "file-manager"
  | "terminal"
  | "ghostty"
  | "warp"
  | "xcode"
  | "android-studio";

export interface AppTarget {
  id: AppTargetId;
  label: string;
  icon: LucideIcon;
}

export type PendingHeaderAction =
  | "switch-project"
  | "checkout"
  | "create-branch"
  | "commit"
  | "push"
  | "handoff-local"
  | "handoff-worktree"
  | "open-target";

export const appTargets: readonly AppTarget[] = [
  { id: "cursor", label: "Cursor", icon: BotIcon },
  { id: "zed", label: "Zed", icon: SquareTerminalIcon },
  { id: "file-manager", label: "Finder", icon: FolderIcon },
  { id: "terminal", label: "Terminal", icon: TerminalIcon },
  { id: "ghostty", label: "Ghostty", icon: GhostIcon },
  { id: "warp", label: "Warp", icon: SquareTerminalIcon },
  { id: "xcode", label: "Xcode", icon: HammerIcon },
  { id: "android-studio", label: "Android Studio", icon: SmartphoneIcon },
];

export const DEFAULT_APP_TARGET_ID: AppTargetId = appTargets[0].id;
export const OPEN_IN_PREFERRED_APP_STORAGE_KEY = "agent-ui:preferred-open-app";
export const EDITOR_APP_TARGET_IDS: readonly AppTargetId[] = [
  "cursor",
  "zed",
  "xcode",
  "android-studio",
];

export function isAppTargetId(value: string): value is AppTargetId {
  return appTargets.some((target) => target.id === value);
}

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function rankSearchFieldMatch(field: string, normalizedQuery: string): number {
  const normalizedField = normalizeSearchText(field);
  if (
    normalizedField.length === 0 ||
    !normalizedField.includes(normalizedQuery)
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  if (normalizedField === normalizedQuery) {
    return 3;
  }

  if (normalizedField.startsWith(normalizedQuery)) {
    return 2;
  }

  return 1;
}

export function rankBranchMatch(
  branchName: string,
  normalizedQuery: string,
): number {
  const searchTerms = [
    branchName,
    branchName.replace(/^origin\//, ""),
    ...branchName.split("/"),
  ].filter((term) => term.length > 0);

  for (const [index, field] of searchTerms.entries()) {
    const fieldRank = rankSearchFieldMatch(field, normalizedQuery);
    if (fieldRank !== Number.NEGATIVE_INFINITY) {
      return 1_000 - index * 100 + fieldRank;
    }
  }

  return Number.NEGATIVE_INFINITY;
}
