import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import DashNav from '../components/DashNav'
import './DashboardPage.css'
import './UserSecurityLogPage.css'

const API_BASE = 'http://localhost:8000'

const METHOD_LABELS = { webauthn: 'Windows Hello', dongle: 'Dongle USB', password: 'Kata Sandi' }
const METHOD_COLORS = { webauthn: '#3468b0', dongle: '#2a7a3b', password: '#F13C35' }

/* ── Ikon ─────────────────────────────────────────────────── */
function ArrowLeftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M5 12l7 7M5 12l7-7" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/* ── Helper format waktu ──────────────────────────────────── */
function formatDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(String(iso).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

/* ── Komponen foto (fetch dengan token → blob URL) ─────────── */
function AttemptPhoto({ attemptId, onOpen }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    const token = localStorage.getItem('tc_token')
    fetch(`${API_BASE}/auth/attempts/${attemptId}/photo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('no-photo')
        return res.blob()
      })
      .then(blob => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attemptId])

  if (failed) {
    return (
      <span className="log-photo-empty" aria-hidden="true">
        <CameraIcon />
      </span>
    )
  }

  if (!url) {
    return <span className="log-photo-loading" aria-hidden="true" />
  }

  return (
    <button
      type="button"
      className="log-photo-btn"
      onClick={() => onOpen(url)}
      title="Perbesar foto"
      aria-label="Perbesar foto kamera"
    >
      <img src={url} alt="Foto kamera saat percobaan login" className="log-photo-img" />
    </button>
  )
}

/* ── Lightbox sederhana ───────────────────────────────────── */
function PhotoLightbox({ url, onClose }) {
  if (!url) return null
  return (
    <div className="log-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label="Foto kamera">
      <button className="log-lightbox-close" onClick={onClose} aria-label="Tutup">
        <CloseIcon />
      </button>
      <img src={url} alt="Foto kamera diperbesar" className="log-lightbox-img" onClick={e => e.stopPropagation()} />
    </div>
  )
}

/* ── Halaman utama ────────────────────────────────────────── */
export default function UserSecurityLogPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('tc_token')

  const [user, setUser] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Info user
      const userRes = await fetch(`${API_BASE}/users/search?id=${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const userData = await userRes.json()
      if (!userRes.ok) throw new Error(userData.error || 'Gagal memuat data pengguna.')
      setUser(userData.users?.[0] ?? null)

      // Riwayat percobaan login user
      const attemptRes = await fetch(`${API_BASE}/auth/attempts/list?user_id=${encodeURIComponent(userId)}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const attemptData = await attemptRes.json()
      if (!attemptRes.ok) throw new Error(attemptData.error || 'Gagal memuat log keamanan.')
      setAttempts(attemptData.attempts ?? [])
    } catch (err) {
      setError(err?.message === 'Failed to fetch'
        ? 'Tidak dapat terhubung ke server.'
        : (err?.message || 'Gagal memuat log keamanan.'))
    } finally {
      setLoading(false)
    }
  }, [userId, token])

  useEffect(() => { loadData() }, [loadData])

  if (!token) return <Navigate to="/masuk" replace />

  function handleLogout() {
    localStorage.removeItem('tc_token')
    navigate('/masuk')
  }

  const nav = (
    <DashNav
      brand={<Link to="/dasbor" className="dash-brand">TrueCount</Link>}
      items={[
        { to: '/dasbor', label: 'Dasbor' },
        { to: null, label: 'Log Keamanan', active: true },
      ]}
      onLogout={handleLogout}
    />
  )

  return (
    <div className="dash-shell">
      {nav}

      <main className="dash-main dash-main--admin">
        <div className="log-back-row">
          <button type="button" className="copy-btn" onClick={() => navigate('/dasbor')}>
            <ArrowLeftIcon /> Kembali ke Dasbor
          </button>
        </div>

        {/* ── Header user ── */}
        <section className="admin-panel" aria-label="Info pengguna">
          <div className="admin-head">
            <div className="admin-title">
              <h1>Log Keamanan Pengguna</h1>
              <p>Riwayat percobaan login beserta foto kamera yang diambil pada setiap percobaan.</p>
            </div>
          </div>

          {!loading && user && (
            <div className="log-user-card">
              <div className="log-user-avatar" aria-hidden="true">
                {user.username?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="log-user-info">
                <div className="log-user-name">
                  <strong>{user.username ?? '-'}</strong>
                  <span className={`badge ${user.role === 'admin' ? 'badge--active' : 'badge--draft'}`}>
                    {user.role === 'admin' ? 'Admin' : 'Pemilih'}
                  </span>
                </div>
                <span className="log-user-email">{user.email ?? '-'}</span>
              </div>
            </div>
          )}
        </section>

        {error && <p className="invite-error" role="alert">{error}</p>}

        {/* ── Daftar percobaan login ── */}
        <section className="admin-panel" aria-label="Riwayat percobaan login" style={{ marginTop: '2rem' }}>
          <div className="invite-card">
            <div className="invite-list-head" aria-hidden="true">
              <span>Foto</span>
              <span>Waktu</span>
              <span>Metode</span>
              <span>Status</span>
              <span>IP Address</span>
              <span>Keterangan</span>
            </div>

            {loading && <p className="invite-list-note">Memuat log keamanan…</p>}

            {!loading && attempts.length === 0 && (
              <p className="invite-list-note">Belum ada percobaan login tercatat untuk pengguna ini.</p>
            )}

            {!loading && attempts.map(a => (
              <div className="invite-row log-row" key={a.id}>
                <div className="invite-cell">
                  <span className="invite-cell-label">Foto</span>
                  {a.photo_path ? (
                    <AttemptPhoto attemptId={a.id} onOpen={setLightboxUrl} />
                  ) : (
                    <span className="log-photo-empty" aria-hidden="true">
                      <CameraIcon />
                    </span>
                  )}
                </div>
                <div className="invite-cell">
                  <span className="invite-cell-label">Waktu</span>
                  <span style={{ fontSize: '0.82rem' }}>{formatDateTime(a.created_at)}</span>
                </div>
                <div className="invite-cell">
                  <span className="invite-cell-label">Metode</span>
                  <span className="badge" style={{ backgroundColor: METHOD_COLORS[a.method] + '20', color: METHOD_COLORS[a.method], borderColor: METHOD_COLORS[a.method] }}>
                    {METHOD_LABELS[a.method] ?? a.method}
                  </span>
                </div>
                <div className="invite-cell">
                  <span className="invite-cell-label">Status</span>
                  <span className={`badge ${a.success ? 'badge--active' : 'badge--dibatalkan'}`}>
                    {a.success ? 'Berhasil' : 'Gagal'}
                  </span>
                </div>
                <div className="invite-cell">
                  <span className="invite-cell-label">IP</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{a.ip_address ?? '-'}</span>
                </div>
                <div className="invite-cell">
                  <span className="invite-cell-label">Keterangan</span>
                  <span style={{ color: a.success ? 'var(--muted)' : '#b91c1c', fontSize: '0.75rem' }}>
                    {a.error ?? (a.success ? 'Login berhasil' : '-')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  )
}
