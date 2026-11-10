import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'
import { CandidatePhoto } from '../components/ElectionModals'
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

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

/* ── Main ────────────────────────────────────────────────── */
export default function VotePage() {
  const navigate = useNavigate()
  const token    = localStorage.getItem('tc_token')

  // State
  const [elections,   setElections]   = useState([])
  const [election,    setElection]    = useState(null)   // election yang sedang dibuka/dilihat
  const [candidates,  setCandidates]  = useState([])
  
  // Stored draft selections per election: { [electionId]: candidateId }
  const [draftSelections, setDraftSelections] = useState(() => {
    try {
      const saved = localStorage.getItem('tc_draft_votes')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

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
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingElections(false)
    }
  }, [token])

  // ── Pilih election → fetch kandidat ───────────────────────
  const loadElection = useCallback(async (electionObj) => {
    setElection(electionObj)
    setSubmitted(false)
    setSubmittedCandidate(null)
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

  // Draft selection update
  function handleSelectCandidate(candId) {
    if (!election || election.has_voted) return
    setDraftSelections(prev => {
      const updated = { ...prev, [election.id]: candId }
      try {
        localStorage.setItem('tc_draft_votes', JSON.stringify(updated))
      } catch (e) {
        console.error(e)
      }
      return updated
    })
  }

  // ── Kirim suara (Input Suara Final) ───────────────────────
  async function handleFinalVote() {
    const chosenId = draftSelections[election?.id]
    if (!chosenId || !election) return

    if (!window.confirm('Apakah Anda yakin ingin mengirim suara sekarang? Pilihan tidak dapat diubah lagi setelah Anda menekan Input Suara.')) {
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res  = await fetch(`${API_BASE}/elections/${election.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ candidate_id: chosenId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim suara.')
      
      const chosenCand = candidates.find(c => c.id === chosenId)
      setSubmittedCandidate(chosenCand)
      setSubmitted(true)

      // Hapus draft pemilihan ini dari localStorage
      setDraftSelections(prev => {
        const copy = { ...prev }
        delete copy[election.id]
        localStorage.setItem('tc_draft_votes', JSON.stringify(copy))
        return copy
      })

      // Update status election lokal
      setElection(prev => ({ ...prev, has_voted: true }))
      setElections(prev => prev.map(el => el.id === election.id ? { ...el, has_voted: true } : el))

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

  // ── Tampilan list pemilihan yang diikuti pemilih ───────────
  if (!election) {
    const registeredElections = elections.filter(el => el.is_registered)

    return (
      <div className="vote-shell">
        <header className="dash-nav">
          <Link to="/dasbor" className="dash-brand">
            <img src={navLogoLight} alt="TrueCount" className="dash-brand-logo" />
          </Link>
          <nav className="dash-nav-links" aria-label="Navigasi dasbor">
            <Link to="/dasbor" className="dash-nav-item"><DashboardIcon /> Dasbor</Link>
            <span className="dash-nav-item dash-nav-active" aria-current="page"><VoteIcon /> Pemilihan</span>
          </nav>
          <button className="dash-logout" onClick={handleLogout}><ExitIcon />Keluar</button>
        </header>

        <main className="vote-main">
          <header className="vote-head">
            <h1>Pemilihan Saya</h1>
            <p className="vote-head-sub">
              Daftar seluruh pemilihan aktif yang dapat Anda ikuti. Pilih salah satu untuk menentukan atau mengedit pilihan paslon Anda.
            </p>
          </header>

          {registeredElections.length === 0 ? (
            <div className="vote-head" style={{ marginTop: '2rem' }}>
              <p className="vote-head-sub" style={{ color: '#b45309' }}>
                Anda belum terdaftar di pemilihan mana pun yang sedang aktif, atau belum ada pemilihan yang dibuka oleh panitia.
              </p>
              <button className="vote-success-btn" onClick={() => navigate('/dasbor')}>
                Kembali ke Dasbor
              </button>
            </div>
          ) : (
            <div className="vote-grid" style={{ maxWidth: '800px', width: '100%' }}>
              {registeredElections.map((el) => {
                const hasDraft = !!draftSelections[el.id]
                return (
                  <div
                    key={el.id}
                    className="vote-card"
                    style={{
                      '--c': el.has_voted ? '#2a7a3b' : hasDraft ? '#3468b0' : '#F13C35',
                      textAlign: 'left',
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      padding: '1.5rem',
                    }}
                    onClick={() => loadElection(el)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span className="vote-card-name" style={{ fontSize: '1.15rem' }}>{el.title}</span>
                      {el.has_voted ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px', background: '#e8f5e9', color: '#2a7a3b' }}>
                          ✓ Sudah Memilih
                        </span>
                      ) : hasDraft ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8' }}>
                          ✎ Pilihan Tersimpan (Belum Diinput)
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px', background: '#fef2f2', color: '#b91c1c' }}>
                          Belum Memilih
                        </span>
                      )}
                    </div>

                    {el.description && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.4rem 0 0.8rem 0' }}>
                        {el.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 'auto', paddingTop: '0.8rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--muted)' }}>
                      <span>{el.candidate_count} paslon</span>
                      <span style={{ color: 'var(--c)', fontWeight: 600 }}>
                        {el.has_voted ? 'Lihat status →' : hasDraft ? 'Edit / Input Suara →' : 'Pilih paslon →'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    )
  }

  // ── Tampilan sukses setelah submit suara final ──────────────
  if (submitted && submittedCandidate) {
    return (
      <div className="vote-shell">
        <main className="vote-success">
          <span className="vote-success-ring" aria-hidden="true">
            <CheckIcon size={38} />
          </span>
          <h1>Suara kamu telah berhasil diinput!</h1>
          <p>
            Pilihan Anda untuk <strong>{submittedCandidate.name}</strong> pada pemilihan <em>{election.title}</em> telah dicatat secara aman dan dienkripsi ke sistem.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button className="vote-success-btn" onClick={() => setElection(null)}>
              Pilih Pemilihan Lain
            </button>
            <button className="vote-success-btn" style={{ background: '#3468b0' }} onClick={() => navigate('/dasbor')}>
              Kembali ke Dasbor
            </button>
          </div>
        </main>
      </div>
    )
  }

  const currentDraftId = draftSelections[election.id] || null
  const chosenCandidate = candidates.find(c => c.id === currentDraftId)

  return (
    <div className="vote-shell">
      <header className="dash-nav">
        <Link to="/dasbor" className="dash-brand" aria-label="TrueCount - Dasbor">
          <img src={navLogoLight} alt="TrueCount" className="dash-brand-logo" />
        </Link>

        <nav className="dash-nav-links" aria-label="Navigasi dasbor">
          <Link to="/dasbor" className="dash-nav-item"><DashboardIcon /> Dasbor</Link>
          <span className="dash-nav-item dash-nav-active" aria-current="page"><VoteIcon /> Pemilihan</span>
        </nav>
        <button className="dash-logout" onClick={handleLogout}>
          <ExitIcon />
          Keluar
        </button>
      </header>

      <main className="vote-main">
        {/* Tombol kembali ke daftar pemilihan */}
        <div style={{ width: '100%', maxWidth: '880px', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => setElection(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0.2rem 0',
            }}
          >
            <ArrowLeftIcon /> Kembali ke Daftar Pemilihan
          </button>
        </div>

        <header className="vote-head">
          <h1>{election.title}</h1>
          <p className="vote-head-sub">
            {election.description ? `${election.description} · ` : ''}
            {election.has_voted ? (
              <strong style={{ color: '#2a7a3b' }}>
                Anda sudah memberikan suara resmi untuk pemilihan ini. Suara Anda telah terkunci.
              </strong>
            ) : (
              <span>
                Pilih salah satu paslon di bawah ini. Anda dapat <strong>mengubah pilihan kapan saja</strong> sebelum menekan tombol <strong>Input Suara</strong>.
              </span>
            )}
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
          <p style={{ color: 'var(--muted)' }}>Memuat pasangan calon…</p>
        ) : candidates.length === 0 ? (
          <div className="vote-head">
            <p className="vote-head-sub">Belum ada paslon yang terdaftar di pemilihan ini.</p>
          </div>
        ) : (
          <>
            <div className="vote-grid">
              {candidates.map((c, i) => {
                const color      = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length]
                const isSelected = currentDraftId === c.id

                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={election.has_voted}
                    className={`vote-card${isSelected ? ' vote-card--selected' : ''}`}
                    style={{
                      '--c': color,
                      opacity: election.has_voted && !isSelected ? 0.6 : 1,
                      cursor: election.has_voted ? 'default' : 'pointer'
                    }}
                    onClick={() => handleSelectCandidate(c.id)}
                    aria-pressed={isSelected}
                    aria-label={`Paslon ${c.name}${c.vision ? ` - ${c.vision}` : ''}`}
                  >
                    <span className="vote-card-num" aria-hidden="true">
                      NO. {String(i + 1).padStart(2, '0')}
                    </span>

                    {/* Foto paslon atau Avatar default */}
                    <div className="vote-card-photo" style={{
                      width: '90px',
                      height: '90px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      marginBottom: '0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <CandidatePhoto
                        candidate={c}
                        electionId={election.id}
                        token={token}
                        style={{
                          width: '90px',
                          height: '90px',
                          borderRadius: '12px',
                        }}
                        fallbackSize="2.2rem"
                      />
                    </div>

                    <span className="vote-card-name">{c.name}</span>

                    {c.vision && (
                      <span className="vote-card-tag" style={{ fontWeight: 600, color: 'var(--black)' }}>
                        {c.vision}
                      </span>
                    )}

                    {c.mission && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.3rem', maxWidth: '32ch', textAlign: 'center' }}>
                        {c.mission}
                      </p>
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

            {/* Tombol Input Suara */}
            {!election.has_voted ? (
              <div className="vote-submit" style={{ maxWidth: '480px', textAlign: 'center' }}>
                <button
                  type="button"
                  className="vote-submit-btn"
                  disabled={!currentDraftId || submitting}
                  onClick={handleFinalVote}
                  style={{
                    background: currentDraftId ? '#2a7a3b' : '#9ca3af',
                    borderColor: currentDraftId ? '#2a7a3b' : '#9ca3af',
                    boxShadow: currentDraftId ? '0 8px 20px rgba(42, 122, 59, 0.25)' : 'none',
                    padding: '0.95rem 1.5rem',
                    fontSize: '1rem',
                  }}
                >
                  {submitting
                    ? 'Menyimpan & mengenkripsi suara…'
                    : currentDraftId
                      ? `Input Suara (Konfirmasi: ${chosenCandidate?.name})`
                      : 'Pilih salah satu paslon terlebih dahulu'}
                </button>

                {currentDraftId && !submitting ? (
                  <p className="vote-submit-hint" style={{ marginTop: '0.75rem', color: '#4b5563', fontSize: '0.85rem' }}>
                    💡 <em>Anda masih dapat mengedit atau mengganti pilihan paslon di atas sebelum menekan tombol "Input Suara". Setelah ditekan, suara Anda akan resmi diinput ke basis data dan tidak dapat diubah lagi.</em>
                  </p>
                ) : (
                  <p className="vote-submit-hint" style={{ marginTop: '0.75rem' }}>
                    Klik kartu salah satu paslon di atas untuk menentukan pilihan Anda.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <p style={{ color: '#2a7a3b', fontWeight: 600 }}>
                  Suara Anda pada pemilihan ini sudah resmi tersimpan.
                </p>
                <button
                  type="button"
                  className="vote-success-btn"
                  onClick={() => setElection(null)}
                  style={{ marginTop: '0.75rem' }}
                >
                  Pilih Pemilihan Lainnya
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
