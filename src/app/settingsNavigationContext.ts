import { createContext, useContext } from "react";

export interface SettingsNavigationContextValue {
  openProviderSettings: () => void;
  openConfigSettings: () => void;
}

export const SettingsNavigationContext =
  createContext<SettingsNavigationContextValue>({
    openProviderSettings: () => {},
    openConfigSettings: () => {},
  });

export function useSettingsNavigation() {
  return useContext(SettingsNavigationContext);
}
