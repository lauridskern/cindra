import type { TranscriptMessage } from '../services/desktop/contracts'

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function deriveConversationTitle(messages: TranscriptMessage[]): string {
  const firstUserMessage = messages.find((message) => message.kind === 'user')
  if (firstUserMessage?.kind === 'user') {
    return collapseWhitespace(firstUserMessage.text).slice(0, 72) || 'New chat'
  }

  const firstAssistantMessage = messages.find(
    (message) => message.kind === 'assistant' || message.kind === 'reasoning',
  )
  if (
    firstAssistantMessage?.kind === 'assistant' ||
    firstAssistantMessage?.kind === 'reasoning'
  ) {
    return collapseWhitespace(firstAssistantMessage.text).slice(0, 72) || 'New chat'
  }

  return 'New chat'
}
