import {
  LegendList,
  type LegendListRenderItemProps,
} from '@legendapp/list/react'

import type { TranscriptMessage } from '../contracts'
import { TranscriptRow } from './TranscriptRow'

interface TranscriptProps {
  messages: TranscriptMessage[]
}

function getMessageText(message: TranscriptMessage): string {
  switch (message.kind) {
    case 'user':
    case 'assistant':
    case 'reasoning':
    case 'status_output':
      return message.text
    case 'error':
      return message.message
    case 'status':
      return `${message.title} ${message.subtitle ?? ''}`
    case 'tool_start':
      return message.name
    case 'tool_end':
      return `${message.name} ${message.summary ?? ''}`
    default:
      return ''
  }
}

function estimateTranscriptMessageSize(message: TranscriptMessage): number {
  const lineCount = Math.max(1, Math.ceil(getMessageText(message).length / 72))

  switch (message.kind) {
    case 'user':
      return 42 + lineCount * 34
    case 'assistant':
      return 32 + lineCount * 26
    case 'reasoning':
      return 28 + lineCount * 24
    case 'status_output':
      return 36 + lineCount * 18
    default:
      return 28 + lineCount * 22
  }
}

function renderTranscriptItem({
  item,
}: LegendListRenderItemProps<TranscriptMessage>) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-6 pb-4 select-text max-[720px]:px-4">
      <TranscriptRow message={item} />
    </div>
  )
}

export function Transcript({ messages }: TranscriptProps) {
  return (
    <LegendList
      data={messages}
      renderItem={renderTranscriptItem}
      keyExtractor={(item) => item.id}
      getItemType={(item) => item.kind}
      getEstimatedItemSize={estimateTranscriptMessageSize}
      recycleItems
      maintainScrollAtEnd
      maintainScrollAtEndThreshold={0.2}
      maintainVisibleContentPosition
      estimatedItemSize={88}
      style={{ height: '100%' }}
      contentContainerStyle={{ paddingTop: 28, paddingBottom: 20 }}
      ListEmptyComponent={<div className="min-h-px" aria-hidden="true" />}
    />
  )
}
