export type SettingsSection = "general" | "providers";

export interface AppSidebarControlProps {
  isSidebarVisible: boolean;
  isSettingsViewOpen: boolean;
  onExitSettings: () => void;
  onToggleDesktopSidebar: () => void;
}
