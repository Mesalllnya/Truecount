import { useNavigate } from 'react-router-dom'
import './DashboardPage.css'

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

export default function DashboardPage() {
  const navigate = useNavigate()

  function handleLogout() {
    localStorage.removeItem('tc_token')
    navigate('/masuk')
  }

  return (
    <div className="dash-shell">
      <header className="dash-nav">
        <span className="dash-brand">TrueCount</span>
        <nav className="dash-nav-links" aria-label="Navigasi dasbor">
          <a href="#" className="dash-nav-item dash-nav-active">Dasbor</a>
          <a href="#" className="dash-nav-item">Pemilihan</a>
          <a href="#" className="dash-nav-item">Surat Suara Saya</a>
        </nav>
        <button className="dash-logout" onClick={handleLogout}>Keluar</button>
      </header>

      <main className="dash-main">
        <div className="dash-empty">
          <div className="dash-empty-icon" aria-hidden="true">
            <BallotIcon />
          </div>
          <h1>Belum ada pemilihan</h1>
          <p>Pemilihan yang sedang aktif akan muncul di sini setelah admin membukanya.</p>
        </div>
      </main>
    </div>
  )
}
