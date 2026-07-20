import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIncomingCallRing } from '../hooks/useIncomingCallRing'
import IncomingCallPopup from './IncomingCallPopup'
import Sidebar from './Sidebar'

function LayoutShell() {
  const { isConnected, waitingCalls, dismissCall } = useIncomingCallRing()
  return (
    <div className="flex min-h-screen bg-[#0b1120]">
      <Sidebar />
      <main className="flex-1 overflow-auto flex flex-col">
        {!isConnected && (
          <div className="bg-amber-950/80 border-b border-amber-800/60 text-amber-200 px-4 py-2.5 text-sm text-center font-medium animate-pulse flex items-center justify-center gap-2 z-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Reconnecting to Server... Some features might be temporarily unavailable.
          </div>
        )}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      <IncomingCallPopup calls={waitingCalls} onDismiss={dismissCall} />
    </div>
  )
}

export default function Layout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1120]">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <LayoutShell />
}
