import {
  startTransition,
  type FormEvent,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useState,
} from 'react'

import {
  getRuntimeStatus,
  listProjects,
  loadConversation,
  listenChatEvents,
  listenFollowupRequests,
  openWorkspace,
  pickWorkspace,
  resetChat,
  respondFollowup,
  sendPrompt,
} from './backend'
import type {
  ChatEventEnvelope,
  FollowupRequest,
  FollowupResponse,
} from './contracts'
import { appReducer, initialState } from './reducer'
import {
  getMainTitle,
  getProjectSummaries,
  getVisibleMessages,
} from './selectors'
import { formatError } from './ui'

export function useAppController() {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const [prompt, setPrompt] = useState('')
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [followupText, setFollowupText] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedProjects, setExpandedProjects] = useState<string[]>([])

  const handleChatEvent = useEffectEvent((payload: ChatEventEnvelope) => {
    dispatch({ type: 'chat_event_received', payload })
  })

  const handleFollowupEvent = useEffectEvent((payload: FollowupRequest) => {
    dispatch({ type: 'followup_received', payload })
  })

  async function refreshProjects() {
    const items = await listProjects()
    startTransition(() => {
      dispatch({ type: 'project_history_loaded', items })
    })
  }

  async function openWorkspaceAndRefresh(workspacePath: string) {
    const status = await openWorkspace(workspacePath)
    dispatch({ type: 'workspace_opened', status })
    await refreshProjects()
    return status
  }

  useEffect(() => {
    let mounted = true
    let stopChat: (() => void) | null = null
    let stopFollowups: (() => void) | null = null

    void (async () => {
      try {
        const [status, chatCleanup, followupCleanup] = await Promise.all([
          getRuntimeStatus(),
          listenChatEvents((payload) => {
            handleChatEvent(payload)
          }),
          listenFollowupRequests((payload) => {
            handleFollowupEvent(payload)
          }),
        ])

        if (!mounted) {
          chatCleanup()
          followupCleanup()
          return
        }

        stopChat = chatCleanup
        stopFollowups = followupCleanup
        dispatch({ type: 'runtime_status_loaded', status })
        await refreshProjects()
      } catch (error) {
        if (mounted) {
          dispatch({ type: 'runtime_error', message: formatError(error) })
        }
      }
    })()

    return () => {
      mounted = false
      stopChat?.()
      stopFollowups?.()
    }
  }, [])

  useEffect(() => {
    if (!state.followup) {
      setFollowupText('')
      setSelectedIds([])
      return
    }

    setFollowupText('')
    setSelectedIds([])
  }, [state.followup])

  const visibleMessages = useMemo(() => getVisibleMessages(state), [state])
  const projectSummaries = useMemo(() => getProjectSummaries(state), [state])
  const mainTitle = useMemo(() => getMainTitle(state), [state])

  const runtimeStatus = state.runtimeStatus
  const followup = state.followup
  const hasCurrentWorkspace = Boolean(runtimeStatus?.workspacePath)
  const isBusy = state.activeRequestId !== null
  const canCompose =
    hasCurrentWorkspace &&
    runtimeStatus?.configured === true &&
    !isBusy &&
    !isSubmitting

  async function handlePickWorkspace() {
    setIsOpeningWorkspace(true)

    try {
      const selectedPath = await pickWorkspace()
      if (!selectedPath) {
        return
      }

      await openWorkspaceAndRefresh(selectedPath)
    } catch (error) {
      dispatch({ type: 'runtime_error', message: formatError(error) })
    } finally {
      setIsOpeningWorkspace(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt || !canCompose) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await sendPrompt({
        prompt: trimmedPrompt,
        conversationId: state.currentConversationId ?? undefined,
      })

      dispatch({
        type: 'prompt_queued',
        conversationId: result.conversationId,
        requestId: result.requestId,
        prompt: trimmedPrompt,
      })
      setPrompt('')
    } catch (error) {
      dispatch({ type: 'runtime_error', message: formatError(error) })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetChat() {
    if (!runtimeStatus?.workspacePath || isBusy) {
      return
    }

    const workspacePath = runtimeStatus.workspacePath

    try {
      const result = await resetChat()
      setExpandedProjects((current) =>
        current.includes(workspacePath) ? current : [...current, workspacePath],
      )
      dispatch({ type: 'chat_reset', conversationId: result.conversationId })
    } catch (error) {
      dispatch({ type: 'runtime_error', message: formatError(error) })
    }
  }

  async function handleSelectConversation(
    workspacePath: string,
    conversationId: string,
  ) {
    const isCrossWorkspace = runtimeStatus?.workspacePath !== workspacePath
    setExpandedProjects((current) =>
      current.includes(workspacePath) ? current : [...current, workspacePath],
    )

    try {
      if (isCrossWorkspace) {
        setIsOpeningWorkspace(true)
        await openWorkspaceAndRefresh(workspacePath)
      }

      if (isCrossWorkspace || !state.transcripts[conversationId]) {
        const item = await loadConversation(conversationId)
        startTransition(() => {
          dispatch({ type: 'conversation_loaded', item })
        })
        return
      }

      startTransition(() => {
        dispatch({ type: 'conversation_selected', conversationId })
      })
    } catch (error) {
      dispatch({ type: 'runtime_error', message: formatError(error) })
    } finally {
      if (isCrossWorkspace) {
        setIsOpeningWorkspace(false)
      }
    }
  }

  async function handleSelectProject(workspacePath: string) {
    if (runtimeStatus?.workspacePath === workspacePath) {
      setExpandedProjects((current) =>
        current.includes(workspacePath)
          ? current.filter((path) => path !== workspacePath)
          : [...current, workspacePath],
      )
      return
    }

    setIsOpeningWorkspace(true)

    try {
      await openWorkspaceAndRefresh(workspacePath)
      setExpandedProjects((current) =>
        current.includes(workspacePath) ? current : [...current, workspacePath],
      )
    } catch (error) {
      dispatch({ type: 'runtime_error', message: formatError(error) })
    } finally {
      setIsOpeningWorkspace(false)
    }
  }

  async function handleProjectNewChat(workspacePath: string) {
    const isCrossWorkspace = runtimeStatus?.workspacePath !== workspacePath
    if (!isCrossWorkspace && isBusy) {
      return
    }

    try {
      if (isCrossWorkspace) {
        setIsOpeningWorkspace(true)
        await openWorkspaceAndRefresh(workspacePath)
      }

      const result = await resetChat()
      setExpandedProjects((current) =>
        current.includes(workspacePath) ? current : [...current, workspacePath],
      )
      dispatch({ type: 'chat_reset', conversationId: result.conversationId })
    } catch (error) {
      dispatch({ type: 'runtime_error', message: formatError(error) })
    } finally {
      if (isCrossWorkspace) {
        setIsOpeningWorkspace(false)
      }
    }
  }

  function toggleFollowupOption(optionId: string) {
    if (!followup) {
      return
    }

    if (followup.kind === 'single') {
      setSelectedIds([optionId])
      return
    }

    setSelectedIds((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    )
  }

  async function submitFollowup(cancelled: boolean) {
    if (!followup) {
      return
    }

    const response: FollowupResponse = {
      followupId: followup.followupId,
      cancelled,
    }

    if (!cancelled) {
      if (followup.kind === 'text') {
        response.text = followupText
      } else {
        response.selectedOptionIds = selectedIds
      }
    }

    try {
      await respondFollowup(response)
      dispatch({ type: 'followup_cleared' })
    } catch (error) {
      dispatch({ type: 'runtime_error', message: formatError(error) })
    }
  }

  return {
    bootError: state.bootError,
    canCompose,
    expandedProjects,
    followup,
    followupText,
    hasCurrentWorkspace,
    isBusy,
    isOpeningWorkspace,
    mainTitle,
    projectSummaries,
    prompt,
    runtimeStatus,
    selectedIds,
    visibleMessages,
    handlePickWorkspace,
    handleProjectNewChat,
    handleResetChat,
    handleSelectConversation,
    handleSelectProject,
    handleSubmit,
    setFollowupText,
    setPrompt,
    submitFollowup,
    toggleFollowupOption,
  }
}
