export type UserRole = 'admin' | 'doctor' | 'paramedic'
export type AmbulanceStatus = 'available' | 'on_call' | 'en_route' | 'offline' | 'maintenance'
export type CallStatus = 'waiting' | 'active' | 'ended' | 'missed'
export type CallPriority = 'low' | 'medium' | 'high' | 'critical'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  specialty?: string
  is_active: boolean
  created_at: string
}

export interface Ambulance {
  id: number
  vehicle_id: string
  name: string
  status: AmbulanceStatus
  latitude: number | null
  longitude: number | null
  last_location_update: string | null
  paramedic_name: string | null
  paramedic_phone: string | null
  created_at: string
}

export interface CallSession {
  id: number
  room_id: string
  status: CallStatus
  priority: CallPriority
  patient_info: string | null
  notes: string | null
  ambulance_id: number
  doctor_id: number | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  ambulance?: Ambulance
  doctor?: User
}

export interface DashboardStats {
  total_ambulances: number
  available_ambulances: number
  active_calls: number
  waiting_calls: number
  total_doctors: number
  max_concurrent_calls: number
  capacity_used_percent: number
}
