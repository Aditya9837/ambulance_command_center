import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchIceConfig } from '../lib/iceConfig'
import { useAdaptiveQuality, type ConnectionQuality } from './useAdaptiveQuality'

const MAX_VIDEO_BITRATE = 1_500_000
const MAX_VIDEO_FPS = 24
const MAX_AUDIO_BITRATE = 32_000
const INITIAL_SCALE_DOWN = 1.0

const OFFER_RETRY_INITIAL_MS = 8000
const OFFER_RETRY_MAX_MS = 20000
const CONNECT_TIMEOUT_MS = 20000
const ICE_BATCH_FLUSH_MS = 50
const ROOM_JOIN_TIMEOUT_MS = 3000

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
  const shareCameraRef = useRef(true)
  const iceBatchRef = useRef<RTCIceCandidateInit[]>([])
  const iceFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roomJoinedResolverRef = useRef<((roomId: string) => void) | null>(null)

  useEffect(() => {
    roomIdRef.current = roomId
    isInitiatorRef.current = isInitiator
  }, [roomId, isInitiator])

  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [shareCamera, setShareCamera] = useState(true)
  const [mediaError, setMediaError] = useState<string | null>(null)

  shareCameraRef.current = shareCamera

  const connectionQuality = useAdaptiveQuality(pcRef)

  const flushIceBatch = useCallback((endOfCandidates = false) => {
    if (iceFlushTimerRef.current) {
      clearTimeout(iceFlushTimerRef.current)
      iceFlushTimerRef.current = null
    }
    const rid = roomIdRef.current
    if (!rid) return
    const batch = iceBatchRef.current.splice(0)
    if (batch.length) {
      send({ type: 'ice_candidates', room_id: rid, payload: batch })
    }
    if (endOfCandidates) {
      send({ type: 'ice_gathering_complete', room_id: rid })
    }
  }, [send])

  const queueIceCandidate = useCallback((candidate: RTCIceCandidateInit) => {
    iceBatchRef.current.push(candidate)
    if (iceFlushTimerRef.current) return
    iceFlushTimerRef.current = setTimeout(() => flushIceBatch(false), ICE_BATCH_FLUSH_MS)
  }, [flushIceBatch])

  const waitForRoomJoined = useCallback((roomId: string) => {
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        roomJoinedResolverRef.current = null
        resolve()
      }, ROOM_JOIN_TIMEOUT_MS)
      roomJoinedResolverRef.current = (id) => {
        if (id !== roomId) return
        clearTimeout(timeout)
        roomJoinedResolverRef.current = null
        resolve()
      }
    })
  }, [])

  const notifyRoomJoined = useCallback((roomId: string) => {
    roomJoinedResolverRef.current?.(roomId)
  }, [])

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    const pending = pendingIceRef.current.splice(0)
    const failed: RTCIceCandidateInit[] = []
    for (const c of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c))
      } catch (err) {
        console.warn('[WebRTC] addIceCandidate failed, will retry:', err)
        failed.push(c)
      }
    }
    if (failed.length) pendingIceRef.current.push(...failed)
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
          video: { width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 24, max: 30 } },
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
        setMediaError('Camera unavailable — sending audio only.')
        shareCameraRef.current = false
        setShareCamera(false)
        setIsVideoOff(true)
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
    if (!pcConfigRef.current) {
      pcConfigRef.current = await fetchIceConfig()
    }

    const stream = await startMedia(shareCameraRef.current)
    if (!stream) return null

    if (pcRef.current && pcRef.current.connectionState !== 'closed') {
      const pc = pcRef.current
      for (const track of stream.getTracks()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind)
        if (!sender) {
          pc.addTrack(track, stream)
        } else if (sender.track?.id !== track.id) {
          await sender.replaceTrack(track)
        }
      }
      return pc
    }

    const pc = new RTCPeerConnection(pcConfigRef.current)

    pc.onicecandidate = (event) => {
      if (!roomIdRef.current) return
      if (!event.candidate) {
        flushIceBatch(true)
        return
      }
      queueIceCandidate(event.candidate.toJSON())
    }

    pc.ontrack = (event) => {
      const remote = remoteStreamRef.current
      const tracks = event.streams[0]
        ? event.streams[0].getTracks()
        : [event.track]
      for (const track of tracks) {
        if (!remote.getTrackById(track.id)) {
          remote.addTrack(track)
        }
        track.enabled = true
      }
      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== remote) {
          remoteVideoRef.current.srcObject = remote
        }
        remoteVideoRef.current.muted = false
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
  }, [send, startMedia, flushIceBatch, queueIceCandidate])

  const sendOffer = useCallback(async (iceRestart = false) => {
    const pc = await ensurePeerConnection()
    const rid = roomIdRef.current
    if (!pc || !rid || !isInitiatorRef.current) return

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart,
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
    await waitForRoomJoined(rid)
    if (isInitiatorRef.current) {
      await startMedia(true)
      await sendOffer(false)
    } else {
      void ensurePeerConnection()
      requestOffer()
    }
  }, [send, sendOffer, ensurePeerConnection, startMedia, requestOffer, waitForRoomJoined])

  const resendOffer = useCallback(async (iceRestart = false) => {
    if (!isInitiatorRef.current) {
      requestOffer()
      return
    }
    await sendOffer(iceRestart)
  }, [sendOffer, requestOffer])

  const addIceCandidate = useCallback(async (payload: RTCIceCandidateInit) => {
    const pc = pcRef.current
    if (!pc || !pc.remoteDescription) {
      pendingIceRef.current.push(payload)
      return
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(payload))
    } catch (err) {
      console.warn('[WebRTC] addIceCandidate deferred:', err)
      pendingIceRef.current.push(payload)
    }
  }, [])

  const handleIceCandidates = useCallback(async (candidates: RTCIceCandidateInit[]) => {
    for (const c of candidates) {
      await addIceCandidate(c)
    }
  }, [addIceCandidate])

  const handleSignal = useCallback(
    async (type: string, payload: RTCSessionDescriptionInit | RTCIceCandidateInit | RTCIceCandidateInit[]) => {
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
          await addIceCandidate(payload as RTCIceCandidateInit)
        } else if (type === 'ice_candidates') {
          await handleIceCandidates(payload as RTCIceCandidateInit[])
        }
      } catch {
        setMediaError('Signaling error.')
      }
    },
    [ensurePeerConnection, flushPendingIce, send, addIceCandidate, handleIceCandidates],
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

    let retryMs = OFFER_RETRY_INITIAL_MS
    let timer: ReturnType<typeof setTimeout>

    const scheduleRetry = () => {
      timer = setTimeout(() => {
        if (isInitiatorRef.current) {
          void sendOffer(false)
        } else {
          requestOffer()
        }
        retryMs = Math.min(Math.round(retryMs * 1.5), OFFER_RETRY_MAX_MS)
        scheduleRetry()
      }, retryMs)
    }

    scheduleRetry()
    return () => clearTimeout(timer)
  }, [roomId, isConnected, sendOffer, requestOffer])

  useEffect(() => {
    if (!roomId || isConnected) return

    const timeout = setTimeout(() => {
      if (!isConnected) {
        setMediaError('Taking longer than usual — retrying...')
        void resendOffer(false)
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
    notifyRoomJoined,
  }
}

export type { ConnectionQuality }
