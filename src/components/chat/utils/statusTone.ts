import type { StatusCategory } from "@/services/desktop/types/contracts";

export function getStatusToneClass(category: StatusCategory): string {
  switch (category) {
    case "error":
      return "text-red-700 dark:text-red-400";
    case "warning":
      return "text-amber-700 dark:text-amber-400";
    case "completion":
      return "text-emerald-700 dark:text-emerald-400";
    default:
      return "text-neutral-950 dark:text-neutral-400";
  }
}
