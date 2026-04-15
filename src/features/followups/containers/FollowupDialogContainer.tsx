import { FollowupDialog } from '../components/FollowupDialog'
import { useFollowupDialogController } from '../../../state/session/useFollowupDialogController'

export function FollowupDialogContainer() {
  const {
    followupRequest,
    followupText,
    selectedOptionIds,
    setFollowupText,
    submitFollowup,
    toggleFollowupOption,
  } = useFollowupDialogController()

  return (
    <FollowupDialog
      followupRequest={followupRequest}
      followupText={followupText}
      selectedOptionIds={selectedOptionIds}
      onTextChange={setFollowupText}
      onToggleOption={toggleFollowupOption}
      onCancel={() => void submitFollowup(true)}
      onContinue={() => void submitFollowup(false)}
    />
  )
}
