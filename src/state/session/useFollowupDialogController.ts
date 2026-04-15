import { useAtomValue, useSetAtom } from 'jotai'

import {
  followupRequestAtom,
  followupTextAtom,
  selectedOptionIdsAtom,
} from './atoms'
import { useSessionActions } from './useSessionActions'

export function useFollowupDialogController() {
  const followupRequest = useAtomValue(followupRequestAtom)
  const followupText = useAtomValue(followupTextAtom)
  const selectedOptionIds = useAtomValue(selectedOptionIdsAtom)
  const setFollowupText = useSetAtom(followupTextAtom)
  const { submitFollowup, toggleFollowupOption } = useSessionActions()

  return {
    followupRequest,
    followupText,
    selectedOptionIds,
    setFollowupText,
    submitFollowup,
    toggleFollowupOption,
  }
}
