/** WebSocket base URL — connects directly to backend (port 8000), bypassing Vite proxy. */
export function getWebSocketBase(): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (import.meta.env.DEV) {
    return `ws://${window.location.hostname}:8000`
  }

  return 'wss://api.digiutkal.com'
}

export function buildWebSocketUrl(clientId: string, token: string | null): string | null {
  if (!token) return null
  return `${getWebSocketBase()}/ws/${clientId}?token=${encodeURIComponent(token)}`
}
