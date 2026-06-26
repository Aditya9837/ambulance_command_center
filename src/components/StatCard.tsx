import { cn } from '../lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: 'cyan' | 'green' | 'amber' | 'red' | 'blue'
  icon?: React.ReactNode
}

const colorMap = {
  cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
  green: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
  amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-400',
  red: 'from-red-500/20 to-red-600/5 border-red-500/20 text-red-400',
  blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400',
}

export default function StatCard({ label, value, sub, color = 'cyan', icon }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-gradient-to-br p-5 animate-fade-in',
        colorMap[color],
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        {icon && <div className="opacity-60">{icon}</div>}
      </div>
    </div>
  )
}
