import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import SecuritySetupPage from './pages/SecuritySetupPage.tsx'
import DashboardPage from './pages/DashboardPage'
import VotePage from './pages/VotePage'
import AboutPage from './pages/AboutPage'
import UsbTokenTestPage from './pages/UsbTokenTestPage'
import ProfileSettingsPage from './pages/ProfileSettingsPage'
import ResultsPage from './pages/ResultsPage'
import UserSecurityLogPage from './pages/UserSecurityLogPage'
import HealthMonitor from './components/HealthMonitor'
import Nav from './components/Nav'
import EncryptedMessagesPage from './pages/EncryptedMessagesPage'
import AuthGuard from './components/AuthGuard'
import { FailedAttemptsProvider } from './hooks/useAuthSecurity'
import { AuthProvider } from './hooks/useAuthSession'
import { Home, Info, LayoutDashboard, Vote, Mail, Settings } from 'lucide-react'

/* Ikon navbar (lucide, outline: tengah kosong) — ukuran & ketebalan seragam */
const navIcon = { size: 18, strokeWidth: 1.5 }

/** Alias lama /register → /daftar, dengan query (?undangan=...) tetap dibawa */
function RegisterRedirect() {
  const location = useLocation()
  return <Navigate to={`/daftar${location.search}`} replace />
}

/** Protected routes wrapper */
function ProtectedRoutes() {
  return (
    <Routes>
      <Route path="/dasbor"     element={<DashboardPage />} />
      <Route path="/dashboard"  element={<Navigate to="/dasbor" replace />} />
      <Route path="/pilih"           element={<VotePage />} />
      <Route path="/hasil/:id"       element={<ResultsPage />} />
      <Route path="/pengaturan"      element={<ProfileSettingsPage />} />
      <Route path="/usb-token-test"  element={<UsbTokenTestPage />} />
      <Route path="/pesan-terenkripsi" element={<EncryptedMessagesPage />} />
    </Routes>
  )
}

const PUBLIC_LINKS = [
  { href: '/', label: 'Beranda', icon: <Home {...navIcon} /> },
  { href: '/tentang', label: 'Tentang', icon: <Info {...navIcon} /> },
]

const PROTECTED_LINKS = [
  { href: '/dasbor', label: 'Dasbor', icon: <LayoutDashboard {...navIcon} /> },
  { href: '/pilih', label: 'Pemilihan', icon: <Vote {...navIcon} /> },
  { href: '/pesan-terenkripsi', label: 'Pesan Terenkripsi', icon: <Mail {...navIcon} /> },
  { href: '/pengaturan', label: 'Pengaturan', icon: <Settings {...navIcon} /> },
]

function AppRoutes() {
  const location = useLocation()
  const isProtected =
    location.pathname.startsWith('/dasbor') ||
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/pilih') ||
    location.pathname.startsWith('/hasil') ||
    location.pathname.startsWith('/pesan-terenkripsi') ||
    location.pathname.startsWith('/pengaturan') ||
    location.pathname.startsWith('/usb-token-test') ||
    location.pathname.startsWith('/log-keamanan')

  const navLinks = isProtected ? PROTECTED_LINKS : PUBLIC_LINKS

  const isLoginPage =
    location.pathname.startsWith('/masuk') ||
    location.pathname.startsWith('/login')

  return (
    <>
      {!isLoginPage && <Nav links={navLinks} />}
      <Routes>
        <Route path="/"           element={<LandingPage />} />
        <Route path="/tentang"    element={<AboutPage />} />
        <Route path="/masuk"      element={<LoginPage />} />
        <Route path="/login"      element={<Navigate to="/masuk" replace />} />
        <Route path="/daftar"     element={<RegisterPage />} />
        <Route path="/register"   element={<RegisterRedirect />} />
        <Route path="/atur-keamanan" element={<SecuritySetupPage />} />
        
        {/* Protected routes - require Windows Hello or Dongle setup */}
        <Route element={<AuthGuard />}>
          <Route path="/dasbor"     element={<DashboardPage />} />
          <Route path="/dashboard"  element={<Navigate to="/dasbor" replace />} />
          <Route path="/pilih"           element={<VotePage />} />
          <Route path="/hasil/:id"       element={<ResultsPage />} />
          <Route path="/pengaturan"      element={<ProfileSettingsPage />} />
          <Route path="/usb-token-test"  element={<UsbTokenTestPage />} />
          <Route path="/pesan-terenkripsi" element={<EncryptedMessagesPage />} />
          <Route path="/log-keamanan/:userId" element={<UserSecurityLogPage />} />
        </Route>
        
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FailedAttemptsProvider>
          <HealthMonitor />
          <AppRoutes />
        </FailedAttemptsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App