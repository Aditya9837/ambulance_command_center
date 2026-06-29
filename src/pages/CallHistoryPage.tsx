import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileText, History } from 'lucide-react'
import { api } from '../lib/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { downloadCsv, formatDate, stripHtml } from '../lib/exportCalls'
import { cn, priorityColors } from '../lib/utils'
import type { CallSession } from '../types'

const PAGE_SIZE = 20

export default function CallHistoryPage() {
  const [calls, setCalls] = useState<CallSession[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState<CallSession | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const loadFirstPage = useCallback(async () => {
    setLoading(true)
    try {
      const page = await api.getCallHistory({ limit: PAGE_SIZE })
      setCalls(page.items)
      setNextCursor(page.next_cursor)
      setHasMore(page.has_more)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await api.getCallHistory({ limit: PAGE_SIZE, cursor: nextCursor })
      setCalls((prev) => [...prev, ...page.items])
      setNextCursor(page.next_cursor)
      setHasMore(page.has_more)
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, nextCursor, loadingMore])

  useEffect(() => {
    void loadFirstPage()
  }, [loadFirstPage])

  useWebSocket(
    useCallback(
      (msg) => {
        if (['call_ended', 'call_updated', 'prescription_added'].includes(msg.type as string)) {
          void loadFirstPage()
        }
      },
      [loadFirstPage],
    ),
  )

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const handleExport = async () => {
    setExporting(true)
    try {
      const all = await api.getAllCallHistory(PAGE_SIZE)
      downloadCsv(all)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-7 h-7 text-cyan-400" />
            Call History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Past consultations with saved prescriptions
          </p>
        </div>
        <button
          onClick={() => void handleExport()}
          disabled={calls.length === 0 || exporting}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : calls.length === 0 ? (
        <div className="text-center py-20 bg-[#1a2332] rounded-2xl border border-slate-700/50">
          <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No call history yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <button
              key={call.id}
              type="button"
              onClick={() => setSelected(call)}
              className="w-full text-left rounded-2xl border border-slate-700/50 bg-[#1a2332] p-4 hover:border-slate-600/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {call.ambulance?.vehicle_id ?? `Call #${call.id}`} — {call.ambulance?.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(call.ended_at ?? call.created_at)}
                    {call.doctor?.full_name ? ` • Dr. ${call.doctor.full_name}` : ''}
                  </p>
                  {call.patient_info && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{call.patient_info}</p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase',
                      priorityColors[call.priority],
                    )}
                  >
                    {call.priority}
                  </span>
                  {call.notes ? (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Prescription
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">No prescription</span>
                  )}
                </div>
              </div>
              {call.notes && (
                <p className="text-xs text-slate-400 mt-2 line-clamp-2 border-t border-slate-700/40 pt-2">
                  {stripHtml(call.notes)}
                </p>
              )}
            </button>
          ))}

          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-6">
              {loadingMore ? (
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  className="px-4 py-2 text-sm text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/10"
                >
                  Load more
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-slate-700/60 bg-[#141c2b] shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-700/50 shrink-0">
              <h2 className="text-base font-semibold text-white">
                Call #{selected.id} — {selected.ambulance?.vehicle_id}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatDate(selected.ended_at ?? selected.created_at)}
              </p>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {selected.patient_info && (
                <div>
                  <p className="text-[10px] uppercase text-slate-500 mb-1">Patient</p>
                  <p className="text-sm text-slate-300">{selected.patient_info}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">Prescription</p>
                {selected.notes ? (
                  <div
                    className="text-sm text-slate-200 prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selected.notes }}
                  />
                ) : (
                  <p className="text-sm text-slate-500">No prescription was added for this call.</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-slate-700/50 shrink-0">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
