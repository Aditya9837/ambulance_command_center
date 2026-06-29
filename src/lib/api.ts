const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api'

class ApiClient {
  private token: string | null = localStorage.getItem('token')

  setToken(token: string | null) {
    this.token = token
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }

  getToken() {
    this.token = localStorage.getItem('token')
    return this.token
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    if (res.status === 401) {
      this.setToken(null)
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(err.detail || 'Request failed')
    }
    return res.json()
  }

  login(email: string, password: string) {
    return this.request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  getMe() {
    return this.request<import('../types').User>('/auth/me')
  }

  getStats() {
    return this.request<import('../types').DashboardStats>('/calls/stats')
  }

  getActiveCalls() {
    return this.request<import('../types').CallSession[]>('/calls/active')
  }

  getCallHistory(params?: { limit?: number; cursor?: string | null }) {
    const search = new URLSearchParams()
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.cursor) search.set('cursor', params.cursor)
    const qs = search.toString()
    return this.request<import('../types').CallHistoryPage>(
      `/calls/history${qs ? `?${qs}` : ''}`,
    )
  }

  async getAllCallHistory(pageSize = 50) {
    const all: import('../types').CallSession[] = []
    let cursor: string | null = null
    for (;;) {
      const page = await this.getCallHistory({ limit: pageSize, cursor })
      all.push(...page.items)
      if (!page.has_more || !page.next_cursor) break
      cursor = page.next_cursor
    }
    return all
  }

  savePrescription(callId: number, notes: string) {
    return this.request<import('../types').CallSession>(`/calls/${callId}/prescription`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    })
  }

  updateCall(callId: number, data: { notes?: string }) {
    return this.request<import('../types').CallSession>(`/calls/${callId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  getAmbulances() {
    return this.request<import('../types').Ambulance[]>('/ambulances')
  }

  createCall(data: { ambulance_id: number; priority: string; patient_info?: string }) {
    return this.request<import('../types').CallSession>('/calls', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  acceptCall(callId: number) {
    return this.request<import('../types').CallSession>(`/calls/${callId}/accept`, { method: 'POST' })
  }

  endCall(callId: number, notes?: string) {
    return this.request<import('../types').CallSession>(`/calls/${callId}/end`, {
      method: 'POST',
      body: notes ? JSON.stringify({ notes }) : undefined,
    })
  }
}

export const api = new ApiClient()
