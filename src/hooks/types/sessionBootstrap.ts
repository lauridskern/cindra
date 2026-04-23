import type { SessionSnapshot } from "@/services/desktop/contracts";

export interface UseSessionBootstrapOptions {
  setSessionSnapshot: (snapshot: SessionSnapshot) => void;
  onReady?: () => void;
}
