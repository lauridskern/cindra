import { useCallback, useEffect, useRef } from "react";
import type { DockviewApi } from "dockview-react";

import { serializeDockviewLayout } from "./layout";

interface UseDockviewLayoutPersistenceOptions {
  delayMs?: number;
  onPersist: (layoutJson: string) => Promise<void>;
}

export function useDockviewLayoutPersistence({
  delayMs = 500,
  onPersist,
}: UseDockviewLayoutPersistenceOptions) {
  const persistTimeoutRef = useRef<number | null>(null);
  const lastPersistedLayoutJsonRef = useRef<string | null>(null);
  const isApplyingLayoutRef = useRef(false);

  const cancelPendingPersist = useCallback(() => {
    if (persistTimeoutRef.current != null) {
      window.clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = null;
    }
  }, []);

  useEffect(
    () => cancelPendingPersist,
    [cancelPendingPersist, delayMs, onPersist],
  );

  const markPersistedLayout = useCallback((layoutJson: string | null) => {
    lastPersistedLayoutJsonRef.current = layoutJson;
  }, []);

  const schedulePersist = useCallback(
    (getApi: () => DockviewApi | null | undefined) => {
      if (isApplyingLayoutRef.current) {
        return;
      }

      cancelPendingPersist();
      persistTimeoutRef.current = window.setTimeout(async () => {
        const api = getApi();
        if (api == null) {
          return;
        }

        const layoutJson = serializeDockviewLayout(api.toJSON());
        if (lastPersistedLayoutJsonRef.current === layoutJson) {
          return;
        }

        await onPersist(layoutJson);
        lastPersistedLayoutJsonRef.current = layoutJson;
      }, delayMs);
    },
    [cancelPendingPersist, delayMs, onPersist],
  );

  return {
    cancelPendingPersist,
    isApplyingLayoutRef,
    markPersistedLayout,
    schedulePersist,
  };
}
