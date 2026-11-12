import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthGuard } from '../hooks/useAuthSecurity.tsx';

/**
 * AuthGuard - Protects routes that require security setup (Windows Hello or Dongle)
 * 
 * Usage in App.jsx:
 * <Route element={<AuthGuard />}>
 *   <Route path="/dasbor" element={<DashboardPage />} />
 *   <Route path="/pilih" element={<VotePage />} />
 *   ...
 * </Route>
 */
export default function AuthGuard() {
  const location = useLocation();
  const { canAccess, isLoading, status, refetch } = useAuthGuard();

  // Refetch on mount and when returning from setup page
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Show loading while checking
  if (isLoading) {
    return (
      <div className="auth-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="auth-card" style={{ maxWidth: '320px', textAlign: 'center' }}>
          <div className="auth-state-spinner" />
          <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>Memeriksa keamanan akun…</p>
        </div>
      </div>
    );
  }

  // If user has no security setup, redirect to setup page
  if (status && status.requiresSetup && !canAccess) {
    // Preserve the intended destination
    return <Navigate to="/atur-keamanan" replace state={{ returnTo: location.pathname + location.search }} />;
  }

  // Allow access
  return <Outlet />;
}