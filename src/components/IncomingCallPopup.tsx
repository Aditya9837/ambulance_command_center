import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, PhoneIncoming, X } from 'lucide-react'
import { api } from '../lib/api'
import { cn, formatTime, priorityColors } from '../lib/utils'
import type { CallSession } from '../types'

interface IncomingCallPopupProps {
  calls: CallSession[]
  onDismiss: (callId: number) => void
}

export default function IncomingCallPopup({ calls, onDismiss }: IncomingCallPopupProps) {
  const navigate = useNavigate()
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (calls.length === 0) return null

  const primary = calls[0]
  const extras = calls.length - 1

  const handleAccept = async (callId: number) => {
    setError(null)
    setAcceptingId(callId)
    try {
      await api.acceptCall(callId)
      navigate(`/call/${callId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept call')
      setAcceptingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pointer-events-none">
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Incoming call"
        className="relative pointer-events-auto w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#141c2b] shadow-2xl shadow-amber-900/30 animate-fade-in overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 animate-pulse">
            <PhoneIncoming className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Incoming Call</p>
            <p className="text-xs text-amber-200/80">
              {extras > 0 ? `${calls.length} calls waiting` : 'A paramedic is requesting consultation'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(primary.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-xl border border-slate-700/60 bg-[#0b1120]/80 p-3.5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-base font-bold text-white truncate">
                  {primary.ambulance?.vehicle_id ?? `Call #${primary.id}`}
                </p>
                <p className="text-sm text-slate-400 truncate">{primary.ambulance?.name}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase',
                  priorityColors[primary.priority],
                )}
              >
                {primary.priority}
              </span>
            </div>

            {primary.ambulance?.paramedic_name && (
              <p className="text-xs text-slate-500 mb-1">
                Paramedic: {primary.ambulance.paramedic_name}
              </p>
            )}
            {primary.patient_info && (
              <p className="text-xs text-slate-400 line-clamp-2 mb-2">{primary.patient_info}</p>
            )}
            <p className="text-[11px] text-slate-500">Received {formatTime(primary.created_at)}</p>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onDismiss(primary.id)}
              className="flex-1 py-2.5 rounded-xl border border-slate-600/60 text-slate-300 text-sm font-medium hover:bg-slate-800/60 transition-colors"
            >
              Later
            </button>
            <button
              type="button"
              disabled={acceptingId === primary.id}
              onClick={() => void handleAccept(primary.id)}
              className="flex-[1.4] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              <Phone className="w-4 h-4" />
              {acceptingId === primary.id ? 'Accepting…' : 'Accept Call'}
            </button>
          </div>

          {extras > 0 && (
            <button
              type="button"
              onClick={() => navigate('/calls')}
              className="w-full text-center text-xs text-cyan-400 hover:text-cyan-300 py-1"
            >
              View all {calls.length} waiting calls →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
