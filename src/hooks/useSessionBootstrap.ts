import { useEffect, useEffectEvent } from 'react'

import * as desktopClient from '../services/desktop/client'
import type { SessionSnapshot } from '../services/desktop/contracts'

interface UseSessionBootstrapOptions {
  setSessionSnapshot: (snapshot: SessionSnapshot) => void
}

export function useSessionBootstrap({ setSessionSnapshot }: UseSessionBootstrapOptions) {
  const handleSessionUpdate = useEffectEvent((payload: SessionSnapshot) => {
    setSessionSnapshot(payload)
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
      } catch {
        if (!mounted) {
          return
        }
      }
    })()

    return () => {
      mounted = false
      stopListening?.()
    }
  }, [setSessionSnapshot])
}
