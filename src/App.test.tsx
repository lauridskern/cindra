import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@legendapp/list/react', () => ({
  LegendList: ({
    data,
    renderItem,
    ListEmptyComponent,
  }: {
    data: unknown[]
    renderItem: (props: { item: unknown; index: number }) => ReactNode
    ListEmptyComponent?: ReactNode
  }) => (
    <div data-testid="legend-list">
      {data.length === 0
        ? ListEmptyComponent ?? null
        : data.map((item, index) => (
            <div key={index}>{renderItem({ item, index })}</div>
          ))}
    </div>
  ),
}))

import App from './App'
import type {
  ChatEventEnvelope,
  ConversationTranscript,
  FollowupRequest,
  ProjectConversationGroup,
  RuntimeStatus,
  SendPromptResult,
} from './app/contracts'

const backend = vi.hoisted(() => {
  let chatHandler: ((payload: ChatEventEnvelope) => void) | null = null
  let followupHandler: ((payload: FollowupRequest) => void) | null = null

  return {
    chat: {
      emit(payload: ChatEventEnvelope) {
        chatHandler?.(payload)
      },
      set(handler: ((payload: ChatEventEnvelope) => void) | null) {
        chatHandler = handler
      },
    },
    followup: {
      emit(payload: FollowupRequest) {
        followupHandler?.(payload)
      },
      set(handler: ((payload: FollowupRequest) => void) | null) {
        followupHandler = handler
      },
    },
    getRuntimeStatus: vi.fn<() => Promise<RuntimeStatus>>(),
    pickWorkspace: vi.fn<() => Promise<string | null>>(),
    openWorkspace: vi.fn<(path: string) => Promise<RuntimeStatus>>(),
    listProjects: vi.fn<() => Promise<ProjectConversationGroup[]>>(),
    loadConversation: vi.fn<(conversationId: string) => Promise<ConversationTranscript>>(),
    sendPrompt: vi.fn<
      (input: { prompt: string; conversationId?: string }) => Promise<SendPromptResult>
    >(),
    respondFollowup: vi.fn<(response: unknown) => Promise<void>>(),
    resetChat: vi.fn<() => Promise<{ conversationId: string }>>(),
  }
})

vi.mock('./app/backend', () => ({
  getRuntimeStatus: backend.getRuntimeStatus,
  pickWorkspace: backend.pickWorkspace,
  openWorkspace: backend.openWorkspace,
  listProjects: backend.listProjects,
  loadConversation: backend.loadConversation,
  sendPrompt: backend.sendPrompt,
  respondFollowup: backend.respondFollowup,
  resetChat: backend.resetChat,
  listenChatEvents: async (
    handler: (payload: ChatEventEnvelope) => void,
  ) => {
    backend.chat.set(handler)
    return () => backend.chat.set(null)
  },
  listenFollowupRequests: async (
    handler: (payload: FollowupRequest) => void,
  ) => {
    backend.followup.set(handler)
    return () => backend.followup.set(null)
  },
}))

const emptyStatus: RuntimeStatus = {
  workspacePath: null,
  workspaceName: null,
  configured: true,
  configurationError: null,
}

const openStatus: RuntimeStatus = {
  workspacePath: '/tmp/demo',
  workspaceName: 'demo',
  configured: true,
  configurationError: null,
}

describe('App', () => {
  beforeEach(() => {
    backend.chat.set(null)
    backend.followup.set(null)
    backend.getRuntimeStatus.mockReset()
    backend.pickWorkspace.mockReset()
    backend.openWorkspace.mockReset()
    backend.listProjects.mockReset()
    backend.loadConversation.mockReset()
    backend.sendPrompt.mockReset()
    backend.respondFollowup.mockReset()
    backend.resetChat.mockReset()
    backend.listProjects.mockResolvedValue([])
  })

  it('shows forge projects on startup without an open workspace', async () => {
    backend.getRuntimeStatus.mockResolvedValue(emptyStatus)
    backend.listProjects.mockResolvedValue([
      {
        workspacePath: '/tmp/demo',
        workspaceName: 'demo',
        conversations: [
          {
            conversationId: 'conv-history',
            title: 'Saved Forge thread',
            updatedAt: '2026-04-15T10:00:00Z',
          },
        ],
      },
    ])

    render(<App />)

    await screen.findByText('demo')
    expect(screen.queryByText('Saved Forge thread')).not.toBeInTheDocument()
    expect(
      screen.getByText(/select a project from the sidebar/i),
    ).toBeInTheDocument()
  })

  it('loads forge history into collapsed project groups on startup', async () => {
    backend.getRuntimeStatus.mockResolvedValue(openStatus)
    backend.listProjects.mockResolvedValue([
      {
        workspacePath: '/tmp/demo',
        workspaceName: 'demo',
        conversations: [
          {
            conversationId: 'conv-history',
            title: 'Saved Forge thread',
            updatedAt: '2026-04-15T10:00:00Z',
          },
        ],
      },
    ])

    render(<App />)

    expect(screen.queryByText('Saved Forge thread')).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'demo' }))
    await screen.findByText('Saved Forge thread')
    expect(backend.listProjects).toHaveBeenCalled()
  })

  it('preserves the forge title after loading a historical conversation', async () => {
    backend.getRuntimeStatus.mockResolvedValue(openStatus)
    backend.listProjects.mockResolvedValue([
      {
        workspacePath: '/tmp/demo',
        workspaceName: 'demo',
        conversations: [
          {
            conversationId: 'conv-history',
            title: 'Basic Test Prompt',
            updatedAt: '2026-04-15T10:00:00Z',
          },
        ],
      },
    ])
    backend.loadConversation.mockResolvedValue({
      conversationId: 'conv-history',
      messages: [
        {
          id: 'history-user:0',
          kind: 'user',
          requestId: 'history:conv-history',
          text: '<task>test</task> <system_date>2026-04-15</system_date>',
        },
      ],
    })

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'demo' }))
    fireEvent.click(
      await screen.findByRole('button', { name: /Basic Test Prompt/i }),
    )

    await waitFor(() => {
      expect(backend.loadConversation).toHaveBeenCalledWith('conv-history')
    })

    expect(
      screen.getByRole('button', { name: /Basic Test Prompt/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /<task>test<\/task>/i,
      }),
    ).not.toBeInTheDocument()
  })

  it('switches workspace before loading a thread from another forge project', async () => {
    backend.getRuntimeStatus.mockResolvedValue(openStatus)
    backend.listProjects.mockResolvedValueOnce([
      {
        workspacePath: '/tmp/demo',
        workspaceName: 'demo',
        conversations: [],
      },
      {
        workspacePath: '/tmp/other-project',
        workspaceName: 'other-project',
        conversations: [
          {
            conversationId: 'conv-other',
            title: 'Cross-project thread',
            updatedAt: '2026-04-15T09:00:00Z',
          },
        ],
      },
    ])
    backend.openWorkspace.mockResolvedValue({
      ...openStatus,
      workspacePath: '/tmp/other-project',
      workspaceName: 'other-project',
    })
    backend.listProjects.mockResolvedValueOnce([
      {
        workspacePath: '/tmp/other-project',
        workspaceName: 'other-project',
        conversations: [
          {
            conversationId: 'conv-other',
            title: 'Cross-project thread',
            updatedAt: '2026-04-15T09:00:00Z',
          },
        ],
      },
      {
        workspacePath: '/tmp/demo',
        workspaceName: 'demo',
        conversations: [],
      },
    ])
    backend.loadConversation.mockResolvedValue({
      conversationId: 'conv-other',
      messages: [],
    })

    render(<App />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'other-project' }),
    )

    await waitFor(() => {
      expect(backend.openWorkspace).toHaveBeenCalledWith('/tmp/other-project')
    })

    fireEvent.click(
      await screen.findByRole('button', { name: /Cross-project thread/i }),
    )

    await waitFor(() => {
      expect(backend.loadConversation).toHaveBeenCalledWith('conv-other')
    })
  })

  it('opens a workspace when clicking a project in the sidebar', async () => {
    backend.getRuntimeStatus.mockResolvedValue(emptyStatus)
    backend.listProjects.mockResolvedValueOnce([
      {
        workspacePath: '/tmp/demo',
        workspaceName: 'demo',
        conversations: [],
      },
    ])
    backend.openWorkspace.mockResolvedValue(openStatus)
    backend.listProjects.mockResolvedValueOnce([
      {
        workspacePath: '/tmp/demo',
        workspaceName: 'demo',
        conversations: [],
      },
    ])

    render(<App />)

    fireEvent.click((await screen.findAllByRole('button', { name: /^demo$/i }))[0])

    await waitFor(() => {
      expect(backend.openWorkspace).toHaveBeenCalledWith('/tmp/demo')
    })
    await screen.findAllByText('demo')
  })

  it('coalesces streamed assistant markdown into one bubble', async () => {
    backend.getRuntimeStatus.mockResolvedValue(openStatus)
    backend.sendPrompt.mockResolvedValue({
      requestId: 'req-1',
      conversationId: 'conv-1',
    })

    render(<App />)

    await screen.findAllByText('demo')
    const textarea = await screen.findByLabelText(/prompt/i)
    fireEvent.change(textarea, { target: { value: 'Inspect the repo' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(backend.sendPrompt).toHaveBeenCalled()
    })

    await act(async () => {
      backend.chat.emit({
        requestId: 'req-1',
        conversationId: 'conv-1',
        event: { type: 'assistant_markdown', text: 'Hello' },
      })
      backend.chat.emit({
        requestId: 'req-1',
        conversationId: 'conv-1',
        event: { type: 'assistant_markdown', text: ', world' },
      })
    })

    const assistantMessages = await screen.findAllByTestId('assistant-message')
    expect(assistantMessages).toHaveLength(1)
    expect(assistantMessages[0]).toHaveTextContent('Hello, world')
  })

  it('submits follow-up selections back to the backend', async () => {
    backend.getRuntimeStatus.mockResolvedValue(openStatus)
    backend.respondFollowup.mockResolvedValue()

    render(<App />)

    await screen.findAllByText('demo')
    await act(async () => {
      backend.followup.emit({
        followupId: 'follow-1',
        kind: 'single',
        question: 'How would you like to proceed?',
        options: [
          { id: 'a', label: 'Accept' },
          { id: 'b', label: 'Reject' },
        ],
      })
    })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByLabelText(/accept/i))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(backend.respondFollowup).toHaveBeenCalledWith({
        followupId: 'follow-1',
        cancelled: false,
        selectedOptionIds: ['a'],
      })
    })
  })

  it('disables the composer while a run is active and re-enables it on completion', async () => {
    backend.getRuntimeStatus.mockResolvedValue(openStatus)
    backend.sendPrompt.mockResolvedValue({
      requestId: 'req-2',
      conversationId: 'conv-2',
    })

    render(<App />)

    await screen.findAllByText('demo')
    const textarea = await screen.findByLabelText(/prompt/i)
    fireEvent.change(textarea, { target: { value: 'Run the agent' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(textarea).toBeDisabled()
    })

    await act(async () => {
      backend.chat.emit({
        requestId: 'req-2',
        conversationId: 'conv-2',
        event: { type: 'complete' },
      })
    })

    await waitFor(() => {
      expect(textarea).not.toBeDisabled()
    })
  })
})
