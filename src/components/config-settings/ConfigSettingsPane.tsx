import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2Icon, LoaderCircle, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { PaneSurface } from "@/components/ui/PaneSurface";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import {
  getForgeConfigFile,
  updateForgeConfigFile,
} from "@/services/desktop/client";

const SAVE_DEBOUNCE_MS = 700;

function normalizeConfigError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Unable to update Forge config.";
}

function formatSaveStatus(
  isDirty: boolean,
  isSaving: boolean,
  savedAt: Date | null,
): string {
  if (isSaving) {
    return "Saving changes...";
  }

  if (isDirty) {
    return "Waiting to save changes...";
  }

  if (savedAt) {
    return `Saved ${savedAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return "Autosaves after you stop typing.";
}

export function ConfigSettingsPane() {
  const saveRequestVersionRef = useRef(0);
  const lastSavedContentsRef = useRef("");

  const [configPath, setConfigPath] = useState("");
  const [contents, setContents] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const isDirty = contents !== lastSavedContentsRef.current;
  const statusText = useMemo(
    () => formatSaveStatus(isDirty, isSaving, savedAt),
    [isDirty, isSaving, savedAt],
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadConfig() {
      setIsLoading(true);
      setLoadError(null);
      setSaveError(null);

      try {
        const config = await getForgeConfigFile();
        if (isCancelled) {
          return;
        }

        saveRequestVersionRef.current += 1;
        lastSavedContentsRef.current = config.contents;
        setConfigPath(config.configPath);
        setContents(config.contents);
        setSavedAt(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setLoadError(normalizeConfigError(error));
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      isCancelled = true;
      saveRequestVersionRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (isLoading || loadError != null || !isDirty) {
      return;
    }

    const requestVersion = saveRequestVersionRef.current + 1;
    saveRequestVersionRef.current = requestVersion;
    setIsSaving(false);
    setSaveError(null);

    const timeoutId = window.setTimeout(() => {
      setIsSaving(true);

      void updateForgeConfigFile({ contents })
        .then((config) => {
          if (saveRequestVersionRef.current !== requestVersion) {
            return;
          }

          lastSavedContentsRef.current = config.contents;
          setConfigPath(config.configPath);
          setContents(config.contents);
          setSavedAt(new Date());
          setSaveError(null);
        })
        .catch((error: unknown) => {
          if (saveRequestVersionRef.current !== requestVersion) {
            return;
          }

          setSaveError(normalizeConfigError(error));
        })
        .finally(() => {
          if (saveRequestVersionRef.current === requestVersion) {
            setIsSaving(false);
          }
        });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [contents, isDirty, isLoading, loadError]);

  function handleReset() {
    saveRequestVersionRef.current += 1;
    setContents(lastSavedContentsRef.current);
    setSaveError(null);
    setIsSaving(false);
  }

  return (
    <PaneSurface className="flex-1" aria-label="Config settings">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col gap-4 overflow-y-auto px-6 pt-6 pb-12">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium text-foreground">Config</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Edit the Forge config file directly. Changes are validated and saved
            automatically after you stop typing.
          </p>
        </div>

        <Card className="min-h-0 flex-1 gap-0 py-0">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            {isLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-[28rem] w-full" />
              </div>
            ) : loadError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
                {loadError}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex flex-col gap-1">
                    <Label htmlFor="forge-config-contents">Forge config</Label>
                    <p className="truncate text-xs text-muted-foreground">
                      {configPath}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {isSaving ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : !isDirty && savedAt ? (
                      <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : null}
                    <span>{statusText}</span>
                  </div>
                </div>

                <Textarea
                  id="forge-config-contents"
                  value={contents}
                  spellCheck={false}
                  className="min-h-[28rem] flex-1 resize-none overflow-auto font-mono text-xs leading-relaxed"
                  onChange={(event) => {
                    setContents(event.target.value);
                  }}
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-h-5 text-xs text-destructive">
                    {saveError}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!isDirty || isSaving}
                    onClick={handleReset}
                  >
                    <RotateCcwIcon data-icon="inline-start" />
                    Revert unsaved changes
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PaneSurface>
  );
}
