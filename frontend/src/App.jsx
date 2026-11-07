import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import VotePage from './pages/VotePage'
import HealthMonitor from './components/HealthMonitor'

/** Alias lama /register → /daftar, dengan query (?undangan=...) tetap dibawa */
function RegisterRedirect() {
  const location = useLocation()
  return <Navigate to={`/daftar${location.search}`} replace />
}

function App() {
  return (
    <BrowserRouter>
      <HealthMonitor />
      <Routes>
        <Route path="/"           element={<LandingPage />} />
        <Route path="/masuk"      element={<LoginPage />} />
        <Route path="/login"      element={<Navigate to="/masuk" replace />} />
        <Route path="/daftar"     element={<RegisterPage />} />
        <Route path="/register"   element={<RegisterRedirect />} />
        <Route path="/dasbor"     element={<DashboardPage />} />
        <Route path="/dashboard"  element={<Navigate to="/dasbor" replace />} />
        <Route path="/pilih"      element={<VotePage />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
