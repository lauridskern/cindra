import { useEffect, useState } from "react";

import * as desktopClient from "../services/desktop/client";
import type { RuntimeStatus } from "../services/desktop/contracts";

async function loadRuntimeStatus(workspacePath: string | null) {
  try {
    return await desktopClient.getRuntimeStatus(workspacePath);
  } catch {
    return null;
  }
}

export function useRuntimeStatus(
  workspacePath: string | null,
  refreshKey?: string | number | null,
) {
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(
    null,
  );

  async function refreshRuntimeStatus() {
    const status = await loadRuntimeStatus(workspacePath);
    setRuntimeStatus(status);
    return status;
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const status = await loadRuntimeStatus(workspacePath);
      if (cancelled === false) {
        setRuntimeStatus(status);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, workspacePath]);

  return {
    refreshRuntimeStatus,
    runtimeStatus,
    setRuntimeStatus,
  };
}
