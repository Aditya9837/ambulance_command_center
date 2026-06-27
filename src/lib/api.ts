const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api'

class ApiClient {
  private token: string | null = localStorage.getItem('token')

  setToken(token: string | null) {
    this.token = token
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }

  getToken() {
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

  getCallHistory() {
    return this.request<import('../types').CallSession[]>('/calls/history')
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
    const params = notes ? `?notes=${encodeURIComponent(notes)}` : ''
    return this.request<import('../types').CallSession>(`/calls/${callId}/end${params}`, { method: 'POST' })
  }
}

export const api = new ApiClient()
