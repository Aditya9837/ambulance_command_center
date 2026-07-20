import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Maximize2, Minimize2, Wifi, WifiOff } from 'lucide-react'
import { VideoControls } from '../components/CallCard'
import EndCallModal from '../components/EndCallModal'
import AmbulanceMap from '../components/AmbulanceMap'
import ScaledIframe from '../components/ScaledIframe'
import { api } from '../lib/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { useWebRTC } from '../hooks/useWebRTC'
import { cn, formatDuration, priorityColors } from '../lib/utils'
import type { Ambulance, CallSession } from '../types'

const REALTIME_URL = 'https://realtime.larkaihealth.com/'

const qualityLabel = {
  good: { text: 'Good', className: 'text-emerald-400' },
  fair: { text: 'Fair', className: 'text-amber-400' },
  poor: { text: 'Poor', className: 'text-red-400' },
} as const

type VideoFitMode = 'fit' | 'fill'
type PrescriptionModalMode = 'end' | 'prescription'

export default function VideoCallPage() {
  const { callId } = useParams()
  const navigate = useNavigate()
  const [call, setCall] = useState<CallSession | null>(null)
  const [liveLocation, setLiveLocation] = useState<{
    latitude: number | null
    longitude: number | null
    last_location_update: string | null
  }>({ latitude: null, longitude: null, last_location_update: null })
  const [showEndModal, setShowEndModal] = useState(false)
  const [prescriptionMode, setPrescriptionMode] = useState<PrescriptionModalMode>('end')
  const [videoFit, setVideoFit] = useState<VideoFitMode>(() => {
    const saved = localStorage.getItem('videoFit')
    return saved === 'fill' ? 'fill' : 'fit'
  })
  const [remoteAspect, setRemoteAspect] = useState<number | null>(null)
  const signalHandlerRef = useRef<(type: string, payload: RTCSessionDescriptionInit | RTCIceCandidateInit | RTCIceCandidateInit[]) => void>(() => {})
  const resendOfferRef = useRef<() => void>(() => {})
  const retryJoinRef = useRef<() => void>(() => {})
  const notifyRoomJoinedRef = useRef<(roomId: string) => void>(() => {})
  const cleanupRef = useRef<() => void>(() => {})
  const ambulanceIdRef = useRef<number | null>(null)

  const handleWsMessage = useCallback(
    (msg: Record<string, unknown>) => {
      if (msg.type === 'call_ended') {
        cleanupRef.current()
        setPrescriptionMode('prescription')
        setShowEndModal(true)
        return
      }
      if (msg.type === 'location_updated') {
        const ambulance = msg.ambulance as Ambulance | undefined
        if (ambulance && ambulanceIdRef.current != null && ambulance.id === ambulanceIdRef.current) {
          setLiveLocation({
            latitude: ambulance.latitude,
            longitude: ambulance.longitude,
            last_location_update: ambulance.last_location_update,
          })
        }
        return
      }
      if (msg.type === 'join_denied') {
        retryJoinRef.current()
        return
      }
      if (msg.type === 'room_joined' && typeof msg.room_id === 'string') {
        notifyRoomJoinedRef.current(msg.room_id)
        return
      }
      if (msg.type === 'peer_joined' || msg.type === 'request_offer') {
        resendOfferRef.current()
        return
      }
      if (msg.type === 'cached_signal') {
        const signalType = msg.signal_type as string
        const payload = msg.payload as RTCSessionDescriptionInit
        if (signalType && payload) {
          signalHandlerRef.current(signalType, payload)
        }
        return
      }
      if (msg.type === 'ice_candidates' && Array.isArray(msg.payload)) {
        signalHandlerRef.current('ice_candidates', msg.payload as RTCIceCandidateInit[])
        return
      }
      if (['offer', 'answer', 'ice_candidate'].includes(msg.type as string)) {
        signalHandlerRef.current(msg.type as string, msg.payload as RTCSessionDescriptionInit)
      }
    },
    [],
  )

  const handleWsReconnect = useCallback(() => {
    retryJoinRef.current()
  }, [])

  const { send } = useWebSocket(handleWsMessage, true, handleWsReconnect)
  const {
    localVideoRef,
    remoteVideoRef,
    isConnected,
    isMuted,
    isVideoOff,
    shareCamera,
    connectionQuality,
    mediaError,
    handleSignal,
    resendOffer,
    retryJoin,
    cleanup,
    toggleMute,
    toggleShareCamera,
    notifyRoomJoined,
  } = useWebRTC(call?.room_id ?? null, send, true)

  useEffect(() => {
    signalHandlerRef.current = handleSignal
    resendOfferRef.current = () => void resendOffer()
    retryJoinRef.current = () => void retryJoin()
    notifyRoomJoinedRef.current = notifyRoomJoined
    cleanupRef.current = cleanup
  }, [handleSignal, resendOffer, retryJoin, notifyRoomJoined, cleanup])

  useEffect(() => {
    if (!callId) return
    api.getActiveCalls().then((calls) => {
      const found = calls.find((c) => c.id === Number(callId))
      if (found) {
        setCall(found)
        ambulanceIdRef.current = found.ambulance_id
        setLiveLocation({
          latitude: found.ambulance?.latitude ?? null,
          longitude: found.ambulance?.longitude ?? null,
          last_location_update: found.ambulance?.last_location_update ?? null,
        })
      } else {
        navigate('/calls')
      }
    })
  }, [callId, navigate])

  // Poll ambulance location as a fallback if WS updates are missed.
  useEffect(() => {
    const ambulanceId = call?.ambulance_id
    if (!ambulanceId) return

    const refresh = () => {
      api.getAmbulances().then((list) => {
        const amb = list.find((a) => a.id === ambulanceId)
        if (!amb) return
        setLiveLocation({
          latitude: amb.latitude,
          longitude: amb.longitude,
          last_location_update: amb.last_location_update,
        })
      }).catch(() => {})
    }

    const timer = window.setInterval(refresh, 10000)
    return () => window.clearInterval(timer)
  }, [call?.ambulance_id])

  useEffect(() => {
    const video = remoteVideoRef.current
    if (!video) return

    const updateAspect = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setRemoteAspect(video.videoWidth / video.videoHeight)
      }
    }

    video.addEventListener('loadedmetadata', updateAspect)
    video.addEventListener('resize', updateAspect)
    updateAspect()

    return () => {
      video.removeEventListener('loadedmetadata', updateAspect)
      video.removeEventListener('resize', updateAspect)
    }
  }, [remoteVideoRef, isConnected])

  const toggleVideoFit = () => {
    setVideoFit((prev) => {
      const next = prev === 'fit' ? 'fill' : 'fit'
      localStorage.setItem('videoFit', next)
      return next
    })
  }

  const handleConfirmEnd = async (prescriptionHtml: string | null) => {
    if (!call) return
    if (prescriptionMode === 'prescription') {
      if (prescriptionHtml) {
        await api.savePrescription(call.id, prescriptionHtml)
      }
    } else {
      await api.endCall(call.id, prescriptionHtml ?? undefined)
      cleanup()
    }
    setShowEndModal(false)
    navigate('/history')
  }

  const handleCancelEnd = () => {
    setShowEndModal(false)
    if (prescriptionMode === 'prescription') {
      navigate('/history')
    }
  }

  const openEndModal = () => {
    setPrescriptionMode('end')
    setShowEndModal(true)
  }

  if (!call) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0b1120]">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const q = qualityLabel[connectionQuality]
  const statusHint =
    mediaError ??
    (!shareCamera && isConnected ? 'Camera off — tap video button to share with paramedic' : null)

  const objectFitClass = videoFit === 'fit' ? 'object-contain' : 'object-cover'
  const mapLabel = call.ambulance
    ? `${call.ambulance.vehicle_id} — ${call.ambulance.name}`
    : 'Ambulance'

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#0b1120] h-[100dvh] max-h-[100dvh]">
      {showEndModal && (
        <EndCallModal
          mode={prescriptionMode}
          ambulanceLabel={`${call.ambulance?.vehicle_id} — ${call.ambulance?.name}`}
          onConfirm={handleConfirmEnd}
          onCancel={handleCancelEnd}
        />
      )}

      <header className="shrink-0 flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2 sm:py-3 border-b border-slate-800/80 bg-[#0b1120]/95 backdrop-blur-sm z-20">
        <button
          onClick={() => navigate('/calls')}
          className="shrink-0 p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800/60"
          aria-label="Back to calls"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-base font-bold text-white truncate">
            {call.ambulance?.vehicle_id} — {call.ambulance?.name}
          </h1>
          <p className="text-[10px] sm:text-xs text-slate-400 truncate hidden sm:block">
            {call.ambulance?.paramedic_name}
            {call.patient_info ? ` • ${call.patient_info}` : ''}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 sm:gap-2.5">
          <span
            className={cn(
              'hidden sm:inline text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase',
              priorityColors[call.priority],
            )}
          >
            {call.priority}
          </span>
          {isConnected && (
            <span className={cn('text-[10px] sm:text-xs font-medium', q.className)}>{q.text}</span>
          )}
          <div className="flex items-center gap-1 text-[10px] sm:text-xs">
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                <span className="text-emerald-400 hidden sm:inline">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                <span className="text-amber-400 hidden sm:inline">Connecting</span>
              </>
            )}
          </div>
          {call.started_at && (
            <span className="text-[10px] sm:text-xs text-slate-400 font-mono tabular-nums">
              {formatDuration(call.started_at)}
            </span>
          )}
        </div>
      </header>

      <div className="relative flex-1 min-h-0 w-full flex flex-col lg:flex-row">
        {/* Left 70% — video call */}
        <div className="relative flex-[6] min-h-0 min-w-0 flex items-center justify-center bg-black border-b lg:border-b-0 lg:border-r border-slate-800">
          <div
            className={cn(
              'relative w-full h-full flex items-center justify-center',
              videoFit === 'fit' && remoteAspect ? 'max-w-full max-h-full' : '',
            )}
            style={
              videoFit === 'fit' && remoteAspect
                ? { aspectRatio: remoteAspect, maxWidth: '100%', maxHeight: '100%' }
                : undefined
            }
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={cn('w-full h-full bg-black', objectFitClass)}
            />
          </div>

          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
              <div className="text-center px-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs sm:text-sm text-slate-400">Waiting for paramedic connection...</p>
              </div>
            </div>
          )}

          {statusHint && (
            <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-auto sm:max-w-md z-10">
              <p
                className={cn(
                  'text-[10px] sm:text-xs px-2.5 py-1.5 rounded-lg text-center sm:text-left backdrop-blur-md',
                  mediaError
                    ? 'text-amber-200 bg-amber-500/20 border border-amber-500/30'
                    : 'text-slate-300 bg-slate-900/70 border border-slate-700/50',
                )}
              >
                {statusHint}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={toggleVideoFit}
            title={videoFit === 'fit' ? 'Fill screen (crop)' : 'Fit to screen (full frame)'}
            className="absolute bottom-24 left-3 sm:bottom-28 sm:left-4 z-10 p-2 rounded-lg bg-slate-900/70 border border-slate-700/50 text-slate-300 hover:text-white backdrop-blur-md"
            aria-label={videoFit === 'fit' ? 'Switch to fill mode' : 'Switch to fit mode'}
          >
            {videoFit === 'fit' ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>

          {shareCamera && (
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-24 h-[4.5rem] sm:w-36 sm:h-28 md:w-44 md:h-32 rounded-lg sm:rounded-xl overflow-hidden border-2 border-slate-600/80 shadow-2xl z-10 bg-black">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            </div>
          )}

          <div className="absolute bottom-0 inset-x-0 z-20 pointer-events-none">
            <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 sm:pt-14 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 sm:px-6">
              <div className="pointer-events-auto flex justify-center">
                <VideoControls
                  overlay
                  isMuted={isMuted}
                  isVideoOff={isVideoOff}
                  shareCamera={shareCamera}
                  onToggleMute={toggleMute}
                  onToggleVideo={() => void toggleShareCamera()}
                  onEnd={openEndModal}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right 30% — realtime iframe (top) + map (bottom) */}
        <aside className="relative flex-[4] min-h-[40vh] lg:min-h-0 min-w-0 flex flex-col bg-[#0b1120]">
          <div className="relative flex-[3] min-h-0 flex flex-col border-b border-slate-800">
            <div className="shrink-0 px-2 py-1 bg-slate-950 border-b border-slate-800/80">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                Wren Realtime
              </p>
            </div>
            <div className="relative flex-1 min-h-0">
              <ScaledIframe title="Wren Realtime" src={REALTIME_URL} />
            </div>
          </div>

          <div className="relative flex-[2] min-h-0 flex flex-col">
            <div className="shrink-0 px-2 py-1 bg-slate-950 border-b border-slate-800/80">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                Ambulance location
              </p>
            </div>
            <div className="relative flex-1 min-h-0">
              <AmbulanceMap
                latitude={liveLocation.latitude}
                longitude={liveLocation.longitude}
                lastUpdate={liveLocation.last_location_update}
                label={mapLabel}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
