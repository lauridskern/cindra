import { useEffect, useEffectEvent } from 'react'
import { useSetAtom } from 'jotai'

import * as desktopClient from '../../services/desktop/client'
import type {
  ChatEventEnvelope,
  FollowupRequest,
} from '../../services/desktop/contracts'
import { formatError } from '../../lib/errors'
import {
  followupTextAtom,
  selectedOptionIdsAtom,
  sessionStateAtom,
} from './atoms'
import { bootstrapSession } from './workflows'

export function useSessionBootstrap() {
  const dispatchSession = useSetAtom(sessionStateAtom)
  const setFollowupText = useSetAtom(followupTextAtom)
  const setSelectedOptionIds = useSetAtom(selectedOptionIdsAtom)

  const handleChatEvent = useEffectEvent((payload: ChatEventEnvelope) => {
    dispatchSession({ type: 'chat_event_received', payload })
  })

  const handleFollowupEvent = useEffectEvent((payload: FollowupRequest) => {
    setFollowupText('')
    setSelectedOptionIds([])
    dispatchSession({ type: 'followup_received', payload })
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
        await bootstrapSession({
          client: desktopClient,
          dispatch: dispatchSession,
        })
      } catch (error) {
        if (mounted) {
          dispatchSession({ type: 'ui_error', message: formatError(error) })
        }
      }
    })()

    return () => {
      mounted = false
      stopChat?.()
      stopFollowups?.()
    }
  }, [dispatchSession])
}
