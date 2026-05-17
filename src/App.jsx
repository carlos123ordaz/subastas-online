import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/Login'
import Bidder from './components/Bidder'
import Winner from './components/Winner'
import Overlay from './components/Overlay'
import Admin from './components/Admin'
import AdminDashboard from './components/AdminDashboard'
import AuctionList from './components/AuctionList'
import Monitor from './components/Monitor'

function Spinner() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--ms-bg-0)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{
        width: 40, height: 40,
        border: '3px solid var(--ms-magenta)', borderTopColor: 'transparent',
        borderRadius: '50%', animation: 'ms-spin 0.7s linear infinite',
      }} />
      <span style={{ color: 'var(--ms-ink-mute)', fontSize: 13 }}>Cargando MichiStore...</span>
    </div>
  )
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && profile?.role !== 'admin') return <Navigate to="/live" replace />
  return children
}

function RootRedirect() {
  const { user, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/live" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"              element={<Login />} />
      <Route path="/overlay/:lotId"     element={<Overlay />} />
      <Route path="/monitor/:lotId"     element={<Monitor />} />
      <Route path="/"                   element={<RootRedirect />} />
      <Route path="/live"               element={<ProtectedRoute><AuctionList /></ProtectedRoute>} />
      <Route path="/live/:lotId"        element={<ProtectedRoute><Bidder /></ProtectedRoute>} />
      <Route path="/winner/:lotId"      element={<ProtectedRoute><Winner /></ProtectedRoute>} />
      <Route path="/admin"              element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/auction/:auctionId" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
      <Route path="*"                   element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
