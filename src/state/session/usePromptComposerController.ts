import { useAtomValue, useSetAtom } from 'jotai'

import {
  canComposeAtom,
  isBusyAtom,
  promptInputAtom,
} from './atoms'
import { useSessionActions } from './useSessionActions'

export function usePromptComposerController() {
  const canCompose = useAtomValue(canComposeAtom)
  const isBusy = useAtomValue(isBusyAtom)
  const promptInput = useAtomValue(promptInputAtom)
  const setPromptInput = useSetAtom(promptInputAtom)
  const { submitPrompt } = useSessionActions()

  return {
    canCompose,
    isBusy,
    promptInput,
    setPromptInput,
    submitPrompt,
  }
}
