import type {
  PromptDraftEntry,
  QueuedPromptEntry,
} from "./types/sessionStore";

export function removeQueuedPrompt(
  entries: QueuedPromptEntry[],
  id: string,
): QueuedPromptEntry[] {
  const nextEntries = entries.filter((entry) => entry.id !== id);
  return nextEntries.length === entries.length ? entries : nextEntries;
}

export function reorderQueuedPrompts(
  entries: QueuedPromptEntry[],
  sourceId: string,
  targetId: string | null,
): QueuedPromptEntry[] {
  if (sourceId === targetId) {
    return entries;
  }

  const sourceIndex = entries.findIndex((entry) => entry.id === sourceId);
  if (sourceIndex === -1) {
    return entries;
  }

  const targetIndex =
    targetId == null
      ? entries.length
      : entries.findIndex((entry) => entry.id === targetId);
  if (targetIndex === -1) {
    return entries;
  }

  const nextEntries = [...entries];
  const [sourceEntry] = nextEntries.splice(sourceIndex, 1);
  const nextTargetIndex =
    targetId == null
      ? nextEntries.length
      : Math.max(0, targetIndex > sourceIndex ? targetIndex - 1 : targetIndex);
  nextEntries.splice(nextTargetIndex, 0, sourceEntry);
  return nextEntries;
}

export function queuedPromptFromDraftEdit(
  draftEntry: PromptDraftEntry | null,
): QueuedPromptEntry | null {
  const value = draftEntry?.value.trim() ?? "";
  if (draftEntry?.editingQueuedPromptId == null || value.length === 0) {
    return null;
  }

  return {
    id: draftEntry.editingQueuedPromptId,
    isPlanningMode: draftEntry.isPlanningMode,
    value,
  };
}

export function replaceQueuedPromptWithDraftEdit(
  entries: QueuedPromptEntry[],
  id: string,
  draftEntry: PromptDraftEntry | null,
): QueuedPromptEntry[] {
  const targetIndex = entries.findIndex((entry) => entry.id === id);
  if (targetIndex === -1) {
    return entries;
  }

  const nextEntries = removeQueuedPrompt(entries, id);
  const editedDraftPrompt = queuedPromptFromDraftEdit(draftEntry);
  if (editedDraftPrompt == null) {
    return nextEntries;
  }

  nextEntries.splice(targetIndex, 0, editedDraftPrompt);
  return nextEntries;
}
