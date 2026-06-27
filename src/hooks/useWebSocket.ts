import { useEffect, useRef, useCallback, useState } from 'react'
import { api } from '../lib/api'
import { buildWebSocketUrl } from '../lib/ws'

type MessageHandler = (data: Record<string, unknown>) => void

const MIN_RECONNECT_MS = 2000
const MAX_RECONNECT_MS = 15000
const MAX_QUEUE = 50

export function useWebSocket(
  onMessage: MessageHandler,
  enabled = true,
  onReconnect?: () => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const [clientId] = useState(() => `cc-${crypto.randomUUID().slice(0, 8)}`)
  const handlerRef = useRef(onMessage)
  const onReconnectRef = useRef(onReconnect)
  const reconnectMs = useRef(MIN_RECONNECT_MS)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intentionalClose = useRef(false)
  const hadConnected = useRef(false)
  const queueRef = useRef<string[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    handlerRef.current = onMessage
    onReconnectRef.current = onReconnect
  }, [onMessage, onReconnect])

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

  const flushQueue = useCallback((ws: WebSocket) => {
    while (queueRef.current.length && ws.readyState === WebSocket.OPEN) {
      ws.send(queueRef.current.shift()!)
    }
  }, [])

  const connect = useCallback(() => {
    if (!enabled) return

    const token = api.getToken()
    const url = buildWebSocketUrl(clientId, token)
    if (!url) return

    if (wsRef.current) {
      intentionalClose.current = true
      wsRef.current.close()
      wsRef.current = null
    }
    intentionalClose.current = false

    const ws = new WebSocket(url)

    ws.onopen = () => {
      reconnectMs.current = MIN_RECONNECT_MS
      setIsConnected(true)
      flushQueue(ws)
      if (hadConnected.current) {
        onReconnectRef.current?.()
      }
      hadConnected.current = true
    }

    ws.onmessage = (event) => {
      try {
        handlerRef.current(JSON.parse(event.data))
      } catch { /* ignore */ }
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onclose = () => {
      wsRef.current = null
      setIsConnected(false)
      if (!intentionalClose.current) scheduleReconnect()
    }

    wsRef.current = ws
  }, [clientId, enabled, flushQueue, scheduleReconnect])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    if (!enabled) return

    connect()
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25000)

    return () => {
      intentionalClose.current = true
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
