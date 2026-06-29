import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react'
import { VideoControls } from '../components/CallCard'
import { api } from '../lib/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { useWebRTC } from '../hooks/useWebRTC'
import { cn, formatDuration, priorityColors } from '../lib/utils'
import type { CallSession } from '../types'

const qualityLabel = {
  good: { text: 'Good', className: 'text-emerald-400' },
  fair: { text: 'Fair', className: 'text-amber-400' },
  poor: { text: 'Poor', className: 'text-red-400' },
} as const

export default function VideoCallPage() {
  const { callId } = useParams()
  const navigate = useNavigate()
  const [call, setCall] = useState<CallSession | null>(null)
  const signalHandlerRef = useRef<(type: string, payload: RTCSessionDescriptionInit | RTCIceCandidateInit) => void>(() => {})
  const resendOfferRef = useRef<() => void>(() => {})
  const retryJoinRef = useRef<() => void>(() => {})

  const handleWsMessage = useCallback(
    (msg: Record<string, unknown>) => {
      if (msg.type === 'call_ended') {
        navigate('/calls')
        return
      }
      if (msg.type === 'peer_joined' || msg.type === 'request_offer') {
        resendOfferRef.current()
        return
      }
      if (['offer', 'answer', 'ice_candidate'].includes(msg.type as string)) {
        signalHandlerRef.current(msg.type as string, msg.payload as RTCSessionDescriptionInit)
      }
    },
    [navigate],
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
  } = useWebRTC(call?.room_id ?? null, send, true)

  useEffect(() => {
    signalHandlerRef.current = handleSignal
    resendOfferRef.current = () => void resendOffer()
    retryJoinRef.current = () => void retryJoin()
  }, [handleSignal, resendOffer, retryJoin])

  useEffect(() => {
    if (!callId) return
    api.getActiveCalls().then((calls) => {
      const found = calls.find((c) => c.id === Number(callId))
      if (found) setCall(found)
      else navigate('/calls')
    })
  }, [callId, navigate])

  const handleEnd = async () => {
    if (call) {
      await api.endCall(call.id)
      cleanup()
      navigate('/calls')
    }
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

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#0b1120] h-[100dvh] max-h-[100dvh]">
      {/* Compact header — shrinks on small screens */}
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

      {/* Video stage — fills all remaining space, no page scroll */}
      <div className="relative flex-1 min-h-0 w-full">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-contain sm:object-cover bg-black"
        />

        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
            <div className="text-center px-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs sm:text-sm text-slate-400">Waiting for paramedic connection...</p>
            </div>
          </div>
        )}

        {/* Status hint overlay — no extra layout row */}
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

        {/* Doctor PiP when sharing camera */}
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

        {/* Controls overlaid on video — always visible without scrolling */}
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
                onEnd={handleEnd}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
