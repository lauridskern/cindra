import {
  useEffect,
  useEffectEvent,
  useReducer,
  useState,
} from 'react'

import * as desktopClient from '../../services/desktop/client'
import type {
  ChatEventEnvelope,
  FollowupRequest,
} from '../../services/desktop/contracts'
import { sessionReducer, initialSessionState } from './reducer'
import {
  selectActiveWorkspaceLabel,
  selectProjectSummaries,
  selectVisibleMessages,
} from './selectors'
import { formatError } from '../../lib/errors'
import {
  bootstrapSession,
  openProject as openProjectWorkflow,
  selectConversation as selectConversationWorkflow,
  startNewChat as startNewChatWorkflow,
  submitFollowup as submitFollowupWorkflow,
  submitPrompt as submitPromptWorkflow,
} from './workflows'

export function useSessionController() {
  const [sessionState, dispatch] = useReducer(sessionReducer, initialSessionState)
  const [promptInput, setPromptInput] = useState('')
  const [isOpeningProject, setIsOpeningProject] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [followupText, setFollowupText] = useState('')
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([])
  const [expandedProjectPaths, setExpandedProjectPaths] = useState<string[]>([])

  const handleChatEvent = useEffectEvent((payload: ChatEventEnvelope) => {
    dispatch({ type: 'chat_event_received', payload })
  })

  const handleFollowupEvent = useEffectEvent((payload: FollowupRequest) => {
    setFollowupText('')
    setSelectedOptionIds([])
    dispatch({ type: 'followup_received', payload })
  })

  function ensureProjectExpanded(workspacePath: string) {
    setExpandedProjectPaths((current) =>
      current.includes(workspacePath) ? current : [...current, workspacePath],
    )
  }

  function toggleProjectExpanded(workspacePath: string) {
    setExpandedProjectPaths((current) =>
      current.includes(workspacePath)
        ? current.filter((path) => path !== workspacePath)
        : [...current, workspacePath],
    )
  }

  useEffect(() => {
    const lifecycle = { mounted: true }
    let stopChat: (() => void) | null = null
    let stopFollowups: (() => void) | null = null

    void (async () => {
      try {
        const [chatCleanup, followupCleanup] = await Promise.all([
          desktopClient.listenChatEvents((payload) => {
            handleChatEvent(payload)
          }),
          desktopClient.listenFollowupRequests((payload) => {
            handleFollowupEvent(payload)
          }),
        ])

        if (lifecycle.mounted === false) {
          chatCleanup()
          followupCleanup()
          return
        }

        stopChat = chatCleanup
        stopFollowups = followupCleanup
        await bootstrapSession({
          client: desktopClient,
          dispatch,
        })
      } catch (error) {
        if (lifecycle.mounted === true) {
          dispatch({ type: 'ui_error', message: formatError(error) })
        }
      }
    })()

    return () => {
      lifecycle.mounted = false
      stopChat?.()
      stopFollowups?.()
    }
  }, [])

  const visibleMessages = selectVisibleMessages(sessionState)
  const projectSummaries = selectProjectSummaries(sessionState)
  const activeWorkspaceLabel = selectActiveWorkspaceLabel(sessionState)

  const runtimeStatus = sessionState.runtimeStatus
  const followupRequest = sessionState.followup
  const hasCurrentWorkspace = runtimeStatus?.workspacePath != null
  const isBusy = sessionState.activeRequestId != null
  const canCompose =
    hasCurrentWorkspace &&
    runtimeStatus?.configured === true &&
    isBusy === false &&
    isSubmitting === false

  async function openWorkspacePicker() {
    try {
      const selectedPath = await desktopClient.pickWorkspace()
      if (selectedPath == null) {
        return
      }

      await openProjectWorkflow(
        {
          client: desktopClient,
          dispatch,
          sessionState,
          ensureProjectExpanded,
          toggleProjectExpanded,
          setIsOpeningProject,
        },
        selectedPath,
      )
    } catch (error) {
      dispatch({ type: 'ui_error', message: formatError(error) })
    }
  }

  async function submitPrompt() {
    await submitPromptWorkflow(
      {
        client: desktopClient,
        dispatch,
        sessionState,
        isSubmitting,
        clearPromptInput: () => setPromptInput(''),
        setIsSubmitting,
      },
      promptInput,
    )
  }

  async function startNewChat(workspacePath?: string) {
    await startNewChatWorkflow(
      {
        client: desktopClient,
        dispatch,
        sessionState,
        ensureProjectExpanded,
        toggleProjectExpanded,
        setIsOpeningProject,
      },
      workspacePath,
    )
  }

  async function selectConversation(
    workspacePath: string,
    conversationId: string,
  ) {
    await selectConversationWorkflow(
      {
        client: desktopClient,
        dispatch,
        sessionState,
        ensureProjectExpanded,
        toggleProjectExpanded,
        setIsOpeningProject,
      },
      workspacePath,
      conversationId,
    )
  }

  async function openProject(workspacePath: string) {
    await openProjectWorkflow(
      {
        client: desktopClient,
        dispatch,
        sessionState,
        ensureProjectExpanded,
        toggleProjectExpanded,
        setIsOpeningProject,
      },
      workspacePath,
    )
  }

  function toggleFollowupOption(optionId: string) {
    if (followupRequest == null) {
      return
    }

    if (followupRequest.kind === 'single') {
      setSelectedOptionIds([optionId])
      return
    }

    setSelectedOptionIds((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    )
  }

  async function submitFollowup(cancelled: boolean) {
    await submitFollowupWorkflow(
      {
        client: desktopClient,
        dispatch,
        sessionState,
        followupText,
        selectedOptionIds,
      },
      cancelled,
    )
  }

  return {
    activeWorkspaceLabel,
    canCompose,
    expandedProjectPaths,
    followupRequest,
    followupText,
    hasCurrentWorkspace,
    isBusy,
    isOpeningProject,
    projectSummaries,
    promptInput,
    runtimeStatus,
    selectedOptionIds,
    visibleMessages,
    openWorkspacePicker,
    openProject,
    selectConversation,
    setPromptInput,
    startNewChat,
    submitPrompt,
    setFollowupText,
    submitFollowup,
    toggleFollowupOption,
    uiError: sessionState.uiError,
  }
}
