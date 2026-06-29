import { useCallback, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { startIncomingCallRing, stopIncomingCallRing, unlockCallRing } from '../lib/callRing'
import type { CallSession } from '../types'
import { useWebSocket } from './useWebSocket'

function callFromMessage(msg: Record<string, unknown>): CallSession | null {
  const call = msg.call
  if (!call || typeof call !== 'object') return null
  return call as CallSession
}

export function useIncomingCallRing() {
  const waitingIds = useRef(new Set<number>())

  const syncRing = useCallback(() => {
    if (waitingIds.current.size > 0) startIncomingCallRing()
    else stopIncomingCallRing()
  }, [])

  const removeWaiting = useCallback(
    (callId: number) => {
      waitingIds.current.delete(callId)
      syncRing()
    },
    [syncRing],
  )

  const addWaiting = useCallback(
    (callId: number) => {
      waitingIds.current.add(callId)
      syncRing()
    },
    [syncRing],
  )

  useEffect(() => {
    const unlock = () => unlockCallRing()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })

    void api.getActiveCalls().then((calls) => {
      for (const call of calls) {
        if (call.status === 'waiting') waitingIds.current.add(call.id)
      }
      syncRing()
    })

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      stopIncomingCallRing()
    }
  }, [syncRing])

  useWebSocket(
    useCallback(
      (msg) => {
        const type = msg.type as string

        if (type === 'call_created') {
          const call = callFromMessage(msg)
          if (call?.status === 'waiting') addWaiting(call.id)
          return
        }

        if (type === 'call_accepted' || type === 'call_ended') {
          const call = callFromMessage(msg)
          if (call?.id) removeWaiting(call.id)
          return
        }

        if (type === 'call_updated') {
          const call = callFromMessage(msg)
          if (!call?.id) return
          if (call.status === 'waiting') addWaiting(call.id)
          else removeWaiting(call.id)
        }
      },
      [addWaiting, removeWaiting],
    ),
  )
}
