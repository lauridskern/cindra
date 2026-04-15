import { PromptComposer } from '../components/PromptComposer'
import { usePromptComposerController } from '../../../state/session/usePromptComposerController'

export function PromptComposerContainer() {
  const {
    canCompose,
    isBusy,
    promptInput,
    setPromptInput,
    submitPrompt,
  } = usePromptComposerController()

  return (
    <PromptComposer
      canCompose={canCompose}
      isBusy={isBusy}
      promptInput={promptInput}
      onPromptInputChange={setPromptInput}
      onSubmit={submitPrompt}
    />
  )
}
