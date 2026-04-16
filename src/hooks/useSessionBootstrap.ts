import { useEffect, useEffectEvent } from 'react'

import * as desktopClient from '../services/desktop/client'
import type { SessionSnapshot } from '../services/desktop/contracts'
import { formatError } from '../utils/errors'

interface UseSessionBootstrapOptions {
  setSessionSnapshot: (snapshot: SessionSnapshot) => void
  setUiError: (message: string | null) => void
}

export function useSessionBootstrap({
  setSessionSnapshot,
  setUiError,
}: UseSessionBootstrapOptions) {
  const handleSessionUpdate = useEffectEvent((payload: SessionSnapshot) => {
    setSessionSnapshot(payload)
    setUiError(null)
  })

  useEffect(() => {
    let mounted = true
    let stopListening: (() => void) | null = null

    void (async () => {
      try {
        const cleanup = await desktopClient.listenSessionUpdates((payload) => {
          handleSessionUpdate(payload)
        })

        if (!mounted) {
          cleanup()
          return
        }

        stopListening = cleanup

        const snapshot = await desktopClient.getSessionSnapshot()
        if (!mounted) {
          return
        }

        setSessionSnapshot(snapshot)
        setUiError(null)
      } catch (error) {
        if (mounted) {
          setUiError(formatError(error))
        }
      }
    })()

    return () => {
      mounted = false
      stopListening?.()
    }
  }, [setSessionSnapshot, setUiError])
}
