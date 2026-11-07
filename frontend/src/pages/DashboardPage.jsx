import { useNavigate } from 'react-router-dom'
import './DashboardPage.css'

export default function DashboardPage() {
  const navigate = useNavigate()

  function handleLogout() {
    localStorage.removeItem('tc_token')
    navigate('/login')
  }

  return (
    <div className="dash-shell">
      <header className="dash-nav">
        <span className="dash-brand">TrueCount</span>
        <nav className="dash-nav-links">
          <a href="#" className="dash-nav-item dash-nav-active">Dashboard</a>
          <a href="#" className="dash-nav-item">Elections</a>
          <a href="#" className="dash-nav-item">My Ballots</a>
        </nav>
        <button className="dash-logout" onClick={handleLogout}>Log out</button>
      </header>

      <main className="dash-main">
        <div className="dash-empty">
          <div className="dash-empty-icon" aria-hidden="true">
            {/* simple ballot icon */}
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="8" y="4" width="24" height="32" rx="2" stroke="#d4d4d0" strokeWidth="1.5"/>
              <line x1="14" y1="13" x2="26" y2="13" stroke="#d4d4d0" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="14" y1="19" x2="26" y2="19" stroke="#d4d4d0" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="14" y1="25" x2="20" y2="25" stroke="#d4d4d0" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1>No elections yet</h1>
          <p>Active elections will appear here once an admin opens them.</p>
        </div>
      </main>
    </div>
  )
}
