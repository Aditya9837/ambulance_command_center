import { useState } from 'react'
import EndCallModal from '../components/EndCallModal'
import { api } from '../lib/api'
import type { CallSession } from '../types'

interface PendingEndCall {
  call: CallSession
  mode: 'end' | 'prescription'
}

export function useEndCallFlow(onComplete?: () => void) {
  const [pending, setPending] = useState<PendingEndCall | null>(null)

  const requestEnd = (call: CallSession) => {
    setPending({ call, mode: 'end' })
  }

  const requestPrescription = (call: CallSession) => {
    setPending({ call, mode: 'prescription' })
  }

  const handleConfirm = async (notes: string | null) => {
    if (!pending) return
    const { call, mode } = pending

    if (mode === 'end') {
      await api.endCall(call.id, notes ?? undefined)
    } else if (notes) {
      await api.savePrescription(call.id, notes)
    }

    setPending(null)
    onComplete?.()
  }

  const handleCancel = () => {
    setPending(null)
    onComplete?.()
  }

  const modal = pending ? (
    <EndCallModal
      mode={pending.mode}
      ambulanceLabel={`${pending.call.ambulance?.vehicle_id ?? 'Call'} — ${pending.call.ambulance?.name ?? ''}`}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null

  return { requestEnd, requestPrescription, modal }
}
