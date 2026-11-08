import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import VotePage from './pages/VotePage'
import AboutPage from './pages/AboutPage'
import UsbTokenTestPage from './pages/UsbTokenTestPage'
import ProfileSettingsPage from './pages/ProfileSettingsPage'
import HealthMonitor from './components/HealthMonitor'
import Nav from './components/Nav'

/** Alias lama /register → /daftar, dengan query (?undangan=...) tetap dibawa */
function RegisterRedirect() {
  const location = useLocation()
  return <Navigate to={`/daftar${location.search}`} replace />
}

function AppRoutes() {
  const location = useLocation()
  const isAppPage =
    location.pathname.startsWith('/dasbor') ||
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/pilih') ||
    location.pathname.startsWith('/pengaturan') ||
    location.pathname.startsWith('/usb-token-test') ||
    location.pathname.startsWith('/masuk') ||
    location.pathname.startsWith('/daftar')

  return (
    <>
      {!isAppPage && <Nav />}
      <Routes>
        <Route path="/"           element={<LandingPage />} />
        <Route path="/tentang"    element={<AboutPage />} />
        <Route path="/masuk"      element={<LoginPage />} />
        <Route path="/login"      element={<Navigate to="/masuk" replace />} />
        <Route path="/daftar"     element={<RegisterPage />} />
        <Route path="/register"   element={<RegisterRedirect />} />
        <Route path="/dasbor"     element={<DashboardPage />} />
        <Route path="/dashboard"  element={<Navigate to="/dasbor" replace />} />
        <Route path="/pilih"           element={<VotePage />} />
        <Route path="/pengaturan"      element={<ProfileSettingsPage />} />
        <Route path="/usb-token-test"  element={<UsbTokenTestPage />} />
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <HealthMonitor />
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
