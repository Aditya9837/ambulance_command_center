import { useEffect, useRef, useState, useCallback } from 'react'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

const OFFER_RETRY_MS = 4000
const CONNECT_TIMEOUT_MS = 20000

export function useWebRTC(
  roomId: string | null,
  send: (data: Record<string, unknown>) => void,
  isInitiator: boolean,
) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])
  const localStreamRef = useRef<MediaStream | null>(null)
  const roomIdRef = useRef(roomId)
  const isInitiatorRef = useRef(isInitiator)
  roomIdRef.current = roomId
  isInitiatorRef.current = isInitiator
  const sendOfferRef = useRef<(iceRestart?: boolean) => Promise<void>>(async () => {})
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    const pending = pendingIceRef.current.splice(0)
    for (const c of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c))
      } catch { /* ignore */ }
    }
  }, [])

  const resetPeerConnection = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    pendingIceRef.current = []
    setIsConnected(false)
  }, [])

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    resetPeerConnection()
  }, [resetPeerConnection])

  const startMedia = useCallback(async () => {
    if (localStreamRef.current?.active) return localStreamRef.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        void localVideoRef.current.play().catch(() => {})
      }
      return stream
    } catch {
      setMediaError('Allow camera & microphone to join the call.')
      return null
    }
  }, [])

  const ensurePeerConnection = useCallback(async (): Promise<RTCPeerConnection | null> => {
    if (pcRef.current && pcRef.current.connectionState !== 'closed') return pcRef.current

    const stream = await startMedia()
    if (!stream) return null

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 4 })

    pc.onicecandidate = (event) => {
      if (event.candidate && roomIdRef.current) {
        send({
          type: 'ice_candidate',
          room_id: roomIdRef.current,
          payload: event.candidate.toJSON(),
        })
      }
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
        void remoteVideoRef.current.play().catch(() => {})
      }
      setIsConnected(true)
      setMediaError(null)
    }

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') {
        setIsConnected(true)
        setMediaError(null)
      }
      if (s === 'failed' || s === 'disconnected') {
        setIsConnected(false)
        if (s === 'failed') {
          setMediaError('Connection failed — retrying...')
          const rid = roomIdRef.current
          if (!rid) return
          if (isInitiatorRef.current) {
            void sendOfferRef.current(true)
          } else {
            send({ type: 'request_offer', room_id: rid })
          }
        }
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsConnected(true)
        setMediaError(null)
      }
    }

    stream.getTracks().forEach((track) => pc.addTrack(track, stream))
    pcRef.current = pc
    return pc
  }, [send, startMedia])

  const sendOffer = useCallback(async (iceRestart = false) => {
    const pc = await ensurePeerConnection()
    const rid = roomIdRef.current
    if (!pc || !rid || !isInitiatorRef.current) return

    try {
      const needsRestart = iceRestart || pc.signalingState !== 'stable'
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: needsRestart,
      })
      await pc.setLocalDescription(offer)
      send({ type: 'offer', room_id: rid, payload: offer })
      setMediaError(null)
    } catch {
      setMediaError('Could not start video — refresh or retry.')
    }
  }, [ensurePeerConnection, send])

  sendOfferRef.current = sendOffer

  const requestOffer = useCallback(() => {
    const rid = roomIdRef.current
    if (!rid || isInitiatorRef.current) return
    send({ type: 'request_offer', room_id: rid })
  }, [send])

  const joinRoom = useCallback(async () => {
    const rid = roomIdRef.current
    if (!rid) return
    send({ type: 'join_room', room_id: rid })
    if (isInitiatorRef.current) await sendOffer(false)
  }, [send, sendOffer])

  const resendOffer = useCallback(async () => {
    if (!isInitiatorRef.current) {
      requestOffer()
      return
    }
    await sendOffer(true)
  }, [sendOffer, requestOffer])

  const handleSignal = useCallback(
    async (type: string, payload: RTCSessionDescriptionInit | RTCIceCandidateInit) => {
      const rid = roomIdRef.current
      if (!rid) return

      try {
        if (type === 'offer') {
          const pc = await ensurePeerConnection()
          if (!pc) return
          await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
          await flushPendingIce(pc)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          send({ type: 'answer', room_id: rid, payload: answer })
          setMediaError(null)
        } else if (type === 'answer') {
          const pc = pcRef.current ?? (await ensurePeerConnection())
          if (!pc) return
          await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
          await flushPendingIce(pc)
          setMediaError(null)
        } else if (type === 'ice_candidate') {
          const pc = pcRef.current
          if (!pc || !pc.remoteDescription) {
            pendingIceRef.current.push(payload as RTCIceCandidateInit)
            return
          }
          await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit))
        }
      } catch {
        setMediaError('Signaling error.')
      }
    },
    [ensurePeerConnection, flushPendingIce, send],
  )

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled
      setIsMuted(!t.enabled)
    })
  }

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled
      setIsVideoOff(!t.enabled)
    })
  }

  useEffect(() => {
    if (roomId) void joinRoom()
    return () => {
      resetPeerConnection()
    }
  }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!roomId || isConnected) return

    const interval = setInterval(() => {
      if (isInitiatorRef.current) {
        void sendOffer(true)
      } else {
        requestOffer()
      }
    }, OFFER_RETRY_MS)

    return () => clearInterval(interval)
  }, [roomId, isConnected, sendOffer, requestOffer])

  useEffect(() => {
    if (!roomId || isConnected) return

    const timeout = setTimeout(() => {
      if (!isConnected) {
        setMediaError('Taking longer than usual — retrying...')
        void resendOffer()
      }
    }, CONNECT_TIMEOUT_MS)

    return () => clearTimeout(timeout)
  }, [roomId, isConnected, resendOffer])

  return {
    localVideoRef,
    remoteVideoRef,
    isConnected,
    isMuted,
    isVideoOff,
    mediaError,
    toggleMute,
    toggleVideo,
    handleSignal,
    resendOffer,
    cleanup,
    retryJoin: joinRoom,
    resetPeerConnection,
  }
}
