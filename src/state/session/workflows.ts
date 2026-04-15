import type { Dispatch } from 'react'

import type * as desktopClient from '../../services/desktop/client'
import type { AppState, SessionAction } from './reducer'
import { formatError } from '../../lib/errors'
import type { FollowupResponse } from '../../services/desktop/contracts'

type DesktopClient = Pick<
  typeof desktopClient,
  | 'getRuntimeStatus'
  | 'listProjects'
  | 'loadConversation'
  | 'openWorkspace'
  | 'resetChat'
  | 'respondFollowup'
  | 'sendPrompt'
>

interface WorkflowContext {
  client: DesktopClient
  dispatch: Dispatch<SessionAction>
}

interface ProjectWorkflowContext extends WorkflowContext {
  sessionState: AppState
  ensureProjectExpanded: (workspacePath: string) => void
  toggleProjectExpanded: (workspacePath: string) => void
  setIsOpeningProject: (value: boolean) => void
}

interface PromptWorkflowContext extends WorkflowContext {
  sessionState: AppState
  isSubmitting: boolean
  clearPromptInput: () => void
  setIsSubmitting: (value: boolean) => void
}

interface FollowupWorkflowContext extends WorkflowContext {
  sessionState: AppState
  followupText: string
  selectedOptionIds: string[]
}

function dispatchUiError(
  dispatch: Dispatch<SessionAction>,
  error: unknown,
): void {
  dispatch({ type: 'ui_error', message: formatError(error) })
}

async function refreshProjects(context: WorkflowContext) {
  const projects = await context.client.listProjects()
  context.dispatch({ type: 'projects_loaded', items: projects })
}

async function openProjectAndRefresh(
  context: WorkflowContext,
  workspacePath: string,
) {
  const status = await context.client.openWorkspace(workspacePath)
  context.dispatch({ type: 'workspace_opened', status })
  await refreshProjects(context)
}

export async function bootstrapSession(context: WorkflowContext) {
  const status = await context.client.getRuntimeStatus()
  context.dispatch({ type: 'runtime_status_loaded', status })
  await refreshProjects(context)
}

export async function openProject(
  context: ProjectWorkflowContext,
  workspacePath: string,
) {
  if (context.sessionState.runtimeStatus?.workspacePath === workspacePath) {
    context.toggleProjectExpanded(workspacePath)
    return
  }

  context.setIsOpeningProject(true)

  try {
    await openProjectAndRefresh(context, workspacePath)
    context.ensureProjectExpanded(workspacePath)
  } catch (error) {
    dispatchUiError(context.dispatch, error)
  } finally {
    context.setIsOpeningProject(false)
  }
}

export async function selectConversation(
  context: ProjectWorkflowContext,
  workspacePath: string,
  conversationId: string,
) {
  const shouldOpenProject =
    context.sessionState.runtimeStatus?.workspacePath !== workspacePath

  context.ensureProjectExpanded(workspacePath)

  if (shouldOpenProject === true) {
    context.setIsOpeningProject(true)
  }

  try {
    if (shouldOpenProject === true) {
      await openProjectAndRefresh(context, workspacePath)
    }

    if (
      shouldOpenProject === true ||
      context.sessionState.transcripts[conversationId] == null
    ) {
      const transcript = await context.client.loadConversation(conversationId)
      context.dispatch({ type: 'conversation_loaded', item: transcript })
      return
    }

    context.dispatch({ type: 'conversation_selected', conversationId })
  } catch (error) {
    dispatchUiError(context.dispatch, error)
  } finally {
    if (shouldOpenProject === true) {
      context.setIsOpeningProject(false)
    }
  }
}

export async function startNewChat(
  context: ProjectWorkflowContext,
  workspacePath?: string,
) {
  const targetWorkspacePath =
    workspacePath ?? context.sessionState.runtimeStatus?.workspacePath

  if (targetWorkspacePath == null) {
    return
  }

  const shouldOpenProject =
    context.sessionState.runtimeStatus?.workspacePath !== targetWorkspacePath

  if (
    shouldOpenProject === false &&
    context.sessionState.activeRequestId != null
  ) {
    return
  }

  if (shouldOpenProject === true) {
    context.setIsOpeningProject(true)
  }

  try {
    if (shouldOpenProject === true) {
      await openProjectAndRefresh(context, targetWorkspacePath)
    }

    const result = await context.client.resetChat()
    context.ensureProjectExpanded(targetWorkspacePath)
    context.dispatch({ type: 'chat_reset', conversationId: result.conversationId })
  } catch (error) {
    dispatchUiError(context.dispatch, error)
  } finally {
    if (shouldOpenProject === true) {
      context.setIsOpeningProject(false)
    }
  }
}

export async function submitPrompt(
  context: PromptWorkflowContext,
  prompt: string,
) {
  const trimmedPrompt = prompt.trim()
  const runtimeStatus = context.sessionState.runtimeStatus
  const hasWorkspace = runtimeStatus?.workspacePath != null
  const canCompose =
    hasWorkspace &&
    runtimeStatus?.configured === true &&
    context.sessionState.activeRequestId === null &&
    context.isSubmitting === false

  if (trimmedPrompt === '' || canCompose === false) {
    return
  }

  context.setIsSubmitting(true)

  try {
    const result = await context.client.sendPrompt({
      prompt: trimmedPrompt,
      conversationId: context.sessionState.currentConversationId ?? undefined,
    })

    context.dispatch({
      type: 'prompt_queued',
      conversationId: result.conversationId,
      requestId: result.requestId,
      prompt: trimmedPrompt,
    })
    context.clearPromptInput()
  } catch (error) {
    dispatchUiError(context.dispatch, error)
  } finally {
    context.setIsSubmitting(false)
  }
}

export async function submitFollowup(
  context: FollowupWorkflowContext,
  cancelled: boolean,
) {
  const followupRequest = context.sessionState.followup
  if (followupRequest == null) {
    return
  }

  const response: FollowupResponse = {
    followupId: followupRequest.followupId,
    cancelled,
  }

  if (cancelled === false) {
    if (followupRequest.kind === 'text') {
      response.text = context.followupText
    } else {
      response.selectedOptionIds = context.selectedOptionIds
    }
  }

  try {
    await context.client.respondFollowup(response)
    context.dispatch({ type: 'followup_cleared' })
  } catch (error) {
    dispatchUiError(context.dispatch, error)
  }
}
