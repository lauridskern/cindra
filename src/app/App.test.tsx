import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatEventEnvelope, FollowupRequest } from '../services/desktop/contracts'
import {
  createDesktopClientModule,
  createLegendListModule,
  resetDesktopClientMock,
} from '../test/backendMock'
import {
  createProjectGroup,
  emptyRuntimeStatus,
  openRuntimeStatus,
} from '../test/fixtures'

const desktopClient = vi.hoisted(() => {
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
    getRuntimeStatus: vi.fn(),
    pickWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    listProjects: vi.fn(),
    loadConversation: vi.fn(),
    sendPrompt: vi.fn(),
    respondFollowup: vi.fn(),
    resetChat: vi.fn(),
  }
})

vi.mock('@legendapp/list/react', () => createLegendListModule())
vi.mock('../services/desktop/client', () => createDesktopClientModule(desktopClient))

import App from './App'

describe('App', () => {
  beforeEach(() => {
    resetDesktopClientMock(desktopClient)
    desktopClient.listProjects.mockResolvedValue([])
  })

  it('shows remembered Forge projects on startup without opening a workspace', async () => {
    desktopClient.getRuntimeStatus.mockResolvedValue(emptyRuntimeStatus)
    desktopClient.listProjects.mockResolvedValue([
      createProjectGroup('/tmp/demo', 'demo', [
        {
          conversationId: 'conv-history',
          title: 'Saved Forge thread',
          updatedAt: '2026-04-15T10:00:00Z',
        },
      ]),
    ])

    render(<App />)

    await screen.findByText('demo')
    expect(screen.queryByText('Saved Forge thread')).not.toBeInTheDocument()
    expect(
      screen.getByText(/select a project from the sidebar/i),
    ).toBeInTheDocument()
  })

  it('opens another workspace before loading its conversation', async () => {
    desktopClient.getRuntimeStatus.mockResolvedValue(openRuntimeStatus)
    desktopClient.listProjects.mockResolvedValueOnce([
      createProjectGroup('/tmp/demo', 'demo', []),
      createProjectGroup('/tmp/other-project', 'other-project', [
        {
          conversationId: 'conv-other',
          title: 'Cross-project thread',
          updatedAt: '2026-04-15T09:00:00Z',
        },
      ]),
    ])
    desktopClient.openWorkspace.mockResolvedValue({
      ...openRuntimeStatus,
      workspacePath: '/tmp/other-project',
      workspaceName: 'other-project',
    })
    desktopClient.listProjects.mockResolvedValueOnce([
      createProjectGroup('/tmp/other-project', 'other-project', [
        {
          conversationId: 'conv-other',
          title: 'Cross-project thread',
          updatedAt: '2026-04-15T09:00:00Z',
        },
      ]),
      createProjectGroup('/tmp/demo', 'demo', []),
    ])
    desktopClient.loadConversation.mockResolvedValue({
      conversationId: 'conv-other',
      messages: [],
    })

    render(<App />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'other-project' }),
    )

    await waitFor(() => {
      expect(desktopClient.openWorkspace).toHaveBeenCalledWith('/tmp/other-project')
    })

    fireEvent.click(
      await screen.findByRole('button', { name: /cross-project thread/i }),
    )

    await waitFor(() => {
      expect(desktopClient.loadConversation).toHaveBeenCalledWith('conv-other')
    })
  })

  it('coalesces streamed assistant markdown into one bubble', async () => {
    desktopClient.getRuntimeStatus.mockResolvedValue(openRuntimeStatus)
    desktopClient.sendPrompt.mockResolvedValue({
      requestId: 'req-1',
      conversationId: 'conv-1',
    })

    render(<App />)

    await screen.findAllByText('demo')
    const textarea = await screen.findByLabelText(/prompt/i)
    fireEvent.change(textarea, { target: { value: 'Inspect the repo' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(desktopClient.sendPrompt).toHaveBeenCalled()
    })

    await act(async () => {
      desktopClient.chat.emit({
        requestId: 'req-1',
        conversationId: 'conv-1',
        event: { type: 'assistant_markdown', text: 'Hello' },
      })
      desktopClient.chat.emit({
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
    desktopClient.getRuntimeStatus.mockResolvedValue(openRuntimeStatus)
    desktopClient.respondFollowup.mockResolvedValue(undefined)

    render(<App />)

    await screen.findAllByText('demo')
    await act(async () => {
      desktopClient.followup.emit({
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
      expect(desktopClient.respondFollowup).toHaveBeenCalledWith({
        followupId: 'follow-1',
        cancelled: false,
        selectedOptionIds: ['a'],
      })
    })
  })
})
