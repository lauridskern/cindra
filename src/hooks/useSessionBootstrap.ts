import { useEffect, useEffectEvent, useRef } from 'react'

import * as desktopClient from '../services/desktop/client'
import type { SessionSnapshot } from '../services/desktop/contracts'

interface UseSessionBootstrapOptions {
  setSessionSnapshot: (snapshot: SessionSnapshot) => void
}

export function useSessionBootstrap({ setSessionSnapshot }: UseSessionBootstrapOptions) {
  const mountedRef = useRef<boolean>(true)
  const receivedSessionUpdateRef = useRef<boolean>(false)
  const handleSessionUpdate = useEffectEvent((payload: SessionSnapshot) => {
    receivedSessionUpdateRef.current = true
    setSessionSnapshot(payload)
  })

  useEffect(() => {
    mountedRef.current = true
    receivedSessionUpdateRef.current = false
    let stopListening: (() => void) | null = null
    const isMounted = () => mountedRef.current

    void (async () => {
      try {
        const cleanup = await desktopClient.listenSessionUpdates((payload) => {
          handleSessionUpdate(payload)
        })

        if (isMounted() === false) {
          cleanup()
          return
        }

        stopListening = cleanup

        const snapshot = await desktopClient.getSessionSnapshot()
        if (isMounted() === false) {
          return
        }
        if (receivedSessionUpdateRef.current) {
          return
        }

        setSessionSnapshot(snapshot)
      } catch {
        if (isMounted() === false) {
          return
        }
      }
    })()

    return () => {
      mountedRef.current = false
      stopListening?.()
    }
  }, [setSessionSnapshot])
}
