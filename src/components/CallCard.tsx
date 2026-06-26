import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import type { CallSession } from '../types'
import { cn, formatDuration, priorityColors, statusColors } from '../lib/utils'

interface CallCardProps {
  call: CallSession
  onAccept?: () => void
  onJoin?: () => void
  onEnd?: () => void
  compact?: boolean
}

export default function CallCard({ call, onAccept, onJoin, onEnd, compact }: CallCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-700/50 bg-[#1a2332] p-4 transition-all hover:border-slate-600/50 animate-fade-in',
        call.priority === 'critical' && 'ring-1 ring-red-500/30',
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {call.ambulance?.vehicle_id || `Call #${call.id}`}
          </p>
          <p className="text-xs text-slate-400">{call.ambulance?.name}</p>
        </div>
        <div className="flex gap-1.5">
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase', priorityColors[call.priority])}>
            {call.priority}
          </span>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium uppercase', statusColors[call.status])}>
            {call.status}
          </span>
        </div>
      </div>

      {!compact && call.patient_info && (
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{call.patient_info}</p>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{call.ambulance?.paramedic_name || 'Unknown paramedic'}</span>
        {call.started_at && <span>{formatDuration(call.started_at)}</span>}
      </div>

      <div className="flex gap-2 mt-3">
        {call.status === 'waiting' && onAccept && (
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            Accept
          </button>
        )}
        {call.status === 'active' && onJoin && (
          <button
            onClick={onJoin}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Video className="w-3.5 h-3.5" />
            Join Call
          </button>
        )}
        {call.status === 'active' && onEnd && (
          <button
            onClick={onEnd}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-medium rounded-lg transition-colors"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export function VideoControls({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEnd,
}: {
  isMuted: boolean
  isVideoOff: boolean
  onToggleMute: () => void
  onToggleVideo: () => void
  onEnd: () => void
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={onToggleMute}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
          isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white hover:bg-slate-600',
        )}
      >
        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
      <button
        onClick={onToggleVideo}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
          isVideoOff ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white hover:bg-slate-600',
        )}
      >
        {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
      </button>
      <button
        onClick={onEnd}
        className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
      >
        <PhoneOff className="w-6 h-6" />
      </button>
    </div>
  )
}
