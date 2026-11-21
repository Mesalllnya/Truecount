import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiUrl } from '../lib/appConfig'
import Icon from '../components/Icon'
import './UserProfilePage.css'

/* ── Icons ─────────────────────────────────────────────────── */
function ArrowLeftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3.5 5.5 8 10 12.5" />
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

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IDCardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M6 17h12" />
      <path d="M10 5v14" />
    </svg>
  )
}

function AlertTriangleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

/* ── Helper format waktu ──────────────────────────────────── */
function formatDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(String(iso).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateOnly(iso) {
  if (!iso) return '-'
  const d = new Date(String(iso).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function getRoleLabel(role) {
  return role === 'admin' ? 'Admin' : 'Pemilih'
}

function getRoleBadgeClass(role) {
  return role === 'admin' ? 'badge--active' : 'badge--draft'
}

/* ── Komponen foto KTP (fetch dengan token → blob URL) ─────── */
function IdPhotoDisplay({ photoPath, photoType, onOpen }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(null)

  useEffect(() => {
    if (!photoPath) return
    let objectUrl = null
    let cancelled = false
    const token = localStorage.getItem('tc_token')
    fetch(apiUrl(`/users/photo?id=${encodeURIComponent(photoPath)}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? 'not-found' : 'error')
        return res.blob()
      })
      .then(blob => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(err => {
        if (!cancelled) setFailed(err?.message ?? 'error')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photoPath])

  const label = photoType === 'ktp' ? 'KTP' : 'SIM'

  if (failed) {
    const msg = failed === 'not-found'
      ? 'Foto tidak ditemukan di penyimpanan.'
      : 'Gagal memuat foto.'
    return (
      <span className="profile-photo-error" role="alert" aria-label={msg}>
        <AlertTriangleIcon aria-hidden="true" />
        {msg}
      </span>
    )
  }

  if (!url) {
    return <span className="profile-photo-loading" aria-hidden="true" />
  }

  return (
    <button
      type="button"
      className="profile-photo-btn"
      onClick={() => onOpen(url)}
      title={`Perbesar foto ${label}`}
      aria-label={`Perbesar foto ${label}`}
    >
      <img src={url} alt={`Foto ${label} pengguna`} className="profile-photo-img" />
      <span className="profile-photo-overlay">
        <CameraIcon aria-hidden="true" />
        <span>Klik untuk perbesar</span>
      </span>
    </button>
  )
}

/* ── Lightbox ─────────────────────────────────────────────── */
function PhotoLightbox({ url, onClose, label }) {
  if (!url) return null
  return (
    <div className="profile-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Foto ${label} diperbesar`}>
      <button className="profile-lightbox-close" onClick={onClose} aria-label="Tutup">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img src={url} alt={`Foto ${label} diperbesar`} className="profile-lightbox-img" onClick={e => e.stopPropagation()} />
    </div>
  )
}

/* ── Request Change Modal ─────────────────────────────────── */
function RequestChangeModal({ isOpen, onClose, onSubmit }) {
  if (!isOpen) return null

  const [field, setField] = useState('username')
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fieldLabels = {
    username: 'Username',
    email: 'Email',
    phone: 'Nomor Telepon',
    address: 'Alamat',
  }

  const handleSubmitModal = async (e) => {
    e.preventDefault()
    if (!newValue.trim() || !reason.trim()) {
      setError('Field baru dan alasan wajib diisi.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onSubmit(field, newValue.trim(), reason.trim())
      setNewValue('')
      setReason('')
      onClose()
    } catch (err) {
      setError(err?.message || 'Gagal mengajukan permintaan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="modal-title">Ajukan Perubahan Data</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmitModal} className="modal-body">
          <div className="modal-field">
            <label htmlFor="change-field">Field yang ingin diubah</label>
            <select
              id="change-field"
              value={field}
              onChange={e => setField(e.target.value)}
              disabled={loading}
              required
            >
              <option value="username">Username</option>
              <option value="email">Email</option>
              <option value="phone">Nomor Telepon</option>
              <option value="address">Alamat</option>
            </select>
          </div>

          <div className="modal-field">
            <label htmlFor="new-value">Nilai Baru</label>
            <input
              id="new-value"
              type={field === 'email' ? 'email' : 'text'}
              autoComplete="off"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder={`Masukkan ${fieldLabels[field].toLowerCase()} baru`}
              disabled={loading}
              required
            />
          </div>

          <div className="modal-field">
            <label htmlFor="reason">Alasan Perubahan</label>
            <textarea
              id="reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Jelaskan alasan perubahan data ini..."
              rows={3}
              disabled={loading}
              required
            />
          </div>

          {error && <p className="modal-error" role="alert">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <> <span className="spinner" aria-hidden="true" /> Mengajukan... </>
              ) : (
                'Kirim ke Admin'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Halaman utama ────────────────────────────────────────── */
export default function UserProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('tc_token')
  const isOwnProfile = !userId // If no userId in URL, show current user's profile

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [lightboxLabel, setLightboxLabel] = useState('')
  const [showRequestModal, setShowRequestModal] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const targetId = userId || (user?.id ?? '')
      // If viewing own profile and no userId, we need to get current user info
      // For now, assume userId is passed or we redirect to login
      if (!targetId) {
        throw new Error('User ID tidak ditemukan.')
      }

      const res = await fetch(apiUrl(`/users/profile?id=${encodeURIComponent(targetId)}`), {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat profil.')
      setUser(data.user)
    } catch (err) {
      setError(err?.message === 'Failed to fetch'
        ? 'Tidak dapat terhubung ke server.'
        : (err?.message || 'Gagal memuat profil.'))
    } finally {
      setLoading(false)
    }
  }, [userId, token, user?.id])

  useEffect(() => {
    if (!token) {
      navigate('/masuk', { replace: true })
      return
    }
    loadProfile()
  }, [loadProfile, token, navigate])

  const handleRequestChange = async (field, newValue, reason) => {
    const res = await fetch(apiUrl('/users/request-change'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: user.id, field, new_value: newValue, reason }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Gagal mengajukan permintaan.')
  }

  if (!token) return null

  return (
    <div className="profile-shell">
      <header className="profile-header">
        <button type="button" className="back-btn" onClick={() => navigate(-1)} aria-label="Kembali">
          <ArrowLeftIcon />
        </button>
        <h1>Profil Pengguna</h1>
      </header>

      <main className="profile-main">
        {error && <div className="profile-alert" role="alert">{error}</div>}

        {loading ? (
          <div className="profile-skeleton">
            <div className="skeleton-avatar" aria-hidden="true" />
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        ) : user ? (
          <>
            {/* ── Kartu Profil ── */}
            <section className="profile-card" aria-labelledby="profile-title">
              <div className="profile-avatar" aria-hidden="true">
                {user.username?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="profile-info">
                <h2 id="profile-title">{user.username ?? '-'}</h2>
                <span className={`badge ${getRoleBadgeClass(user.role)}`}>{getRoleLabel(user.role)}</span>
              </div>

              <div className="profile-fields">
                <div className="profile-field">
                  <label>Email</label>
                  <div className="field-value">
                    <MailIcon aria-hidden="true" />
                    <span>{user.email ?? '-'}</span>
                  </div>
                </div>

                {user.phone && (
                  <div className="profile-field">
                    <label>Telepon</label>
                    <div className="field-value">{user.phone}</div>
                  </div>
                )}

                {user.address && (
                  <div className="profile-field">
                    <label>Alamat</label>
                    <div className="field-value">{user.address}</div>
                  </div>
                )}

                <div className="profile-field">
                  <label>Bergabung Sejak</label>
                  <div className="field-value">
                    <ShieldIcon aria-hidden="true" />
                    <span>{formatDateOnly(user.created_at)}</span>
                  </div>
                </div>

                {user.updated_at && user.updated_at !== user.created_at && (
                  <div className="profile-field">
                    <label>Diperbarui</label>
                    <div className="field-value">
                      <span>{formatDateTime(user.updated_at)}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Foto KTP/SIM ── */}
            {(user.id_photo_path || user.id_photo_type) && (
              <section className="profile-photo-section" aria-labelledby="photo-title">
                <h3 id="photo-title">
                  <IDCardIcon aria-hidden="true" />
                  Foto Identitas ({user.id_photo_type?.toUpperCase() ?? 'KTP/SIM'})
                </h3>
                <div className="photo-wrapper">
                  <IdPhotoDisplay
                    photoPath={user.id_photo_path}
                    photoType={user.id_photo_type ?? 'ktp'}
                    onOpen={(url, label) => {
                      setLightboxUrl(url)
                      setLightboxLabel(label)
                    }}
                  />
                </div>
                <p className="photo-note">
                  Foto identitas ini digunakan untuk verifikasi keaslian pemilih.
                  <br />
                  Perubahan data identitas harus diajukan melalui admin.
                </p>
              </section>
            )}

            {/* ── Request Change ── */}
            <section className="profile-actions" aria-labelledby="actions-title">
              <h3 id="actions-title">
                <EditIcon aria-hidden="true" />
                Perlu Mengubah Data?
              </h3>
              <p>Data profil tidak bisa diubah langsung. Jika ada kesalahan, silakan ajukan permintaan perubahan ke admin.</p>
              <button
                type="button"
                className="btn-request-change"
                onClick={() => setShowRequestModal(true)}
              >
                <EditIcon aria-hidden="true" />
                Ajukan Perubahan ke Admin
              </button>
            </section>

            <RequestChangeModal
              isOpen={showRequestModal}
              onClose={() => setShowRequestModal(false)}
              onSubmit={handleRequestChange}
            />
          </>
        ) : null}
      </main>

      <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} label={lightboxLabel} />
    </div>
  )
}