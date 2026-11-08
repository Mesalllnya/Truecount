import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'
import navLogoDark from '/logo/TrueCount_navLogo_darkmode.svg'
import './DashboardPage.css'

/* ── Icon components ─────────────────────────────────────── */
function BallotIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2"/>
      <line x1="8" y1="9"  x2="16" y2="9"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  )
}

function ExitIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* door frame */}
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      {/* arrow out */}
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function RevokeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )
}

/* Nav icons */
function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function VoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2"/>
      <line x1="8" y1="9"  x2="16" y2="9"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  )
}

function BallotNavIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* lembar kertas suara yang dilipat */}
      <rect x="6" y="3" width="12" height="18" rx="1" />
      <path d="M6 3 l6 4" />
      <path d="M12 3 l6 4" />
      {/* garis pada kertas */}
      <line x1="8" y1="7" x2="16" y2="7"/>
      <line x1="8" y1="10" x2="14" y2="10"/>
      <line x1="8" y1="13" x2="12" y2="13"/>
    </svg>
  )
}

/* ── Web Audio beep ──────────────────────────────────────── */
function playBeep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type      = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3)
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.6)
    osc.onended = () => ctx.close()
  } catch {
    // AudioContext tidak tersedia - skip
  }
}

/* ── Easter Egg Overlay ──────────────────────────────────── */
function EasterEgg({ username, onClose }) {
  return (
    <div
      className="egg-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Easter egg - tutup dengan klik di mana saja"
    >
      {/* ripple circles */}
      <span className="egg-ripple egg-ripple--1" aria-hidden="true" />
      <span className="egg-ripple egg-ripple--2" aria-hidden="true" />
      <span className="egg-ripple egg-ripple--3" aria-hidden="true" />

      {/* notification card */}
      <div className="egg-card" onClick={e => e.stopPropagation()}>
        <div className="egg-avatar" aria-hidden="true">
          {username?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <p className="egg-greeting">Hei, <strong>{username ?? 'Pengguna'}</strong>!</p>
        <p className="egg-sub">Kamu sudah menemukan easter egg tersembunyi.</p>
        <button className="egg-close" onClick={onClose}>Tutup</button>
      </div>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────── */
async function readJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    console.error('[TrueCount] Respons server bukan JSON:', text.slice(0, 400))
    throw new Error('Server sedang mengalami gangguan. Silakan coba lagi sebentar.')
  }
}

function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(String(iso).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const ROLE_LABEL  = { voter: 'Pemilih', admin: 'Admin' }
const STATUS_META = {
  menunggu:    { label: 'Menunggu' },
  diterima:    { label: 'Diterima' },
  kedaluwarsa: { label: 'Kedaluwarsa' },
  dibatalkan:  { label: 'Dibatalkan' },
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    document.body.removeChild(ta)
    return ok
  }
}

/* ── Panel Undangan (admin) ──────────────────────────────── */
function InvitesPanel() {
  const [invites, setInvites] = useState([])
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [showForm, setShowForm]   = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', role: 'voter' })
  const [creating, setCreating]   = useState(false)
  const [createError, setCreateError] = useState('')

  const [freshLink, setFreshLink] = useState('')
  const [copiedId, setCopiedId]   = useState(null)
  const [revokingId, setRevokingId] = useState(null)

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('semua')

  const loadInvites = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const token = localStorage.getItem('tc_token')
      const res = await fetch('http://localhost:8000/invites', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await readJson(res)
      if (!res.ok) { setListError(data.error || 'Gagal memuat undangan.'); return }
      setInvites(data.invites ?? [])
      setStats(data.stats ?? null)
    } catch (err) {
      setListError(
        err?.message === 'Failed to fetch'
          ? 'Tidak dapat terhubung ke server.'
          : (err?.message || 'Gagal memuat undangan.')
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInvites() }, [loadInvites])

  // Filter invites based on search & status
  const filteredInvites = useMemo(() => {
    return invites.filter(inv => {
      const matchesSearch = searchQuery === '' ||
        (inv.email && inv.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        inv.token.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.created_by_username && inv.created_by_username.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesStatus = statusFilter === 'semua' || inv.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [invites, searchQuery, statusFilter])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    setFreshLink('')
    try {
      const token = localStorage.getItem('tc_token')
      const res = await fetch('http://localhost:8000/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      })
      const data = await readJson(res)
      if (!res.ok) { setCreateError(data.error || 'Gagal membuat undangan.'); return }
      setFreshLink(`${window.location.origin}${data.invite.link}`)
      setShowForm(false)
      setCreateForm({ email: '', role: 'voter' })
      loadInvites()
    } catch (err) {
      setCreateError(
        err?.message === 'Failed to fetch'
          ? 'Tidak dapat terhubung ke server.'
          : (err?.message || 'Gagal membuat undangan.')
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleCopy(invite, id) {
    const ok = await copyText(`${window.location.origin}${invite.link}`)
    if (ok) {
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(null), 1800)
    }
  }

  async function handleRevoke(invite) {
    if (!window.confirm(`Batalkan undangan untuk ${invite.email ?? '(siapapun)'}?\nTautan undangan akan tidak bisa dipakai lagi.`)) {
      return
    }
    setRevokingId(invite.id)
    try {
      const token = localStorage.getItem('tc_token')
      const res = await fetch(`http://localhost:8000/invites/${invite.id}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await readJson(res)
      if (!res.ok) {
        alert(data.error || 'Gagal membatalkan undangan.')
        return
      }
      loadInvites()
    } catch (err) {
      alert(err?.message === 'Failed to fetch'
        ? 'Tidak dapat terhubung ke server.'
        : (err?.message || 'Gagal membatalkan undangan.'))
    } finally {
      setRevokingId(null)
    }
  }

  const statCards = [
    { key: 'total',       label: 'Total undangan' },
    { key: 'menunggu',    label: 'Menunggu' },
    { key: 'diterima',    label: 'Diterima' },
    { key: 'kedaluwarsa', label: 'Kedaluwarsa' },
    { key: 'dibatalkan',  label: 'Dibatalkan' },
  ]

  const statusOptions = [
    { value: 'semua',      label: 'Semua status' },
    { value: 'menunggu',   label: 'Menunggu' },
    { value: 'diterima',   label: 'Diterima' },
    { value: 'kedaluwarsa', label: 'Kedaluwarsa' },
    { value: 'dibatalkan', label: 'Dibatalkan' },
  ]

  return (
    <section className="admin-panel" aria-label="Undangan pendaftaran">
      <div className="admin-head">
        <div className="admin-title">
          <h1>Undangan</h1>
          <p>Pendaftaran ditutup untuk publik - buat undangan untuk calon pengguna.</p>
        </div>
        <button
          className="admin-create-btn"
          onClick={() => { setShowForm(v => !v); setCreateError(''); setFreshLink('') }}
          aria-expanded={showForm}
        >
          <PlusIcon />
          Buat undangan
        </button>
      </div>

      {/* ── Form buat undangan ── */}
      {showForm && (
        <form className="create-panel" onSubmit={handleCreate}>
          <div className="create-fields">
            <div className="create-field">
              <label htmlFor="invite-email">Email calon (opsional)</label>
              <input
                id="invite-email"
                type="email"
                placeholder="anda@contoh.com"
                value={createForm.email}
                onChange={e => { setCreateForm(p => ({ ...p, email: e.target.value })); setCreateError('') }}
              />
              <span className="create-hint">Kosongkan agar undangan bisa diklaim oleh siapa pun.</span>
            </div>
            <div className="create-field">
              <label htmlFor="invite-role">Peran akun</label>
              <select
                id="invite-role"
                value={createForm.role}
                onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))}
              >
                <option value="voter">Pemilih</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {createError && <p className="invite-error" role="alert">{createError}</p>}

          <div className="create-actions">
            <button type="submit" className="create-submit" disabled={creating}>
              {creating ? 'Membuat…' : 'Buat undangan'}
            </button>
            <button type="button" className="create-cancel" onClick={() => setShowForm(false)}>
              Batal
            </button>
          </div>
        </form>
      )}

      {/* ── Tautan undangan baru ── */}
      {freshLink && (
        <div className="link-box" role="status">
          <span className="link-box-label">Undangan dibuat - bagikan tautan ini:</span>
          <code>{freshLink}</code>
          <button
            className="copy-btn"
            onClick={() => { copyText(freshLink); setCopiedId('fresh') }}
            title="Salin tautan"
          >
            {copiedId === 'fresh' ? <CheckIcon /> : <CopyIcon />}
            {copiedId === 'fresh' ? 'Tersalin' : 'Salin'}
          </button>
        </div>
      )}

      {listError && <p className="invite-error" role="alert">{listError}</p>}

      {/* ── Statistik ── */}
      {stats && (
        <div className="stat-grid">
          {statCards.map(s => (
            <div className={`stat-card${s.key === 'total' ? ' stat-card--total' : ''}`} key={s.key}>
              <span className="stat-num">{stats[s.key] ?? 0}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Search & Filter ── */}
      <div className="invite-toolbar">
        <div className="toolbar-search">
          <label htmlFor="invite-search" className="visually-hidden">Cari undangan</label>
          <input
            id="invite-search"
            type="search"
            placeholder="Cari email, token, atau pembuat…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="toolbar-filter">
          <label htmlFor="invite-filter" className="visually-hidden">Filter status</label>
          <select
            id="invite-filter"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <span className="toolbar-count">
          {filteredInvites.length} dari {invites.length} undangan
        </span>
      </div>

      {/* ── Daftar undangan ── */}
      <div className="invite-card">
        <div className="invite-list-head" aria-hidden="true">
          <span>Email</span>
          <span>Peran</span>
          <span>Status</span>
          <span>Pembuat</span>
          <span>Dibuat</span>
          <span>Kedaluwarsa</span>
          <span />
        </div>

        {loading && (
          <p className="invite-list-note">Memuat undangan…</p>
        )}

        {!loading && !listError && filteredInvites.length === 0 && (
          <p className="invite-list-note">
            {invites.length === 0
              ? 'Belum ada undangan. Buat yang pertama untuk mengundang pengguna.'
              : 'Tidak ada undangan yang cocok dengan pencarian/filter.'}
          </p>
        )}

        {!loading && filteredInvites.map(inv => (
          <div className="invite-row" key={inv.id}>
            <div className="invite-cell invite-cell--email">
              <span className="invite-cell-label">Email</span>
              <span className="invite-email">{inv.email ?? '-'}</span>
            </div>
            <div className="invite-cell">
              <span className="invite-cell-label">Peran</span>
              <span className="invite-role">{ROLE_LABEL[inv.role] ?? inv.role}</span>
            </div>
            <div className="invite-cell">
              <span className="invite-cell-label">Status</span>
              <span className={`badge badge--${inv.status}`}>
                {STATUS_META[inv.status]?.label ?? inv.status}
              </span>
            </div>
            <div className="invite-cell">
              <span className="invite-cell-label">Pembuat</span>
              <span className="invite-creator">{inv.created_by_username ?? '-'}</span>
            </div>
            <div className="invite-cell">
              <span className="invite-cell-label">Dibuat</span>
              <span className="invite-date">{formatDate(inv.created_at)}</span>
            </div>
            <div className="invite-cell">
              <span className="invite-cell-label">Kedaluwarsa</span>
              <span className="invite-date">{formatDate(inv.expires_at)}</span>
            </div>
            <div className="invite-cell invite-cell--action">
              <span className="invite-cell-label">Aksi</span>
              <div className="invite-actions">
                <button
                  className="copy-btn"
                  onClick={() => handleCopy(inv, inv.id)}
                  title="Salin tautan undangan"
                  disabled={inv.status === 'diterima' || inv.status === 'kedaluwarsa' || inv.status === 'dibatalkan'}
                >
                  {copiedId === inv.id ? <CheckIcon /> : <CopyIcon />}
                  {copiedId === inv.id ? 'Tersalin' : 'Salin'}
                </button>
                {inv.status === 'menunggu' && (
                  <button
                    className="revoke-btn"
                    onClick={() => handleRevoke(inv)}
                    title="Batalkan undangan"
                    disabled={revokingId === inv.id}
                  >
                    {revokingId === inv.id ? 'Membatalkan…' : <RevokeIcon />}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="admin-footnote">
        Undangan yang belum diklaim otomatis kedaluwarsa setelah 7 hari. Masa berlaku bisa diubah lewat
        <code> INVITE_EXPIRE_DAYS</code> di <code>.env</code>.
      </p>
    </section>
  )
}

/* ── Main ────────────────────────────────────────────────── */
export default function DashboardPage() {
  const navigate   = useNavigate()
  const [clicks, setClicks]   = useState(0)
  const [showEgg, setShowEgg] = useState(false)

  // Ambil username + role dari token yang tersimpan
  const getUser = useCallback(() => {
    try {
      const token   = localStorage.getItem('tc_token')
      if (!token) return null
      const payload = JSON.parse(atob(token.split('.')[1]))
      return {
        username: payload.username ?? null,
        role:     payload.role     ?? null,
      }
    } catch {
      return null
    }
  }, [])

  const [user]  = useState(getUser)
  const isAdmin = user?.role === 'admin'

  // Auth guard - tanpa token langsung ke halaman login
  // (letakkan SETELAH semua hooks agar urutan hooks tetap konsisten)
  if (!localStorage.getItem('tc_token')) {
    return <Navigate to="/masuk" replace />
  }

  function handleBrandClick() {
    setClicks(prev => {
      const next = prev + 1
      if (next >= 5) {
        playBeep()
        setShowEgg(true)
        return 0   // reset counter
      }
      return next
    })
  }

  function handleLogout() {
    localStorage.removeItem('tc_token')
    navigate('/masuk')
  }

  return (
    <div className="dash-shell">

      {/* Easter egg overlay */}
      {showEgg && (
        <EasterEgg
          username={user?.username}
          onClose={() => setShowEgg(false)}
        />
      )}

      <header className="dash-nav">
        {/* Brand - klik 5x untuk easter egg */}
        <button
          className="dash-brand"
          onClick={handleBrandClick}
          aria-label={`TrueCount - klik ${5 - clicks} kali lagi`}
          title="TrueCount"
        >
          <picture className="dash-brand-img">
            <source srcSet={navLogoDark} media="(prefers-color-scheme: dark)" />
            <img src={navLogoLight} alt="TrueCount" className="dash-brand-logo" />
          </picture>
          {clicks > 0 && clicks < 5 && (
            <span className="dash-brand-dots" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={`dash-brand-dot${i < clicks ? ' active' : ''}`} />
              ))}
            </span>
          )}
        </button>

        <nav className="dash-nav-links" aria-label="Navigasi dasbor">
          <span className="dash-nav-item dash-nav-active"><DashboardIcon /> Dasbor</span>
          <Link to="/pilih" className="dash-nav-item"><VoteIcon /> Pemilihan</Link>
          <Link to="/pengaturan" className="dash-nav-item"><SettingsIcon /> Pengaturan</Link>
          <span className="dash-nav-item"><BallotNavIcon /> Surat Suara Saya</span>
        </nav>

        {/* ── Server status sudah dihapus dari UI - HealthMonitor global
               mencatat kondisi server/DB ke error log (console + app.log) ── */}

        <button className="dash-logout" onClick={handleLogout}>
          <ExitIcon />
          Keluar
        </button>
      </header>

      {isAdmin ? (
        <main className="dash-main dash-main--admin">
          <InvitesPanel />

          <p className="admin-demo-link">
            <Link to="/pilih">Lihat halaman pemilihan (demo) →</Link>
          </p>
        </main>
      ) : (
        <main className="dash-main">
          <div className="dash-empty">
            <div className="dash-empty-icon" aria-hidden="true">
              <BallotIcon />
            </div>
            <h1>Belum ada pemilihan</h1>
            <p>Pemilihan yang sedang aktif akan muncul di sini setelah admin membukanya.</p>
            <button
              className="dash-empty-demo"
              onClick={() => navigate('/pilih')}
            >
              Lihat halaman pemilihan (demo)
            </button>
          </div>
        </main>
      )}
    </div>
  )
}
