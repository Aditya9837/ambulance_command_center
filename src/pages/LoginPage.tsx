import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Heart, Phone, Ambulance as AmbulanceIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('doctor@hospital.com')
  const [password, setPassword] = useState('doctor123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#0b1120]">
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/40 via-[#0b1120] to-blue-900/40" />
        <div className="relative z-10 flex flex-col justify-center p-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Ambulance Command Center</h1>
              <p className="text-slate-400 text-sm">Enterprise Telemedicine Platform</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Real-time video consultations<br />for emergency care
          </h2>
          <p className="text-slate-400 max-w-md mb-8">
            Connect paramedics in ambulances with doctors at the command center.
            Support for up to 50 simultaneous video calls.
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-lg">
            {[
              { icon: Phone, label: '50 Concurrent Calls', color: 'text-cyan-400' },
              { icon: AmbulanceIcon, label: 'GPS Tracking', color: 'text-emerald-400' },
              { icon: Heart, label: 'HD Video', color: 'text-red-400' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <Icon className={`w-5 h-5 ${color} mb-2`} />
                <p className="text-xs text-slate-300 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Command Center</h1>
          </div>

          <div className="bg-[#1a2332] rounded-2xl border border-slate-700/50 p-8">
            <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-sm text-slate-400 mb-6">Doctor & admin portal — receive and manage ambulance calls</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <p className="text-xs text-slate-500 text-center mb-2">Demo Accounts</p>
              <div className="space-y-1 text-xs text-slate-400 text-center">
                <p>Doctor: doctor@hospital.com / doctor123</p>
                <p>Admin: admin@hospital.com / admin123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
