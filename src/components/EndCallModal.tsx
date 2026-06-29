import { useState } from 'react'
import { X } from 'lucide-react'
import SimpleRichTextEditor from './SimpleRichTextEditor'

export type PrescriptionModalMode = 'end' | 'prescription'

interface EndCallModalProps {
  ambulanceLabel: string
  mode?: PrescriptionModalMode
  onConfirm: (prescriptionHtml: string | null) => void | Promise<void>
  onCancel: () => void
}

function isEmptyHtml(html: string) {
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return text.length === 0
}

export default function EndCallModal({
  ambulanceLabel,
  mode = 'end',
  onConfirm,
  onCancel,
}: EndCallModalProps) {
  const [prescription, setPrescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isPostCall = mode === 'prescription'

  const handleSubmit = async (withPrescription: boolean) => {
    setSubmitting(true)
    try {
      const notes = withPrescription && !isEmptyHtml(prescription) ? prescription : null
      await onConfirm(notes)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700/60 bg-[#141c2b] shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
          <div>
            <h2 className="text-base font-semibold text-white">
              {isPostCall ? 'Add prescription' : 'End call'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{ambulanceLabel}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-400">
            {isPostCall
              ? 'Call has ended. Add a prescription for the paramedic — it will appear on the ambulance tablet.'
              : 'Add a prescription for the paramedic. It will appear on the ambulance tablet after the call ends.'}
          </p>
          <SimpleRichTextEditor onChange={setPrescription} />
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={() => void handleSubmit(false)}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-800/60 disabled:opacity-50"
          >
            {isPostCall ? 'Skip' : 'End without prescription'}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit(true)}
            disabled={submitting || isEmptyHtml(prescription)}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting
              ? 'Saving...'
              : isPostCall
                ? 'Send prescription'
                : 'Send prescription & end'}
          </button>
        </div>
      </div>
    </div>
  )
}
