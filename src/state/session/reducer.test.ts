import { describe, expect, it } from 'vitest'

import { openRuntimeStatus } from '../../test/fixtures'
import { initialSessionState, sessionReducer } from './reducer'

describe('sessionReducer', () => {
  it('coalesces streamed assistant markdown into a single transcript row', () => {
    const queuedState = sessionReducer(
      {
        ...initialSessionState,
        runtimeStatus: openRuntimeStatus,
      },
      {
        type: 'prompt_queued',
        conversationId: 'conv-1',
        requestId: 'req-1',
        prompt: 'Inspect the repo',
      },
    )

    const afterFirstChunk = sessionReducer(queuedState, {
      type: 'chat_event_received',
      payload: {
        conversationId: 'conv-1',
        requestId: 'req-1',
        event: { type: 'assistant_markdown', text: 'Hello' },
      },
    })

    const afterSecondChunk = sessionReducer(afterFirstChunk, {
      type: 'chat_event_received',
      payload: {
        conversationId: 'conv-1',
        requestId: 'req-1',
        event: { type: 'assistant_markdown', text: ', world' },
      },
    })

    const assistantMessages = afterSecondChunk.transcripts['conv-1'].filter(
      (message) => message.kind === 'assistant',
    )

    expect(assistantMessages).toHaveLength(1)
    expect(assistantMessages[0]).toMatchObject({
      kind: 'assistant',
      text: 'Hello, world',
    })
  })
})
