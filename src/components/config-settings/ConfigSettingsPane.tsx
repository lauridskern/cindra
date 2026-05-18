import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2Icon, LoaderCircle, RotateCcwIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PaneSurface } from "@/components/ui/PaneSurface";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import {
  getForgeConfigFile,
  resetForgeConfigFile,
  updateForgeConfigFile,
} from "@/services/desktop/client";
import { cn } from "@/utils/cn";

import {
  parseForgeConfigForm,
  updateForgeConfigField,
  type ForgeConfigField,
} from "./utils/forgeConfigForm";

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
  isResetting: boolean,
  savedAt: Date | null,
): string {
  if (isResetting) {
    return "Resetting defaults...";
  }

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

  return "";
}

function getFieldControlId(field: ForgeConfigField) {
  return `forge-config-${field.lineIndex}-${field.sectionName}-${field.key}`
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-");
}

function isMultilineConfigField(field: ForgeConfigField) {
  return field.valueKind === "array" || field.inputValue.includes("\n");
}

function ConfigFieldControl({
  field,
  onChange,
}: {
  field: ForgeConfigField;
  onChange: (field: ForgeConfigField, nextValue: string) => void;
}) {
  const controlId = getFieldControlId(field);
  const isMultilineField = isMultilineConfigField(field);

  return (
    <Field
      orientation="responsive"
      className={cn(
        "@md/field-group:grid @md/field-group:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)]",
        isMultilineField
          ? "@md/field-group:items-start"
          : "@md/field-group:items-center",
      )}
    >
      <FieldLabel htmlFor={controlId} className="min-w-0 text-muted-foreground">
        {field.label}
      </FieldLabel>
      {field.valueKind === "boolean" ? (
        <Select
          value={field.inputValue}
          onValueChange={(nextValue) => {
            if (nextValue == null) {
              return;
            }

            onChange(field, nextValue);
          }}
        >
          <SelectTrigger id={controlId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="true">true</SelectItem>
              <SelectItem value="false">false</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : isMultilineField ? (
        <Textarea
          id={controlId}
          value={field.inputValue}
          spellCheck={false}
          className="min-h-24 font-mono"
          onChange={(event) => {
            onChange(field, event.target.value);
          }}
        />
      ) : (
        <Input
          id={controlId}
          value={field.inputValue}
          spellCheck={false}
          className="font-mono"
          onChange={(event) => {
            onChange(field, event.target.value);
          }}
        />
      )}
    </Field>
  );
}

export function ConfigSettingsPane() {
  const saveRequestVersionRef = useRef(0);

  const [contents, setContents] = useState("");
  const [lastSavedContents, setLastSavedContents] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const isDirty = contents !== lastSavedContents;
  const isBusy = isSaving || isResetting;
  const statusText = useMemo(
    () => formatSaveStatus(isDirty, isSaving, isResetting, savedAt),
    [isDirty, isResetting, isSaving, savedAt],
  );
  const configSections = useMemo(
    () => parseForgeConfigForm(contents),
    [contents],
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
        setLastSavedContents(config.contents);
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

    const timeoutId = window.setTimeout(() => {
      if (saveRequestVersionRef.current !== requestVersion) {
        return;
      }

      setIsSaving(true);

      void updateForgeConfigFile({ contents })
        .then((config) => {
          if (saveRequestVersionRef.current !== requestVersion) {
            return;
          }

          setLastSavedContents(config.contents);
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

  async function handleResetToDefaults() {
    const requestVersion = saveRequestVersionRef.current + 1;
    saveRequestVersionRef.current = requestVersion;
    setIsSaving(false);
    setIsResetting(true);
    setSaveError(null);

    try {
      const config = await resetForgeConfigFile();
      if (saveRequestVersionRef.current !== requestVersion) {
        return;
      }

      setLastSavedContents(config.contents);
      setContents(config.contents);
      setSavedAt(new Date());
    } catch (error) {
      if (saveRequestVersionRef.current !== requestVersion) {
        return;
      }

      setSaveError(normalizeConfigError(error));
    } finally {
      if (saveRequestVersionRef.current === requestVersion) {
        setIsResetting(false);
      }
    }
  }

  function handleFieldChange(field: ForgeConfigField, nextValue: string) {
    setIsSaving(false);
    setSaveError(null);
    setContents((currentContents) =>
      updateForgeConfigField(currentContents, field, nextValue),
    );
  }

  return (
    <PaneSurface className="flex-1" aria-label="Config settings">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col gap-4 overflow-y-auto px-6 pt-6 pb-12">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-1">
            <h1 className="text-lg font-medium text-foreground">Config</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Edit Forge settings as fields. Changes are validated and saved
              automatically after you stop typing.
            </p>
          </div>
          {!isLoading && loadError == null && statusText ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isBusy ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : !isDirty && savedAt ? (
                <CheckCircle2Icon className="size-3.5 text-primary" />
              ) : null}
              <span>{statusText}</span>
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        ) : loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : (
          <>
            {configSections.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No editable config fields were found in this file.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-col gap-3">
                {configSections.map((section) => (
                  <Card key={section.id} size="sm">
                    <CardHeader>
                      <CardTitle>{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FieldGroup className="gap-2">
                        {section.fields.map((field) => (
                          <ConfigFieldControl
                            key={field.id}
                            field={field}
                            onChange={handleFieldChange}
                          />
                        ))}
                      </FieldGroup>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-h-5 text-xs text-destructive">
                {saveError}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => {
                  void handleResetToDefaults();
                }}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Reset to defaults
              </Button>
            </div>
          </>
        )}
      </div>
    </PaneSurface>
  );
}
