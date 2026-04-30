import type { ReactNode } from "react";

export type SettingsSection = "general" | "providers" | "config";

export interface AppSidebarControlProps {
  isSidebarVisible: boolean;
  isSettingsViewOpen: boolean;
  onExitSettings: () => void;
  onToggleDesktopSidebar: () => void;
}

export interface SessionProviderProps {
  children: ReactNode;
}
