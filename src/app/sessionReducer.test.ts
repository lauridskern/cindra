import { describe, expect, it } from 'vitest'

import { openRuntimeStatus } from '../test/fixtures'
import {
  initialSessionState,
  selectEmptyDraftConversationId,
  selectIsConversationRunning,
  sessionReducer,
} from './sessionReducer'

describe('sessionReducer', () => {
  it('coalesces streamed assistant markdown into a single transcript row', () => {
    const queuedState = sessionReducer(
      {
        ...initialSessionState,
        runtimeStatus: openRuntimeStatus,
      },
      {
        type: 'prompt_queued',
        workspacePath: '/tmp/demo',
        originConversationId: null,
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

  it('does not steal the current selection when background chat events arrive', () => {
    const nextState = sessionReducer(
      {
        ...initialSessionState,
        runtimeStatus: openRuntimeStatus,
        currentConversationId: 'conv-visible',
        selectedConversationByWorkspace: {
          '/tmp/demo': 'conv-visible',
        },
      },
      {
        type: 'chat_event_received',
        payload: {
          conversationId: 'conv-background',
          requestId: 'req-2',
          event: { type: 'assistant_markdown', text: 'Still updating in the background' },
        },
      },
    )

    expect(nextState.currentConversationId).toBe('conv-visible')
    expect(nextState.transcripts['conv-background']).toHaveLength(1)
  })

  it('restores the last selected conversation when reopening a workspace', () => {
    const reopenedState = sessionReducer(
      {
        ...initialSessionState,
        runtimeStatus: openRuntimeStatus,
        currentConversationId: 'conv-demo',
        selectedConversationByWorkspace: {
          '/tmp/demo': 'conv-demo',
          '/tmp/other-project': 'conv-other',
        },
      },
      {
        type: 'workspace_opened',
        status: {
          ...openRuntimeStatus,
          workspacePath: '/tmp/other-project',
          workspaceName: 'other-project',
        },
      },
    )

    expect(reopenedState.currentConversationId).toBe('conv-other')
  })

  it('prefers the selected empty draft conversation for a workspace', () => {
    const state = {
      ...initialSessionState,
      projects: [
        {
          workspacePath: '/tmp/demo',
          workspaceName: 'demo',
          conversations: [],
        },
      ],
      transcripts: {
        'conv-older': [],
        'conv-selected': [],
      },
      conversationWorkspaceById: {
        'conv-older': '/tmp/demo',
        'conv-selected': '/tmp/demo',
      },
      selectedConversationByWorkspace: {
        '/tmp/demo': 'conv-selected',
      },
    }

    expect(selectEmptyDraftConversationId(state, '/tmp/demo')).toBe('conv-selected')
  })

  it('tracks running requests independently for each conversation', () => {
    const firstQueuedState = sessionReducer(
      {
        ...initialSessionState,
        runtimeStatus: openRuntimeStatus,
      },
      {
        type: 'prompt_queued',
        workspacePath: '/tmp/demo',
        originConversationId: null,
        conversationId: 'conv-a',
        requestId: 'req-a',
        prompt: 'Run agent A',
      },
    )

    const secondQueuedState = sessionReducer(firstQueuedState, {
      type: 'prompt_queued',
      workspacePath: '/tmp/demo',
      originConversationId: 'conv-b',
      conversationId: 'conv-b',
      requestId: 'req-b',
      prompt: 'Run agent B',
    })

    expect(selectIsConversationRunning(secondQueuedState, 'conv-a')).toBe(true)
    expect(selectIsConversationRunning(secondQueuedState, 'conv-b')).toBe(true)

    const afterFirstCompletion = sessionReducer(secondQueuedState, {
      type: 'chat_event_received',
      payload: {
        conversationId: 'conv-a',
        requestId: 'req-a',
        event: { type: 'complete' },
      },
    })

    expect(selectIsConversationRunning(afterFirstCompletion, 'conv-a')).toBe(false)
    expect(selectIsConversationRunning(afterFirstCompletion, 'conv-b')).toBe(true)
  })
})
