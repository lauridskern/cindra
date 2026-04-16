import { useEffect, useEffectEvent, type Dispatch } from 'react'

import * as desktopClient from '../services/desktop/client'
import type { ChatEventEnvelope, FollowupRequest } from '../services/desktop/contracts'
import type { SessionAction } from '../app/sessionReducer'
import { formatError } from '../utils/errors'

interface UseSessionBootstrapOptions {
  dispatch: Dispatch<SessionAction>
}

export function useSessionBootstrap({ dispatch }: UseSessionBootstrapOptions) {
  const handleChatEvent = useEffectEvent((payload: ChatEventEnvelope) => {
    dispatch({ type: 'chat_event_received', payload })
  })

  const handleFollowupEvent = useEffectEvent((payload: FollowupRequest) => {
    dispatch({ type: 'followup_received', payload })
  })

  useEffect(() => {
    let mounted = true
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

        if (!mounted) {
          chatCleanup()
          followupCleanup()
          return
        }

        stopChat = chatCleanup
        stopFollowups = followupCleanup

        const status = await desktopClient.getRuntimeStatus()
        dispatch({ type: 'runtime_status_loaded', status })

        const projects = await desktopClient.listProjects()
        dispatch({ type: 'projects_loaded', items: projects })
      } catch (error) {
        if (mounted) {
          dispatch({ type: 'ui_error', message: formatError(error) })
        }
      }
    })()

    return () => {
      mounted = false
      stopChat?.()
      stopFollowups?.()
    }
  }, [dispatch])
}
