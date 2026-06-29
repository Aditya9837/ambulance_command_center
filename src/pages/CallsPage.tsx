import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import CallCard from '../components/CallCard'
import { api } from '../lib/api'
import { useEndCallFlow } from '../hooks/useEndCallFlow'
import { useWebSocket } from '../hooks/useWebSocket'
import type { CallSession } from '../types'

export default function CallsPage() {
  const navigate = useNavigate()
  const [calls, setCalls] = useState<CallSession[]>([])
  const [filter, setFilter] = useState<'all' | 'waiting' | 'active'>('all')

  const refresh = useCallback(async () => {
    setCalls(await api.getActiveCalls())
  }, [])

  const { requestEnd, modal } = useEndCallFlow(refresh)

  useEffect(() => {
    let active = true
    void api.getActiveCalls().then((data) => {
      if (active) setCalls(data)
    })
    return () => {
      active = false
    }
  }, [])

  useWebSocket(useCallback((msg) => {
    if (['call_created', 'call_accepted', 'call_ended', 'call_updated'].includes(msg.type as string)) {
      refresh()
    }
  }, [refresh]))

  const filtered = calls.filter((c) => filter === 'all' || c.status === filter)

  const handleAccept = async (callId: number) => {
    await api.acceptCall(callId)
    navigate(`/call/${callId}`)
  }

  return (
    <div className="p-8">
      {modal}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Live Calls</h1>
        <p className="text-sm text-slate-400 mt-1">
          Incoming calls from ambulances — pick up and join consultations
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        {(['all', 'waiting', 'active'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
              filter === f
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {f} ({f === 'all' ? calls.length : calls.filter((c) => c.status === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#1a2332] rounded-2xl border border-slate-700/50">
          <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No incoming calls</p>
          <p className="text-xs text-slate-500 mt-1">Calls appear here when paramedics initiate from the ambulance app</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filtered.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              onAccept={() => handleAccept(call.id)}
              onJoin={() => navigate(`/call/${call.id}`)}
              onEnd={() => requestEnd(call)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
