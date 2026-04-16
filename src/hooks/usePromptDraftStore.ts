import { useCallback, useState, type MutableRefObject } from 'react'

import { useLatestRef } from './useLatestRef'

interface PromptDraftEntry {
  value: string
  isPending: boolean
}

type PromptDraftStore = Record<string, PromptDraftEntry>

export interface PromptDraftStoreApi {
  clearPromptDraft: (key: string | null) => void
  draftsRef: MutableRefObject<PromptDraftStore>
  isSendingPrompt: boolean
  movePromptDraft: (fromKey: string | null, toKey: string | null) => void
  promptDraft: string
  setPromptDraft: (value: string) => void
  setPromptDraftPending: (key: string | null, isPending: boolean) => void
}

function getPromptDraftEntry(
  drafts: PromptDraftStore,
  key: string,
): PromptDraftEntry | null {
  return drafts[key] ?? null
}

function writePromptDraftEntry(
  drafts: PromptDraftStore,
  key: string,
  entry: PromptDraftEntry | null,
): PromptDraftStore {
  const current = drafts[key] ?? null
  const nextEntry =
    entry == null || (entry.value === '' && !entry.isPending) ? null : entry

  if (nextEntry == null) {
    if (current == null) {
      return drafts
    }

    const nextDrafts = { ...drafts }
    delete nextDrafts[key]
    return nextDrafts
  }

  if (
    current?.value === nextEntry.value &&
    current?.isPending === nextEntry.isPending
  ) {
    return drafts
  }

  return {
    ...drafts,
    [key]: nextEntry,
  }
}

function setPromptDraftEntryValue(
  drafts: PromptDraftStore,
  key: string,
  value: string,
): PromptDraftStore {
  const current = getPromptDraftEntry(drafts, key) ?? {
    value: '',
    isPending: false,
  }

  return writePromptDraftEntry(drafts, key, { ...current, value })
}

function setPromptDraftEntryPending(
  drafts: PromptDraftStore,
  key: string,
  isPending: boolean,
): PromptDraftStore {
  const current = getPromptDraftEntry(drafts, key) ?? {
    value: '',
    isPending: false,
  }

  return writePromptDraftEntry(drafts, key, { ...current, isPending })
}

function movePromptDraftEntry(
  drafts: PromptDraftStore,
  fromKey: string | null,
  toKey: string | null,
): PromptDraftStore {
  if (fromKey == null || toKey == null || fromKey === toKey) {
    return drafts
  }

  const draft = getPromptDraftEntry(drafts, fromKey)
  if (draft == null) {
    return drafts
  }

  const nextDrafts = {
    ...writePromptDraftEntry(drafts, toKey, draft),
  }
  delete nextDrafts[fromKey]
  return nextDrafts
}

export function usePromptDraftStore(
  currentPromptDraftKey: string | null,
): PromptDraftStoreApi {
  const [drafts, setDrafts] = useState<PromptDraftStore>({})
  const draftsRef = useLatestRef(drafts)
  const currentEntry =
    currentPromptDraftKey == null ? null : getPromptDraftEntry(drafts, currentPromptDraftKey)

  const setPromptDraft = useCallback(
    (value: string) => {
      if (currentPromptDraftKey == null) {
        return
      }

      setDrafts((current) =>
        setPromptDraftEntryValue(current, currentPromptDraftKey, value),
      )
    },
    [currentPromptDraftKey],
  )

  const clearPromptDraft = useCallback((key: string | null) => {
    if (key == null) {
      return
    }

    setDrafts((current) => setPromptDraftEntryValue(current, key, ''))
  }, [])

  const movePromptDraft = useCallback((fromKey: string | null, toKey: string | null) => {
    setDrafts((current) => movePromptDraftEntry(current, fromKey, toKey))
  }, [])

  const setPromptDraftPending = useCallback(
    (key: string | null, isPending: boolean) => {
      if (key == null) {
        return
      }

      setDrafts((current) => setPromptDraftEntryPending(current, key, isPending))
    },
    [],
  )

  return {
    clearPromptDraft,
    draftsRef,
    isSendingPrompt: currentEntry?.isPending ?? false,
    movePromptDraft,
    promptDraft: currentEntry?.value ?? '',
    setPromptDraft,
    setPromptDraftPending,
  }
}
