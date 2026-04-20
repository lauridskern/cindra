import { useEffect, useState } from "react";

import * as desktopClient from "../services/desktop/client";
import type { PromptSettings } from "../services/desktop/contracts";

async function loadPromptSettings(workspacePath: string | null) {
  if (workspacePath == null) {
    return null;
  }

  try {
    return await desktopClient.getPromptSettings(workspacePath);
  } catch {
    return null;
  }
}

export function usePromptSettings(
  workspacePath: string | null,
  refreshKey?: string | number | null,
) {
  const [promptSettings, setPromptSettings] = useState<PromptSettings | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const settings = await loadPromptSettings(workspacePath);
      if (cancelled === false) {
        setPromptSettings(settings);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, workspacePath]);

  return {
    promptSettings,
    setPromptSettings,
  };
}
