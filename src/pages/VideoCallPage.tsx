import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react'
import { VideoControls } from '../components/CallCard'
import { api } from '../lib/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { useWebRTC } from '../hooks/useWebRTC'
import { cn, formatDuration, priorityColors } from '../lib/utils'
import type { CallSession } from '../types'

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
  const webrtc = useWebRTC(call?.room_id ?? null, send, true)

  useEffect(() => {
    signalHandlerRef.current = webrtc.handleSignal
    resendOfferRef.current = () => void webrtc.resendOffer()
    retryJoinRef.current = () => void webrtc.retryJoin()
  }, [webrtc.handleSignal, webrtc.resendOffer, webrtc.retryJoin])

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
      webrtc.cleanup()
      navigate('/calls')
    }
  }

  if (!call) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#0b1120]">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/calls')} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">
              {call.ambulance?.vehicle_id} — {call.ambulance?.name}
            </h1>
            <p className="text-xs text-slate-400">
              {call.ambulance?.paramedic_name} • {call.patient_info || 'No patient info'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium uppercase', priorityColors[call.priority])}>
            {call.priority}
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            {webrtc.isConnected ? (
              <><Wifi className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Connected</span></>
            ) : (
              <><WifiOff className="w-3.5 h-3.5 text-amber-400" /><span className="text-amber-400">Connecting...</span></>
            )}
          </div>
          {call.started_at && (
            <span className="text-xs text-slate-400 font-mono">{formatDuration(call.started_at)}</span>
          )}
        </div>
      </header>

      <div className="flex-1 relative p-4">
        <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-900">
          <video ref={webrtc.remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          {!webrtc.isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Waiting for paramedic connection...</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl">
            <video ref={webrtc.localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          </div>
        </div>
      </div>

      <footer className="py-6 border-t border-slate-800">
        <VideoControls
          isMuted={webrtc.isMuted}
          isVideoOff={webrtc.isVideoOff}
          onToggleMute={webrtc.toggleMute}
          onToggleVideo={webrtc.toggleVideo}
          onEnd={handleEnd}
        />
      </footer>
    </div>
  )
}
