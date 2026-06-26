import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const ALLOWED_ROLES = ['admin', 'doctor']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (api.getToken()) {
      api.getMe()
        .then((u) => {
          if (!ALLOWED_ROLES.includes(u.role)) {
            api.setToken(null)
            return
          }
          setUser(u)
        })
        .catch(() => api.setToken(null))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { access_token } = await api.login(email, password)
    api.setToken(access_token)
    const me = await api.getMe()
    if (!ALLOWED_ROLES.includes(me.role)) {
      api.setToken(null)
      throw new Error('This portal is for doctors and admins only. Use the Ambulance app to initiate calls.')
    }
    setUser(me)
  }

  const logout = () => {
    api.setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
