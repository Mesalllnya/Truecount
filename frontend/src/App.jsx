import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
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
import UserProfilePage from './pages/UserProfilePage'
import HealthMonitor from './components/HealthMonitor'
import Nav from './components/Nav'
import EncryptedMessagesPage from './pages/EncryptedMessagesPage'
import ServerErrorPage from './pages/ServerErrorPage'
import DevPage from './pages/DevPage'
import RoleGuard from './components/RoleGuard'
import AuthGuard from './components/AuthGuard'
import { useAuth } from './hooks/useAuthSession'
import ClientConfigPage from './pages/ClientConfigPage'
import { FailedAttemptsProvider, stopAllCameraStreams } from './hooks/useAuthSecurity'
import { AuthProvider } from './hooks/useAuthSession'
import { Home, Info, LayoutDashboard, Vote, MessageCircle, Code2 } from 'lucide-react'

/* Ikon navbar (lucide, outline: tengah kosong) — ukuran & ketebalan seragam */
const navIcon = { size: 18, strokeWidth: 1.5 }

/** Alias lama /register → /daftar, dengan query (?undangan=...) tetap dibawa */
function RegisterRedirect() {
  const location = useLocation()
  return <Navigate to={`/daftar${location.search}`} replace />
}

/**
 * Akses tersembunyi ke halaman koneksi server.
 * - Shortcut: Ctrl + Shift + Alt + S (berfungsi di route mana pun)
 * - Console: __tcServerConfig()
 * Tidak ada tombol/link di navigasi, sesuai rencana demo.
 */
let serverHintLogged = false

function ServerConfigShortcut() {
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!event.ctrlKey || !event.shiftKey || !event.altKey) return
      if (event.key.toLowerCase() !== 's') return
      event.preventDefault()
      navigate('/__server')
    }

    window.addEventListener('keydown', onKeyDown)
    window.__tcServerConfig = () => navigate('/__server')
    if (import.meta.env.DEV && !serverHintLogged) {
      serverHintLogged = true
      console.info(
        '[TrueCount] Koneksi server: Ctrl+Shift+Alt+S atau jalankan __tcServerConfig() di console.',
      )
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      delete window.__tcServerConfig
    }
  }, [navigate])

  return null
}

/**
 * Jaminan kamera HANYA hidup di halaman masuk (/masuk).
 * Setiap kali route berubah ke selain /masuk — landing page, halaman setelah
 * login, pengaturan, dll. — semua stream kamera dipaksa mati (LED ikut mati).
 */
function CameraRouteGuard() {
  const location = useLocation()
  const isLoginRoute =
    location.pathname.startsWith('/masuk') ||
    location.pathname.startsWith('/login')

  useEffect(() => {
    if (!isLoginRoute) stopAllCameraStreams()
  }, [isLoginRoute, location.pathname])

  return null
}

/** Voting (/pilih) hanya untuk user (voter/dev) — admin tidak punya hak suara,
 *  jadi halaman ini tidak ada untuk admin: dialihkan ke dasbor. */
function VoterOnly({ children }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  return user?.role === 'admin' ? <Navigate to="/dasbor" replace /> : children
}

const PUBLIC_LINKS = [
  { href: '/', label: 'Beranda', icon: <Home {...navIcon} /> },
  { href: '/tentang', label: 'Tentang', icon: <Info {...navIcon} /> },
]

/* Menu tengah setelah login. "Pengaturan" sengaja TIDAK ada di sini —
   aksesnya lewat menu akun (profile) di kanan navbar. */
const PROTECTED_LINKS = [
  { href: '/dasbor', label: 'Dasbor', icon: <LayoutDashboard {...navIcon} /> },
  { href: '/pilih', label: 'Pemilihan', icon: <Vote {...navIcon} /> },
  { href: '/pesan-terenkripsi', label: 'Pesan Terenkripsi', icon: <MessageCircle {...navIcon} /> },
]

function AppRoutes() {
  const location = useLocation()
  const { user } = useAuth()
  const isDevOrAdmin = user && (user.role === 'admin' || user.role === 'dev')
  const isProtected =
    location.pathname.startsWith('/dasbor') ||
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/pilih') ||
    location.pathname.startsWith('/hasil') ||
    location.pathname.startsWith('/pesan-terenkripsi') ||
    location.pathname.startsWith('/pesan-suara') ||
    location.pathname.startsWith('/pengaturan') ||
    location.pathname.startsWith('/usb-token-test') ||
    location.pathname.startsWith('/log-keamanan') ||
    location.pathname.startsWith('/dev')

  const navLinks = isProtected ? PROTECTED_LINKS : PUBLIC_LINKS

  /* "Pemilihan" (voting) hanya untuk user/voter — admin tidak punya hak suara,
     jadi tombolnya tidak tampil di navbar admin. */
  const visibleLinks = navLinks.filter((link) =>
    link.href !== '/pilih' || user?.role !== 'admin'
  )

  /* Link Dev hanya di halaman terlindungi (setelah login di dalam app) —
     di landing/halaman publik tidak ditampilkan meski akun sudah login. */
  const devLink = isDevOrAdmin && isProtected
    ? { href: '/dev', label: 'Dev', icon: <Code2 {...navIcon} /> }
    : null

  /* Halaman auth (masuk/daftar) memakai chrome sendiri (auth-brand:
     tombol kembali + logo) — jangan tumpuk dengan navbar global. */
  const isAuthPage =
    location.pathname.startsWith('/masuk') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/daftar') ||
    location.pathname.startsWith('/register')
  const isConfigPage = location.pathname.startsWith('/__server')

  return (
    <>
      <CameraRouteGuard />
      <ServerConfigShortcut />
      {!isAuthPage && !isConfigPage && <Nav links={[...visibleLinks, devLink].filter(Boolean)} />}
      <Routes>
        <Route path="/"           element={<LandingPage />} />
        <Route path="/__server"   element={<ClientConfigPage />} />
        <Route path="/tentang"    element={<AboutPage />} />
        <Route path="/masuk"      element={<LoginPage />} />
        <Route path="/login"      element={<Navigate to="/masuk" replace />} />
        <Route path="/daftar"     element={<RegisterPage />} />
        <Route path="/register"   element={<RegisterRedirect />} />
        <Route path="/atur-keamanan" element={<SecuritySetupPage />} />
        <Route path="/server-error" element={<ServerErrorPage />} />
        
        {/* Protected routes - require Windows Hello or Dongle setup */}
        <Route element={<AuthGuard />}>
          {/* Alias lama halaman pesan suara → tab Pesan Suara */}
          <Route
            path="/pesan-suara"
            element={<Navigate to="/pesan-terenkripsi?tab=suara" replace />}
          />
          <Route path="/dasbor"     element={<DashboardPage />} />
          <Route path="/dashboard"  element={<Navigate to="/dasbor" replace />} />
          {/* Pemilihan (voting) hanya untuk user — admin tidak punya hak suara */}
          <Route
            path="/pilih"
            element={
              <VoterOnly>
                <VotePage />
              </VoterOnly>
            }
          />
          <Route path="/hasil/:id"       element={<ResultsPage />} />
          <Route path="/pengaturan"      element={<ProfileSettingsPage />} />
          <Route path="/profil/:userId?"   element={<UserProfilePage />} />
          <Route path="/usb-token-test"  element={<UsbTokenTestPage />} />
          <Route path="/pesan-terenkripsi" element={<EncryptedMessagesPage />} />
          <Route path="/log-keamanan/:userId" element={<UserSecurityLogPage />} />
          {/* Dev page - hanya admin & dev */}
          <Route element={<RoleGuard allowedRoles={['admin', 'dev']} />}>
            <Route path="/dev" element={<DevPage />} />
          </Route>
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