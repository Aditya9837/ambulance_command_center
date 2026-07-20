/** Default ICE servers — overridden by /api/webrtc/ice-servers when available. */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:80?transport=tcp',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: ['turn:freestun.net:3478', 'turn:freestun.net:3478?transport=tcp'],
    username: 'free',
    credential: 'free',
  },
]

export async function fetchIceConfig(): Promise<RTCConfiguration> {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || '/api'
  try {
    const res = await fetch(`${apiBase}/webrtc/ice-servers`)
    if (!res.ok) throw new Error('ice config fetch failed')
    const data = await res.json()
    return {
      iceServers: data.iceServers ?? DEFAULT_ICE_SERVERS,
      iceTransportPolicy: data.iceTransportPolicy ?? 'all',
      bundlePolicy: data.bundlePolicy ?? 'max-bundle',
      rtcpMuxPolicy: data.rtcpMuxPolicy ?? 'require',
      iceCandidatePoolSize: data.iceCandidatePoolSize ?? 20,
    }
  } catch {
    return {
      iceServers: DEFAULT_ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 20,
    }
  }
}
