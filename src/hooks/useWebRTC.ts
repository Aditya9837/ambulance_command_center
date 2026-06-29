import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchIceConfig } from '../lib/iceConfig'
import { useAdaptiveQuality, type ConnectionQuality } from './useAdaptiveQuality'

const MAX_VIDEO_BITRATE = 400_000
const MAX_VIDEO_FPS = 15
const MAX_AUDIO_BITRATE = 32_000
const INITIAL_SCALE_DOWN = 1.5

const OFFER_RETRY_MS = 4000
const CONNECT_TIMEOUT_MS = 20000

function applySenderParams(pc: RTCPeerConnection) {
  pc.getSenders().forEach((sender) => {
    if (!sender.track) return
    const params = sender.getParameters()
    if (!params.encodings?.length) params.encodings = [{}]
    if (sender.track.kind === 'video') {
      params.degradationPreference = 'maintain-framerate'
      params.encodings[0].maxBitrate = MAX_VIDEO_BITRATE
      params.encodings[0].maxFramerate = MAX_VIDEO_FPS
      params.encodings[0].scaleResolutionDownBy = INITIAL_SCALE_DOWN
    } else if (sender.track.kind === 'audio') {
      params.encodings[0].maxBitrate = MAX_AUDIO_BITRATE
    }
    void sender.setParameters(params).catch(() => {})
  })
}

export function useWebRTC(
  roomId: string | null,
  send: (data: Record<string, unknown>) => void,
  isInitiator: boolean,
) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const pcConfigRef = useRef<RTCConfiguration | null>(null)
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef(new MediaStream())
  const roomIdRef = useRef(roomId)
  const isInitiatorRef = useRef(isInitiator)
  const sendOfferRef = useRef<(iceRestart?: boolean) => Promise<void>>(async () => {})
  const shareCameraRef = useRef(false)

  useEffect(() => {
    roomIdRef.current = roomId
    isInitiatorRef.current = isInitiator
  }, [roomId, isInitiator])

  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(true)
  const [shareCamera, setShareCamera] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  shareCameraRef.current = shareCamera

  const connectionQuality = useAdaptiveQuality(pcRef)

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
    remoteStreamRef.current.getTracks().forEach((t) => remoteStreamRef.current.removeTrack(t))
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    setIsConnected(false)
  }, [])

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    resetPeerConnection()
  }, [resetPeerConnection])

  const startMedia = useCallback(async (withVideo = false) => {
    if (localStreamRef.current?.active && !withVideo) return localStreamRef.current

    if (withVideo && shareCameraRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 15, max: 30 } },
          audio: true,
        })
        localStreamRef.current?.getTracks().forEach((t) => t.stop())
        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
          void localVideoRef.current.play().catch(() => {})
        }
        return stream
      } catch {
        setMediaError('Could not enable camera.')
        return localStreamRef.current
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = null
      return stream
    } catch {
      const empty = new MediaStream()
      localStreamRef.current = empty
      setMediaError('Mic unavailable — receiving ambulance feed only.')
      return empty
    }
  }, [])

  const ensurePeerConnection = useCallback(async (): Promise<RTCPeerConnection | null> => {
    if (pcRef.current && pcRef.current.connectionState !== 'closed') return pcRef.current

    if (!pcConfigRef.current) {
      pcConfigRef.current = await fetchIceConfig()
    }

    const stream = await startMedia(shareCameraRef.current)
    if (!stream) return null

    const pc = new RTCPeerConnection(pcConfigRef.current)

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
      const remote = remoteStreamRef.current
      if (!remote.getTrackById(event.track.id)) {
        remote.addTrack(event.track)
      }
      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== remote) {
          remoteVideoRef.current.srcObject = remote
        }
        void remoteVideoRef.current.play().catch(() => {})
      }
      setIsConnected(true)
      setMediaError(null)
    }

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') {
        applySenderParams(pc)
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

    try {
      const { codecs } = RTCRtpReceiver.getCapabilities('video') ?? { codecs: [] }
      const h264 = codecs.filter((c) => c.mimeType === 'video/H264')
      const rest = codecs.filter((c) => c.mimeType !== 'video/H264')
      const preferred = [...h264, ...rest]
      pc.getTransceivers().forEach((t) => {
        if (t.receiver.track.kind === 'video' && preferred.length) {
          try { t.setCodecPreferences(preferred) } catch { /* ignore */ }
        }
      })
    } catch { /* ignore */ }

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

  useEffect(() => {
    sendOfferRef.current = sendOffer
  }, [sendOffer])

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

  const toggleShareCamera = useCallback(async () => {
    const next = !shareCameraRef.current
    shareCameraRef.current = next
    setShareCamera(next)
    setIsVideoOff(!next)

    if (!next) {
      localStreamRef.current?.getVideoTracks().forEach((t) => {
        t.stop()
        localStreamRef.current?.removeTrack(t)
      })
      if (localVideoRef.current) localVideoRef.current.srcObject = null
      await sendOffer(true)
      return
    }

    const stream = await startMedia(true)
    const pc = pcRef.current ?? (await ensurePeerConnection())
    if (!pc || !stream) return

    const existing = pc.getSenders().find((s) => s.track?.kind === 'video')
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      if (existing) {
        await existing.replaceTrack(videoTrack)
      } else {
        pc.addTrack(videoTrack, stream)
      }
    }
    await sendOffer(true)
  }, [shareCamera, startMedia, ensurePeerConnection, sendOffer])

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
    shareCamera,
    connectionQuality,
    mediaError,
    toggleMute,
    toggleShareCamera,
    handleSignal,
    resendOffer,
    cleanup,
    retryJoin: joinRoom,
    resetPeerConnection,
  }
}

export type { ConnectionQuality }
