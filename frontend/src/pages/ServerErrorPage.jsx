import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

const HEALTH_URL = 'http://localhost:8000/health'
const POLL_INTERVAL = 3000 // 3 detik

export default function ServerErrorPage() {
  // useNavigate hanya valid di dalam <Router>. Kalau ternyata tidak tersedia
  // (mis. render di luar Router / module HMR yang stale), fall back ke
  // window.location agar halaman tetap bisa navigasi tanpa crash.
  const navigate = useNavigate()
  const navigateFallback = useCallback((to) => {
    try {
      navigate(to)
    } catch {
      window.location.assign(to)
    }
  }, [navigate])

  const [checking, setChecking] = useState(false)
  const [dbDown, setDbDown] = useState(false)

  // ── Cek apakah server sudah kembali online ──────────────────
  useEffect(() => {
    let cancelled = false
    let intervalId

    const pollHealth = async () => {
      setChecking(true)
      try {
        const res = await fetch(HEALTH_URL, { method: 'GET' })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            setDbDown(data.status === 'degraded')
            if (data.status === 'ok') {
              // Server + database sudah online → kembali ke halaman login
              navigateFallback('/masuk')
            }
          }
        }
      } catch {
        // Server tidak bisa dihubungi sama sekali
        if (!cancelled) setDbDown(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    pollHealth() // cek segera saat halaman dibuka
    intervalId = window.setInterval(pollHealth, POLL_INTERVAL) // coba ulang setiap 3 detik

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [navigateFallback])

  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <button
          type="button"
          className="back-btn"
          onClick={() => navigateFallback('/')}
          aria-label="Kembali ke beranda"
          title="Kembali"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3.5 5.5 8 10 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <h1>Server Tidak Respons</h1>
          <p>TrueCount tidak dapat terhubung ke server saat ini.</p>
        </div>

        <div className="auth-state">
          <div className="auth-state-icon auth-state-icon--error" aria-hidden="true">
            <AlertCircle size={28} strokeWidth={2} />
          </div>
          {dbDown ? (
            <>
              <h1>Database Tidak Tersedia</h1>
              <p>
                Server bisa dihubungi tetapi tidak dapat terhubung ke database.
                Kemungkinan database sedang dalam pemeliharaan atau mati.
                Halaman akan otomatis kembali ke login saat database sudah
                hidup lagi.
              </p>
            </>
          ) : (
            <>
              <h1>Koneksi server gagal</h1>
              <p>
                Aplikasi tidak bisa menjangkau backend server. Kemungkinan besar
                server sedang dalam pemeliharaan atau mati. Halaman akan
                otomatis kembali ke login saat server sudah hidup lagi.
              </p>
            </>
          )}
          {checking && (
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              <RefreshCw size={14} strokeWidth={2} className="spinner" /> Memeriksa server…
            </p>
          )}
          <div className="auth-state-cta" style={{ display: 'flex', gap: '0.75rem', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn-submit"
              onClick={handleRetry}
              disabled={checking}
            >
              <RefreshCw size={16} strokeWidth={2} /> Coba Lagi
            </button>
            <button
              type="button"
              className="btn-submit--secondary"
              onClick={() => navigateFallback('/')}
            >
              <Home size={16} strokeWidth={2} /> Beranda
            </button>
          </div>
        </div>
      </div>

      <div className="auth-mosaic" aria-hidden="true" />
    </div>
  )
}
