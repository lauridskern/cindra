import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDesktopClientMock, resetDesktopClientMock } from '../../test/backendMock'
import {
  createProjectGroup,
  openRuntimeStatus,
} from '../../test/fixtures'
import { initialSessionState, type SessionAction } from './reducer'
import {
  selectConversation,
  startNewChat,
  submitPrompt,
} from './workflows'

describe('session workflows', () => {
  const client = createDesktopClientMock()
  const dispatch = vi.fn<(action: SessionAction) => void>()
  const setIsOpeningProject = vi.fn<(value: boolean) => void>()
  const setIsSubmitting = vi.fn<(value: boolean) => void>()
  const clearPromptInput = vi.fn<() => void>()
  let expandedProjectPaths: string[]

  beforeEach(() => {
    resetDesktopClientMock(client)
    dispatch.mockReset()
    setIsOpeningProject.mockReset()
    setIsSubmitting.mockReset()
    clearPromptInput.mockReset()
    expandedProjectPaths = []
    client.listProjects.mockResolvedValue([])
  })

  function ensureProjectExpanded(workspacePath: string) {
    if (!expandedProjectPaths.includes(workspacePath)) {
      expandedProjectPaths.push(workspacePath)
    }
  }

  function toggleProjectExpanded(workspacePath: string) {
    expandedProjectPaths = expandedProjectPaths.includes(workspacePath)
      ? expandedProjectPaths.filter((path) => path !== workspacePath)
      : [...expandedProjectPaths, workspacePath]
  }

  it('opens a different project before loading its conversation', async () => {
    const nextStatus = {
      ...openRuntimeStatus,
      workspacePath: '/tmp/other-project',
      workspaceName: 'other-project',
    }
    const history = [
      createProjectGroup('/tmp/other-project', 'other-project', [
        {
          conversationId: 'conv-other',
          title: 'Cross-project thread',
          updatedAt: '2026-04-15T09:00:00Z',
        },
      ]),
    ]
    const transcript = {
      conversationId: 'conv-other',
      messages: [],
    }

    client.openWorkspace.mockResolvedValue(nextStatus)
    client.listProjects.mockResolvedValue(history)
    client.loadConversation.mockResolvedValue(transcript)

    await selectConversation(
      {
        client,
        dispatch,
        sessionState: {
          ...initialSessionState,
          runtimeStatus: openRuntimeStatus,
        },
        ensureProjectExpanded,
        toggleProjectExpanded,
        setIsOpeningProject,
      },
      '/tmp/other-project',
      'conv-other',
    )

    expect(client.openWorkspace).toHaveBeenCalledWith('/tmp/other-project')
    expect(client.loadConversation).toHaveBeenCalledWith('conv-other')
    expect(expandedProjectPaths).toContain('/tmp/other-project')
    expect(setIsOpeningProject).toHaveBeenNthCalledWith(1, true)
    expect(setIsOpeningProject).toHaveBeenLastCalledWith(false)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'workspace_opened',
      status: nextStatus,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'projects_loaded',
      items: history,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'conversation_loaded',
      item: transcript,
    })
  })

  it('starts a new chat in another project after opening it', async () => {
    const nextStatus = {
      ...openRuntimeStatus,
      workspacePath: '/tmp/other-project',
      workspaceName: 'other-project',
    }

    client.openWorkspace.mockResolvedValue(nextStatus)
    client.resetChat.mockResolvedValue({ conversationId: 'conv-new' })

    await startNewChat(
      {
        client,
        dispatch,
        sessionState: {
          ...initialSessionState,
          runtimeStatus: openRuntimeStatus,
        },
        ensureProjectExpanded,
        toggleProjectExpanded,
        setIsOpeningProject,
      },
      '/tmp/other-project',
    )

    expect(client.openWorkspace).toHaveBeenCalledWith('/tmp/other-project')
    expect(client.resetChat).toHaveBeenCalled()
    expect(expandedProjectPaths).toContain('/tmp/other-project')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'chat_reset',
      conversationId: 'conv-new',
    })
  })

  it('queues a prompt and clears the input after a successful send', async () => {
    client.sendPrompt.mockResolvedValue({
      requestId: 'req-1',
      conversationId: 'conv-1',
    })

    await submitPrompt(
      {
        client,
        dispatch,
        sessionState: {
          ...initialSessionState,
          runtimeStatus: openRuntimeStatus,
        },
        isSubmitting: false,
        clearPromptInput,
        setIsSubmitting,
      },
      'Inspect the repo',
    )

    expect(setIsSubmitting).toHaveBeenNthCalledWith(1, true)
    expect(client.sendPrompt).toHaveBeenCalledWith({
      prompt: 'Inspect the repo',
      conversationId: undefined,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'prompt_queued',
      conversationId: 'conv-1',
      requestId: 'req-1',
      prompt: 'Inspect the repo',
    })
    expect(clearPromptInput).toHaveBeenCalled()
    expect(setIsSubmitting).toHaveBeenLastCalledWith(false)
  })
})
