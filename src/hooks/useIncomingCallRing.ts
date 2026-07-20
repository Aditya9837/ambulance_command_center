import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { startIncomingCallRing, stopIncomingCallRing, unlockCallRing } from '../lib/callRing'
import type { CallSession } from '../types'
import { useWebSocket } from './useWebSocket'

function callFromMessage(msg: Record<string, unknown>): CallSession | null {
  const call = msg.call
  if (!call || typeof call !== 'object') return null
  return call as CallSession
}

const PRIORITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

function sortWaiting(calls: CallSession[]): CallSession[] {
  return [...calls].sort((a, b) => {
    const pr = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0)
    if (pr !== 0) return pr
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function useIncomingCallRing() {
  const [waitingCalls, setWaitingCalls] = useState<CallSession[]>([])
  const dismissedIds = useRef(new Set<number>())

  const syncRing = useCallback((calls: CallSession[]) => {
    if (calls.length > 0) startIncomingCallRing()
    else stopIncomingCallRing()
  }, [])

  const upsertWaiting = useCallback(
    (call: CallSession) => {
      if (call.status !== 'waiting') return
      setWaitingCalls((prev) => {
        const without = prev.filter((c) => c.id !== call.id)
        const next = sortWaiting([...without, call])
        syncRing(next)
        return next
      })
    },
    [syncRing],
  )

  const removeWaiting = useCallback(
    (callId: number) => {
      dismissedIds.current.delete(callId)
      setWaitingCalls((prev) => {
        const next = prev.filter((c) => c.id !== callId)
        syncRing(next)
        return next
      })
    },
    [syncRing],
  )

  const dismissCall = useCallback((callId: number) => {
    dismissedIds.current.add(callId)
    // Force re-render so popup hides this call; ring continues via waitingCalls.
    setWaitingCalls((prev) => [...prev])
  }, [])

  useEffect(() => {
    const unlock = () => unlockCallRing()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })

    void api.getActiveCalls().then((calls) => {
      const waiting = sortWaiting(calls.filter((c) => c.status === 'waiting'))
      setWaitingCalls(waiting)
      syncRing(waiting)
    })

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      stopIncomingCallRing()
    }
  }, [syncRing])

  const { isConnected } = useWebSocket(
    useCallback(
      (msg) => {
        const type = msg.type as string

        if (type === 'call_created') {
          const call = callFromMessage(msg)
          if (call?.status === 'waiting') {
            dismissedIds.current.delete(call.id)
            upsertWaiting(call)
          }
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
          if (call.status === 'waiting') upsertWaiting(call)
          else removeWaiting(call.id)
        }
      },
      [upsertWaiting, removeWaiting],
    ),
  )

  const visibleCalls = waitingCalls.filter((c) => !dismissedIds.current.has(c.id))

  return { isConnected, waitingCalls: visibleCalls, dismissCall }
}
