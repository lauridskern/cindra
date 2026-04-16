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

const mockedDesktopClient = vi.hoisted(() => {
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
vi.mock('../services/desktop/client', () =>
  createDesktopClientModule(mockedDesktopClient),
)

import App from './App'

describe('App', () => {
  beforeEach(() => {
    resetDesktopClientMock(mockedDesktopClient)
    mockedDesktopClient.listProjects.mockResolvedValue([])
  })

  async function emitFollowup(payload: FollowupRequest) {
    await act(async () => {
      mockedDesktopClient.followup.emit(payload)
    })
  }

  it('shows remembered projects on startup without opening a workspace', async () => {
    mockedDesktopClient.getRuntimeStatus.mockResolvedValue(emptyRuntimeStatus)
    mockedDesktopClient.listProjects.mockResolvedValue([
      createProjectGroup('/tmp/demo', 'demo', [
        {
          conversationId: 'conv-history',
          title: 'Saved thread',
          updatedAt: '2026-04-15T10:00:00Z',
        },
      ]),
    ])

    render(<App />)

    await screen.findByText('demo')
    expect(screen.queryByText('Saved thread')).not.toBeInTheDocument()
    expect(
      screen.getByText(/select a project from the sidebar/i),
    ).toBeInTheDocument()
  })

  it('opens another workspace before loading its conversation', async () => {
    mockedDesktopClient.getRuntimeStatus.mockResolvedValue(openRuntimeStatus)
    mockedDesktopClient.listProjects.mockResolvedValueOnce([
      createProjectGroup('/tmp/demo', 'demo', []),
      createProjectGroup('/tmp/other-project', 'other-project', [
        {
          conversationId: 'conv-other',
          title: 'Cross-project thread',
          updatedAt: '2026-04-15T09:00:00Z',
        },
      ]),
    ])
    mockedDesktopClient.openWorkspace.mockResolvedValue({
      ...openRuntimeStatus,
      workspacePath: '/tmp/other-project',
      workspaceName: 'other-project',
    })
    mockedDesktopClient.listProjects.mockResolvedValueOnce([
      createProjectGroup('/tmp/other-project', 'other-project', [
        {
          conversationId: 'conv-other',
          title: 'Cross-project thread',
          updatedAt: '2026-04-15T09:00:00Z',
        },
      ]),
      createProjectGroup('/tmp/demo', 'demo', []),
    ])
    mockedDesktopClient.loadConversation.mockResolvedValue({
      conversationId: 'conv-other',
      messages: [],
    })

    render(<App />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'other-project' }),
    )

    await waitFor(() => {
      expect(mockedDesktopClient.openWorkspace).toHaveBeenCalledWith('/tmp/other-project')
    })

    fireEvent.click(
      await screen.findByRole('button', { name: /cross-project thread/i }),
    )

    await waitFor(() => {
      expect(mockedDesktopClient.loadConversation).toHaveBeenCalledWith('conv-other')
    })
  })

  it('coalesces streamed assistant markdown into one bubble', async () => {
    mockedDesktopClient.getRuntimeStatus.mockResolvedValue(openRuntimeStatus)
    mockedDesktopClient.sendPrompt.mockResolvedValue({
      requestId: 'req-1',
      conversationId: 'conv-1',
    })

    render(<App />)

    await screen.findAllByText('demo')
    const textarea = await screen.findByLabelText(/prompt/i)
    fireEvent.change(textarea, { target: { value: 'Inspect the repo' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(mockedDesktopClient.sendPrompt).toHaveBeenCalled()
    })

    await act(async () => {
      mockedDesktopClient.chat.emit({
        requestId: 'req-1',
        conversationId: 'conv-1',
        event: { type: 'assistant_markdown', text: 'Hello' },
      })
      mockedDesktopClient.chat.emit({
        requestId: 'req-1',
        conversationId: 'conv-1',
        event: { type: 'assistant_markdown', text: ', world' },
      })
    })

    const assistantMessages = await screen.findAllByTestId('assistant-message')
    expect(assistantMessages).toHaveLength(1)
    expect(assistantMessages[0]).toHaveTextContent('Hello, world')
  })

  it('preserves prompt drafts when switching between conversations', async () => {
    mockedDesktopClient.getRuntimeStatus.mockResolvedValue(openRuntimeStatus)
    mockedDesktopClient.listProjects.mockResolvedValue([
      createProjectGroup('/tmp/demo', 'demo', [
        {
          conversationId: 'conv-a',
          title: 'First chat',
          updatedAt: '2026-04-15T10:00:00Z',
        },
        {
          conversationId: 'conv-b',
          title: 'Second chat',
          updatedAt: '2026-04-15T09:00:00Z',
        },
      ]),
    ])
    mockedDesktopClient.loadConversation.mockImplementation(async (conversationId) => ({
      conversationId,
      messages: [],
    }))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'demo' }))

    fireEvent.click(await screen.findByRole('button', { name: /first chat/i }))
    await waitFor(() => {
      expect(mockedDesktopClient.loadConversation).toHaveBeenCalledWith('conv-a')
    })

    const textarea = await screen.findByLabelText(/prompt/i)
    fireEvent.change(textarea, { target: { value: 'Draft for the first chat' } })

    fireEvent.click(screen.getByRole('button', { name: /second chat/i }))
    await waitFor(() => {
      expect(mockedDesktopClient.loadConversation).toHaveBeenCalledWith('conv-b')
    })
    await waitFor(() => {
      expect(screen.getByLabelText(/prompt/i)).toHaveValue('')
    })

    fireEvent.change(screen.getByLabelText(/prompt/i), {
      target: { value: 'Draft for the second chat' },
    })

    fireEvent.click(screen.getByRole('button', { name: /first chat/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/prompt/i)).toHaveValue('Draft for the first chat')
    })

    fireEvent.click(screen.getByRole('button', { name: /second chat/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/prompt/i)).toHaveValue('Draft for the second chat')
    })
  })

  it('preserves the selected conversation draft across project switches', async () => {
    mockedDesktopClient.getRuntimeStatus.mockResolvedValue(openRuntimeStatus)
    mockedDesktopClient.listProjects.mockResolvedValue([
      createProjectGroup('/tmp/demo', 'demo', []),
      createProjectGroup('/tmp/other-project', 'other-project', [
        {
          conversationId: 'conv-other',
          title: 'Cross-project thread',
          updatedAt: '2026-04-15T09:00:00Z',
        },
      ]),
    ])
    mockedDesktopClient.openWorkspace.mockImplementation(async (workspacePath) => ({
      ...openRuntimeStatus,
      workspacePath,
      workspaceName: workspacePath.split('/').at(-1) ?? 'workspace',
    }))
    mockedDesktopClient.loadConversation.mockImplementation(async (conversationId) => ({
      conversationId,
      messages: [],
    }))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'other-project' }))
    await waitFor(() => {
      expect(mockedDesktopClient.openWorkspace).toHaveBeenCalledWith('/tmp/other-project')
    })

    fireEvent.click(
      await screen.findByRole('button', { name: /cross-project thread/i }),
    )
    await waitFor(() => {
      expect(mockedDesktopClient.loadConversation).toHaveBeenCalledWith('conv-other')
    })

    fireEvent.change(await screen.findByLabelText(/prompt/i), {
      target: { value: 'Remember this project-specific draft' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'demo' }))
    await waitFor(() => {
      expect(mockedDesktopClient.openWorkspace).toHaveBeenCalledWith('/tmp/demo')
    })
    await waitFor(() => {
      expect(screen.getByLabelText(/prompt/i)).toHaveValue('')
    })

    fireEvent.click(screen.getByRole('button', { name: 'other-project' }))
    await waitFor(() => {
      expect(screen.getByLabelText(/prompt/i)).toHaveValue(
        'Remember this project-specific draft',
      )
    })
  })

  it('allows submitting in another chat while the first submit is still in flight', async () => {
    mockedDesktopClient.getRuntimeStatus.mockResolvedValue(openRuntimeStatus)
    mockedDesktopClient.listProjects.mockResolvedValue([
      createProjectGroup('/tmp/demo', 'demo', [
        {
          conversationId: 'conv-a',
          title: 'First chat',
          updatedAt: '2026-04-15T10:00:00Z',
        },
        {
          conversationId: 'conv-b',
          title: 'Second chat',
          updatedAt: '2026-04-15T09:00:00Z',
        },
      ]),
    ])
    mockedDesktopClient.loadConversation.mockImplementation(async (conversationId) => ({
      conversationId,
      messages: [],
    }))

    let resolveFirstPrompt:
      | ((value: { requestId: string; conversationId: string }) => void)
      | null = null

    mockedDesktopClient.sendPrompt.mockImplementation(async ({ conversationId }) => {
      if (conversationId === 'conv-a') {
        return await new Promise((resolve) => {
          resolveFirstPrompt = resolve
        })
      }

      return {
        requestId: 'req-b',
        conversationId: conversationId ?? 'conv-b',
      }
    })

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'demo' }))

    fireEvent.click(await screen.findByRole('button', { name: /first chat/i }))
    await waitFor(() => {
      expect(mockedDesktopClient.loadConversation).toHaveBeenCalledWith('conv-a')
    })

    fireEvent.change(await screen.findByLabelText(/prompt/i), {
      target: { value: 'Run agent A' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(mockedDesktopClient.sendPrompt).toHaveBeenCalledWith({
        prompt: 'Run agent A',
        conversationId: 'conv-a',
      })
    })

    fireEvent.click(screen.getByRole('button', { name: /second chat/i }))
    await waitFor(() => {
      expect(mockedDesktopClient.loadConversation).toHaveBeenCalledWith('conv-b')
    })

    const secondChatTextarea = await screen.findByLabelText(/prompt/i)
    expect(secondChatTextarea).not.toBeDisabled()

    fireEvent.change(secondChatTextarea, {
      target: { value: 'Run agent B' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(mockedDesktopClient.sendPrompt).toHaveBeenCalledWith({
        prompt: 'Run agent B',
        conversationId: 'conv-b',
      })
    })

    await act(async () => {
      resolveFirstPrompt?.({
        requestId: 'req-a',
        conversationId: 'conv-a',
      })
    })
  })

  it('reuses the existing empty draft chat instead of creating another one', async () => {
    mockedDesktopClient.getRuntimeStatus.mockResolvedValue(openRuntimeStatus)
    mockedDesktopClient.listProjects.mockResolvedValue([
      createProjectGroup('/tmp/demo', 'demo', []),
    ])
    mockedDesktopClient.resetChat.mockResolvedValue({
      conversationId: 'conv-new',
    })

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'demo' }))

    const newChatButton = await screen.findByRole('button', {
      name: /start a new chat in demo/i,
    })

    fireEvent.click(newChatButton)
    await waitFor(() => {
      expect(mockedDesktopClient.resetChat).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(newChatButton)
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockedDesktopClient.resetChat).toHaveBeenCalledTimes(1)
  })

  it('submits follow-up selections back to the backend', async () => {
    mockedDesktopClient.getRuntimeStatus.mockResolvedValue(openRuntimeStatus)
    mockedDesktopClient.respondFollowup.mockResolvedValue(undefined)

    render(<App />)

    await screen.findAllByText('demo')
    await emitFollowup({
      followupId: 'follow-1',
      kind: 'single',
      question: 'How would you like to proceed?',
      options: [
        { id: 'a', label: 'Accept' },
        { id: 'b', label: 'Reject' },
      ],
    })

    await screen.findByText('How would you like to proceed?')
    fireEvent.click(screen.getByLabelText(/accept/i))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(mockedDesktopClient.respondFollowup).toHaveBeenCalledWith({
        followupId: 'follow-1',
        cancelled: false,
        selectedOptionIds: ['a'],
      })
    })
  })

  it('clears previous follow-up selections when a new request arrives', async () => {
    mockedDesktopClient.getRuntimeStatus.mockResolvedValue(openRuntimeStatus)

    render(<App />)

    await screen.findAllByText('demo')
    await emitFollowup({
      followupId: 'follow-1',
      kind: 'single',
      question: 'How would you like to proceed?',
      options: [
        { id: 'a', label: 'Accept' },
        { id: 'b', label: 'Reject' },
      ],
    })

    fireEvent.click(await screen.findByLabelText(/accept/i))
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()

    await emitFollowup({
      followupId: 'follow-2',
      kind: 'single',
      question: 'Pick the next action',
      options: [
        { id: 'c', label: 'Retry' },
        { id: 'd', label: 'Stop' },
      ],
    })

    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })
})
