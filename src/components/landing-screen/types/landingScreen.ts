import type { QuickStartProjectInput } from "@/services/desktop/contracts";

export interface LandingScreenProps {
  binding?: import("@/services/desktop/contracts").ChatBinding | null;
  embedded?: boolean;
}

export interface LandingScreenControllerProps {
  isOpeningProject: boolean;
  uiError: string | null;
}

export interface CloneFormState {
  repositoryUrl: string;
  parentDirectory: string;
  directoryName: string;
}

export type QuickStartFormState = QuickStartProjectInput;

export type PendingAction = "clone" | "quick-start" | null;
