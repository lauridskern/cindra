import type { QuickStartProjectInput } from "@/services/desktop/types/contracts";

export interface LandingScreenProps {
  binding?: import("@/services/desktop/types/contracts").ChatBinding | null;
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
