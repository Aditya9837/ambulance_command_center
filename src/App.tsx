import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CallsPage from './pages/CallsPage'
import AmbulancesPage from './pages/AmbulancesPage'
import CallHistoryPage from './pages/CallHistoryPage'
import VideoCallPage from './pages/VideoCallPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/call/:callId" element={<VideoCallPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/calls" element={<CallsPage />} />
            <Route path="/history" element={<CallHistoryPage />} />
            <Route path="/ambulances" element={<AmbulancesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
