import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuthSession'

/**
 * RoleGuard - Batasi akses route hanya untuk role yang diizinkan.
 *
 * Usage di App.jsx:
 * <Route element={<RoleGuard allowedRoles={['admin', 'dev']} />}>
 *   <Route path="/dev" element={<DevPage />} />
 * </Route>
 *
 * Jika user belum login / role tidak cocok → redirect ke /masuk.
 * Jika loading → tampilkan indikator.
 */
export default function RoleGuard({ allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  while (isLoading) {
    return (
      <div className="auth-shell" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="auth-card" style={{ maxWidth: '320px', textAlign: 'center' }}>
          <div className="auth-state-spinner" />
          <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>Memeriksa hak akses…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/masuk" replace state={{ returnTo: location.pathname }} />
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="auth-shell" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="auth-card" style={{ maxWidth: '360px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Akses Ditolak</h2>
          <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>
            Halaman ini hanya dapat diakses oleh {allowedRoles.join(' dan ')}.
          </p>
          <p style={{ color: 'var(--muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Role Anda saat ini: <strong>{user.role}</strong>
          </p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
