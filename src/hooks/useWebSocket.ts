import { useEffect, useRef, useCallback, useState } from 'react'
import { api } from '../lib/api'
import { buildWebSocketUrl } from '../lib/ws'

type MessageHandler = (data: Record<string, unknown>) => void

const MIN_RECONNECT_MS = 2000
const MAX_RECONNECT_MS = 15000
const MAX_QUEUE = 50
const TOKEN_RETRY_MS = 1000

export function useWebSocket(
  onMessage: MessageHandler,
  enabled = true,
  onReconnect?: () => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const [clientId] = useState(() => `cc-${crypto.randomUUID().slice(0, 8)}`)
  const [authToken, setAuthToken] = useState(() => api.getToken())
  const handlerRef = useRef(onMessage)
  const onReconnectRef = useRef(onReconnect)
  const reconnectMs = useRef(MIN_RECONNECT_MS)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intentionalClose = useRef(false)
  const softReplace = useRef(false)
  const hadConnected = useRef(false)
  const connectGen = useRef(0)
  const queueRef = useRef<string[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    handlerRef.current = onMessage
    onReconnectRef.current = onReconnect
  }, [onMessage, onReconnect])

  useEffect(() => {
    const syncToken = () => {
      const next = api.getToken()
      setAuthToken((prev) => (prev === next ? prev : next))
    }

    syncToken()
    const interval = setInterval(syncToken, TOKEN_RETRY_MS)
    window.addEventListener('focus', syncToken)
    window.addEventListener('storage', syncToken)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', syncToken)
      window.removeEventListener('storage', syncToken)
    }
  }, [])

  const clearReconnect = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
  }

  const connectRef = useRef<() => void>(() => {})

  const scheduleReconnect = useCallback(() => {
    if (intentionalClose.current || !enabled) return
    setIsConnected(false)
    clearReconnect()
    reconnectTimer.current = setTimeout(() => {
      reconnectMs.current = Math.min(reconnectMs.current * 1.5, MAX_RECONNECT_MS)
      connectRef.current()
    }, reconnectMs.current)
  }, [enabled])

  const scheduleTokenRetry = useCallback(() => {
    if (intentionalClose.current || !enabled) return
    clearReconnect()
    reconnectTimer.current = setTimeout(() => connectRef.current(), TOKEN_RETRY_MS)
  }, [enabled])

  const flushQueue = useCallback((ws: WebSocket) => {
    while (queueRef.current.length && ws.readyState === WebSocket.OPEN) {
      ws.send(queueRef.current.shift()!)
    }
  }, [])

  const connect = useCallback(() => {
    if (!enabled) return

    const token = authToken ?? api.getToken()
    const url = buildWebSocketUrl(clientId, token)
    if (!url) {
      scheduleTokenRetry()
      return
    }

    const gen = ++connectGen.current

    if (wsRef.current) {
      // Soft replace (token/effect re-run) — do not treat as network drop.
      softReplace.current = true
      intentionalClose.current = true
      const prev = wsRef.current
      wsRef.current = null
      try {
        prev.close()
      } catch { /* ignore */ }
    }
    intentionalClose.current = false

    const ws = new WebSocket(url)

    ws.onopen = () => {
      if (gen !== connectGen.current) {
        try { ws.close() } catch { /* ignore */ }
        return
      }
      const notifyReconnect = hadConnected.current && !softReplace.current
      softReplace.current = false
      reconnectMs.current = MIN_RECONNECT_MS
      setIsConnected(true)
      flushQueue(ws)
      if (notifyReconnect) {
        onReconnectRef.current?.()
      }
      hadConnected.current = true
    }

    ws.onmessage = (event) => {
      if (gen !== connectGen.current) return
      try {
        handlerRef.current(JSON.parse(event.data))
      } catch { /* ignore */ }
    }

    ws.onerror = () => {
      try { ws.close() } catch { /* ignore */ }
    }

    ws.onclose = (event) => {
      if (wsRef.current === ws) {
        wsRef.current = null
      }
      if (gen !== connectGen.current) return
      setIsConnected(false)
      if (intentionalClose.current || softReplace.current) return
      if (event.code === 4401) {
        api.setToken(null)
        return
      }
      scheduleReconnect()
    }

    wsRef.current = ws
  }, [authToken, clientId, enabled, flushQueue, scheduleReconnect, scheduleTokenRetry])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    if (!enabled) return

    connect()
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
      }
    }, 25000)

    return () => {
      intentionalClose.current = true
      softReplace.current = false
      connectGen.current += 1
      clearReconnect()
      clearInterval(ping)
      wsRef.current?.close()
      wsRef.current = null
      queueRef.current = []
      setIsConnected(false)
    }
  }, [connect, enabled])

  const send = useCallback((data: Record<string, unknown>) => {
    const json = JSON.stringify(data)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(json)
    } else if (queueRef.current.length < MAX_QUEUE) {
      queueRef.current.push(json)
    }
  }, [])

  return { send, clientId, isConnected }
}
