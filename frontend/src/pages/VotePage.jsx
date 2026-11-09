import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'
import './DashboardPage.css'   // reuse .dash-nav / .dash-brand / .dash-logout
import './VotePage.css'

const API_BASE = 'http://localhost:8000'

// Palet warna fallback untuk kandidat (berputar berdasarkan urutan)
const CANDIDATE_COLORS = ['#3468b0', '#F13C35', '#2a7a3b', '#b45309', '#7c3aed', '#0891b2']

/* ── Ikon generik kandidat (SVG person) ──────────────────── */
function PersonIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function CheckIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 12.5 9.5 18 20 6.5" />
    </svg>
  )
}

function ExitIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
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

/* ── Main ────────────────────────────────────────────────── */
export default function VotePage() {
  const navigate = useNavigate()
  const token    = localStorage.getItem('tc_token')

  // State
  const [elections,   setElections]   = useState([])
  const [election,    setElection]    = useState(null)   // election yang dipilih
  const [candidates,  setCandidates]  = useState([])
  const [selected,    setSelected]    = useState(null)   // candidate_id yang dipilih
  const [submitted,   setSubmitted]   = useState(false)
  const [submittedCandidate, setSubmittedCandidate] = useState(null)

  // UI state
  const [loadingElections,  setLoadingElections]  = useState(true)
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [submitting,        setSubmitting]         = useState(false)
  const [error,             setError]              = useState(null)

  // Auth guard
  if (!token) return <Navigate to="/masuk" replace />

  // ── Fetch daftar election yang active ─────────────────────
  const fetchElections = useCallback(async () => {
    setLoadingElections(true)
    setError(null)
    try {
      const res  = await fetch(`${API_BASE}/elections?status=active`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar pemilihan.')
      const list = data.elections ?? []
      setElections(list)
      // Jika hanya ada 1 election aktif, langsung pilih
      if (list.length === 1) loadElection(list[0])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingElections(false)
    }
  }, [token])

  // ── Pilih election → fetch kandidat ───────────────────────
  const loadElection = useCallback(async (electionObj) => {
    setElection(electionObj)
    setSelected(null)
    setLoadingCandidates(true)
    setError(null)
    try {
      const res  = await fetch(`${API_BASE}/elections/${electionObj.id}/candidates`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat kandidat.')
      setCandidates(data.candidates ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingCandidates(false)
    }
  }, [token])

  useEffect(() => { fetchElections() }, [fetchElections])

  // ── Kirim suara ───────────────────────────────────────────
  async function handleVote() {
    if (!selected || !election) return
    setSubmitting(true)
    setError(null)
    try {
      const res  = await fetch(`${API_BASE}/elections/${election.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ candidate_id: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim suara.')
      const chosenCandidate = candidates.find(c => c.id === selected)
      setSubmittedCandidate(chosenCandidate)
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('tc_token')
    navigate('/masuk')
  }

  // ── Loading daftar election ────────────────────────────────
  if (loadingElections) {
    return (
      <div className="vote-shell">
        <header className="dash-nav">
          <Link to="/dasbor" className="dash-brand">TrueCount</Link>
          <button className="dash-logout" onClick={handleLogout}><ExitIcon />Keluar</button>
        </header>
        <main className="vote-main">
          <p style={{ color: 'var(--muted)', marginTop: '4rem' }}>Memuat pemilihan…</p>
        </main>
      </div>
    )
  }

  // ── Tidak ada election aktif ───────────────────────────────
  if (!loadingElections && elections.length === 0) {
    return (
      <div className="vote-shell">
        <header className="dash-nav">
          <Link to="/dasbor" className="dash-brand">TrueCount</Link>
          <button className="dash-logout" onClick={handleLogout}><ExitIcon />Keluar</button>
        </header>
        <main className="vote-main">
          <div className="vote-head" style={{ marginTop: '4rem' }}>
            <h1>Tidak ada pemilihan aktif</h1>
            <p className="vote-head-sub">
              Belum ada pemilihan yang sedang berlangsung saat ini.
              Hubungi panitia untuk informasi lebih lanjut.
            </p>
            <button className="vote-success-btn" onClick={() => navigate('/dasbor')}>
              Kembali ke Dasbor
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Pilih election (jika lebih dari 1 aktif) ──────────────
  if (!election) {
    return (
      <div className="vote-shell">
        <header className="dash-nav">
          <Link to="/dasbor" className="dash-brand">TrueCount</Link>
          <nav className="dash-nav-links" aria-label="Navigasi dasbor">
            <Link to="/dasbor" className="dash-nav-item">Dasbor</Link>
            <span className="dash-nav-item dash-nav-active" aria-current="page">Pilih</span>
          </nav>
          <button className="dash-logout" onClick={handleLogout}><ExitIcon />Keluar</button>
        </header>
        <main className="vote-main">
          <header className="vote-head">
            <h1>Pilih Pemilihan</h1>
            <p className="vote-head-sub">Ada beberapa pemilihan aktif. Pilih salah satu untuk melanjutkan.</p>
          </header>
          <div className="vote-grid">
            {elections.map((el) => (
              <button
                key={el.id}
                type="button"
                className="vote-card"
                style={{ '--c': '#F13C35' }}
                onClick={() => loadElection(el)}
              >
                <span className="vote-card-name">{el.title}</span>
                <span className="vote-card-tag">{el.candidate_count} kandidat</span>
              </button>
            ))}
          </div>
        </main>
      </div>
    )
  }

  // ── Tampilan sukses setelah vote ───────────────────────────
  if (submitted && submittedCandidate) {
    return (
      <div className="vote-shell">
        <main className="vote-success">
          <span className="vote-success-ring" aria-hidden="true">
            <CheckIcon size={38} />
          </span>
          <h1>Suara kamu tercatat</h1>
          <p>
            Terima kasih sudah memilih <strong>{submittedCandidate.name}</strong>.
            Hasil akan diumumkan setelah pemilihan ditutup.
          </p>
          <button className="vote-success-btn" onClick={() => navigate('/dasbor')}>
            Kembali ke Dasbor
          </button>
        </main>
      </div>
    )
  }

  const chosen = candidates.find(c => c.id === selected)

  return (
    <div className="vote-shell">

      <header className="dash-nav">
        <Link to="/dasbor" className="dash-brand" aria-label="TrueCount - Dasbor">
          <img src={navLogoLight} alt="TrueCount" className="dash-brand-logo" />
        </Link>

        <nav className="dash-nav-links" aria-label="Navigasi dasbor">
          <Link to="/dasbor" className="dash-nav-item"><DashboardIcon /> Dasbor</Link>
          <span className="dash-nav-item dash-nav-active" aria-current="page"><VoteIcon /> Pilih</span>
        </nav>
        <button className="dash-logout" onClick={handleLogout}>
          <ExitIcon />
          Keluar
        </button>
      </header>

      <main className="vote-main">
        <header className="vote-head">
          <h1>{election.title}</h1>
          <p className="vote-head-sub">
            {election.description
              ? `${election.description} · `
              : ''}
            Pilih satu kandidat, lalu tekan kirim.
            Suara tidak dapat diubah setelah dikirim.
          </p>
        </header>

        {/* Error message */}
        {error && (
          <div style={{
            width: '100%', maxWidth: '560px',
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: '10px', padding: '0.85rem 1.1rem',
            color: '#b91c1c', fontSize: '0.875rem',
            marginBottom: '1.5rem',
          }}>
            {error}
          </div>
        )}

        {/* Loading kandidat */}
        {loadingCandidates ? (
          <p style={{ color: 'var(--muted)' }}>Memuat kandidat…</p>
        ) : candidates.length === 0 ? (
          <div className="vote-head">
            <p className="vote-head-sub">Belum ada kandidat yang terdaftar di pemilihan ini.</p>
          </div>
        ) : (
          <>
            <div className="vote-grid">
              {candidates.map((c, i) => {
                const color      = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length]
                const isSelected = selected === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`vote-card${isSelected ? ' vote-card--selected' : ''}`}
                    style={{ '--c': color }}
                    onClick={() => setSelected(c.id)}
                    aria-pressed={isSelected}
                    aria-label={`Kandidat ${c.name}${c.vision ? ` - ${c.vision}` : ''}`}
                  >
                    <span className="vote-card-num" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="vote-card-icon" aria-hidden="true">
                      <PersonIcon />
                    </span>
                    <span className="vote-card-name">{c.name}</span>
                    {c.vision && (
                      <span className="vote-card-tag">{c.vision}</span>
                    )}
                    {isSelected && (
                      <span className="vote-card-check" aria-hidden="true">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="vote-submit">
              <button
                type="button"
                className="vote-submit-btn"
                disabled={!selected || submitting}
                onClick={handleVote}
              >
                {submitting
                  ? 'Mengirim suara…'
                  : selected
                    ? `Kirim Suara untuk ${chosen?.name}`
                    : 'Pilih kandidat terlebih dahulu'}
              </button>
              {selected && !submitting && (
                <p className="vote-submit-hint">
                  Klik tombol di atas untuk mengirim suara. Suara tidak dapat diubah.
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
