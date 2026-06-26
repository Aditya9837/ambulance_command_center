import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function formatDuration(start: string | null) {
  if (!start) return '0:00'
  const diff = Date.now() - new Date(start).getTime()
  const mins = Math.floor(diff / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const priorityColors: Record<string, string> = {
  low: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  medium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  high: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30 animate-pulse-ring',
}

export const statusColors: Record<string, string> = {
  available: 'bg-emerald-500/20 text-emerald-400',
  on_call: 'bg-cyan-500/20 text-cyan-400',
  en_route: 'bg-amber-500/20 text-amber-400',
  offline: 'bg-slate-500/20 text-slate-400',
  maintenance: 'bg-orange-500/20 text-orange-400',
  waiting: 'bg-amber-500/20 text-amber-400',
  active: 'bg-emerald-500/20 text-emerald-400',
  ended: 'bg-slate-500/20 text-slate-400',
  missed: 'bg-red-500/20 text-red-400',
}
