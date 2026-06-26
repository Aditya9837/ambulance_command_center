import { useEffect, useState } from 'react'
import { MapPin, Phone } from 'lucide-react'
import { api } from '../lib/api'
import { statusColors, cn } from '../lib/utils'
import type { Ambulance } from '../types'

export default function AmbulancesPage() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])

  useEffect(() => {
    api.getAmbulances().then(setAmbulances)
  }, [])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Ambulance Fleet</h1>
        <p className="text-sm text-slate-400 mt-1">Track and manage all ambulance units</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ambulances.map((amb) => (
          <div
            key={amb.id}
            className="bg-[#1a2332] rounded-2xl border border-slate-700/50 p-5 animate-fade-in hover:border-slate-600/50 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{amb.vehicle_id}</p>
                  <p className="text-xs text-slate-400">{amb.name}</p>
                </div>
              </div>
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium uppercase', statusColors[amb.status])}>
                {amb.status.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Paramedic</span>
                <span className="text-slate-300">{amb.paramedic_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone</span>
                <span className="text-slate-300">{amb.paramedic_phone || '—'}</span>
              </div>
              {amb.latitude && amb.longitude && (
                <div className="flex items-center gap-1.5 text-slate-400 pt-2 border-t border-slate-700/50">
                  <MapPin className="w-3 h-3" />
                  <span>{amb.latitude.toFixed(4)}, {amb.longitude.toFixed(4)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
