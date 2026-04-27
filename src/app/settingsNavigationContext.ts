import { createContext, useContext } from "react";

export interface SettingsNavigationContextValue {
  openProviderSettings: () => void;
}

export const SettingsNavigationContext =
  createContext<SettingsNavigationContextValue>({
    openProviderSettings: () => {},
  });

export function useSettingsNavigation() {
  return useContext(SettingsNavigationContext);
}
