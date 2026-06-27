import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ambulance, Phone, Users, Activity, AlertTriangle } from 'lucide-react'
import StatCard from '../components/StatCard'
import CallCard from '../components/CallCard'
import { api } from '../lib/api'
import { useWebSocket } from '../hooks/useWebSocket'
import type { CallSession, DashboardStats } from '../types'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [calls, setCalls] = useState<CallSession[]>([])

  const refresh = useCallback(async () => {
    const [s, c] = await Promise.all([api.getStats(), api.getActiveCalls()])
    setStats(s)
    setCalls(c)
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([api.getStats(), api.getActiveCalls()]).then(([s, c]) => {
      if (active) {
        setStats(s)
        setCalls(c)
      }
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

  const handleAccept = async (callId: number) => {
    await api.acceptCall(callId)
    navigate(`/call/${callId}`)
  }

  const waitingCalls = calls.filter((c) => c.status === 'waiting')
  const activeCalls = calls.filter((c) => c.status === 'active')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Command Center Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Real-time overview of all ambulance consultations</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active Calls"
            value={`${stats.active_calls}/${stats.max_concurrent_calls}`}
            sub={`${stats.capacity_used_percent}% capacity used`}
            color="cyan"
            icon={<Phone className="w-8 h-8" />}
          />
          <StatCard
            label="Waiting Queue"
            value={stats.waiting_calls}
            sub="Calls awaiting doctor"
            color="amber"
            icon={<AlertTriangle className="w-8 h-8" />}
          />
          <StatCard
            label="Ambulances"
            value={`${stats.available_ambulances}/${stats.total_ambulances}`}
            sub="Available units"
            color="green"
            icon={<Ambulance className="w-8 h-8" />}
          />
          <StatCard
            label="Doctors Online"
            value={stats.total_doctors}
            sub="Active physicians"
            color="blue"
            icon={<Users className="w-8 h-8" />}
          />
        </div>
      )}

      {stats && (
        <div className="mb-8 bg-[#1a2332] rounded-2xl border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">System Capacity</span>
            </div>
            <span className="text-xs text-slate-400">
              {stats.active_calls + stats.waiting_calls} / {stats.max_concurrent_calls} calls
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(stats.capacity_used_percent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {waitingCalls.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            Incoming Calls ({waitingCalls.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {waitingCalls.map((call) => (
              <CallCard key={call.id} call={call} onAccept={() => handleAccept(call.id)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full" />
          Active Consultations ({activeCalls.length})
        </h2>
        {activeCalls.length === 0 ? (
          <div className="text-center py-16 bg-[#1a2332] rounded-2xl border border-slate-700/50">
            <Phone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No active calls right now</p>
            <p className="text-xs text-slate-500 mt-1">Incoming calls will appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeCalls.map((call) => (
              <CallCard
                key={call.id}
                call={call}
                onJoin={() => navigate(`/call/${call.id}`)}
                onEnd={async () => { await api.endCall(call.id); refresh() }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
