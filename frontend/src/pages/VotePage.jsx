import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'
import navLogoDark from '/logo/TrueCount_navLogo_darkmode.svg'
import './DashboardPage.css'   // reuse .dash-nav / .dash-brand / .dash-logout
import './VotePage.css'

/* ═══════════════════════════════════════════════════════════
   DATA DEMO - backend Sprint 2 (GET /elections, POST /vote)
   belum ada, jadi kandidat masih contoh.
   ═══════════════════════════════════════════════════════════ */
const ELECTION = {
  title:  'Pemilihan Ketua BEM 2026',
  period: 'Periode 2026/2027',
}

const CANDIDATES = [
  { id: 1, name: 'Raka Pratama',    tagline: 'Inovasi untuk kampus',        color: '#3468b0', icon: 'bolt' },
  { id: 2, name: 'Sinta Maharani',  tagline: 'Suara mahasiswa, aksi nyata',  color: '#F13C35', icon: 'star' },
  { id: 3, name: 'Bagus Wicaksono', tagline: 'Kampus hijau & sehat',         color: '#2a7a3b', icon: 'leaf' },
  { id: 4, name: 'Nadia Rahma',     tagline: 'Transparansi anggaran',        color: '#b45309', icon: 'sun'  },
]

/* ── Ikon kandidat - SVG satu stroke konsisten ───────────── */
function CandidateIcon({ type }) {
  const common = {
    width: '30', height: '30', viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: '1.6',
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  }
  switch (type) {
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />
        </svg>
      )
    case 'star':
      return (
        <svg {...common}>
          <path d="M12 3.5 14.4 8.8 20 9.5l-4.1 3.9 1 5.6-4.9-2.7-4.9 2.7 1-5.6L4 9.5l5.6-.7L12 3.5Z" />
        </svg>
      )
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M5 19C5 9 12 4 20 4c0 9-4 15-12 15" />
          <path d="M5 19c3-5 7-8 11-9" />
        </svg>
      )
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" />
        </svg>
      )
    default:
      return null
  }
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 12.5 9.5 18 20 6.5" />
    </svg>
  )
}

function ExitIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  const navigate       = useNavigate()
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  // Auth guard - tanpa token langsung ke halaman login
  if (!localStorage.getItem('tc_token')) {
    return <Navigate to="/masuk" replace />
  }

  function handleLogout() {
    localStorage.removeItem('tc_token')
    navigate('/masuk')
  }

  /* ── Tampilan sukses ── */
  if (submitted && selected) {
    const candidate = CANDIDATES.find(c => c.id === selected)
    return (
      <div className="vote-shell">
        <main className="vote-success">
          <span className="vote-success-ring" aria-hidden="true">
            <CheckIcon />
          </span>
          <h1>Suara kamu tercatat</h1>
          <p>
            Terima kasih sudah memilih <strong>{candidate.name}</strong>.
            Hasil akan diumumkan setelah pemilihan ditutup.
          </p>
          <button className="vote-success-btn" onClick={() => navigate('/dasbor')}>
            Kembali ke Dasbor
          </button>
        </main>
      </div>
    )
  }

  const chosen = CANDIDATES.find(c => c.id === selected)

  return (
    <div className="vote-shell">

      <header className="dash-nav">
        <Link to="/dasbor" className="dash-brand" aria-label="TrueCount - Dasbor">
          <picture className="dash-brand-img">
            <source srcSet={navLogoDark} media="(prefers-color-scheme: dark)" />
            <img src={navLogoLight} alt="TrueCount" className="dash-brand-logo" />
          </picture>
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
          <h1>{ELECTION.title}</h1>
          <p className="vote-head-sub">
            {ELECTION.period} · Pilih satu kandidat, lalu tekan kirim.
            Suara tidak dapat diubah setelah dikirim.
          </p>
          <span className="vote-demo-tag">Mode demo - data kandidat contoh</span>
        </header>

        <div className="vote-grid">
          {CANDIDATES.map((c, i) => {
            const isSelected = selected === c.id
            return (
              <button
                key={c.id}
                type="button"
                className={`vote-card${isSelected ? ' vote-card--selected' : ''}`}
                style={{ '--c': c.color }}
                onClick={() => setSelected(c.id)}
                aria-pressed={isSelected}
                aria-label={`Kandidat ${c.name} - ${c.tagline}`}
              >
                <span className="vote-card-num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="vote-card-icon" aria-hidden="true">
                  <CandidateIcon type={c.icon} />
                </span>
                <span className="vote-card-name">{c.name}</span>
                <span className="vote-card-tag">{c.tagline}</span>
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
            disabled={!selected}
            onClick={() => setSubmitted(true)}
          >
            {selected
              ? `Kirim Suara untuk ${chosen.name}`
              : 'Pilih kandidat terlebih dahulu'}
          </button>
          {selected && (
            <p className="vote-submit-hint">
              Klik lagi tombol di atas untuk mengirim suara.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
