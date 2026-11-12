import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import './ResultsPage.css'

const API_BASE = 'http://localhost:8000'

function ArrowLeftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M5 12l7 7M5 12l7-7" />
    </svg>
  )
}

export default function ResultsPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const token    = localStorage.getItem('tc_token')

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Auth guard
  if (!token) return <Navigate to="/masuk" replace />

  useEffect(() => {
    async function fetchResults() {
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch(`${API_BASE}/elections/${id}/results`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Gagal memuat hasil pemilihan.')
        setData(json)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchResults()
  }, [id, token])

  if (loading) {
    return (
      <div className="results-shell">
        <main className="results-main">
          <p style={{ color: '#6a6a67', marginTop: '3rem' }}>Memuat hasil…</p>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="results-shell">
        <main className="results-main">
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: '10px', padding: '1rem 1.25rem',
            color: '#b91c1c', fontSize: '0.875rem', marginTop: '2rem',
          }}>
            {error}
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/dasbor" className="results-back-btn">
              <ArrowLeftIcon />
              Kembali ke Dasbor
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const { election, total_votes, voter_count, participation_rate, results } = data
  const winner = results[0] ?? null
  const isClosed = election.status === 'closed'

  // Format tanggal
  function fmtDate(iso) {
    if (!iso) return '-'
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="results-shell">
      <main className="results-main">

        {/* ── Header ── */}
        <div className="results-head">
          <div>
            <span className={`results-status-badge results-status-badge--${isClosed ? 'closed' : 'active'}`}>
              {isClosed ? '✓ Selesai' : '⏳ Sedang berlangsung'}
            </span>
          </div>
          <h1>{election.title}</h1>
          {election.description && (
            <p className="results-meta">{election.description}</p>
          )}
          <p className="results-meta" style={{ marginTop: '0.35rem' }}>
            {fmtDate(election.start_time)} — {fmtDate(election.end_time)}
          </p>
        </div>

        {/* ── Stats cards ── */}
        <div className="results-stats">
          <div className="results-stat-card">
            <div className="results-stat-label">Total Suara</div>
            <div className="results-stat-value">{total_votes}</div>
          </div>
          <div className="results-stat-card">
            <div className="results-stat-label">Pemilih Terdaftar</div>
            <div className="results-stat-value">{voter_count}</div>
          </div>
          <div className="results-stat-card">
            <div className="results-stat-label">Partisipasi</div>
            <div className="results-stat-value">
              {participation_rate}<span>%</span>
            </div>
          </div>
        </div>

        {/* ── Daftar hasil per kandidat ── */}
        {results.length === 0 ? (
          <p style={{ color: '#6a6a67', fontSize: '0.9rem' }}>
            Belum ada suara yang masuk.
          </p>
        ) : (
          <div className="results-list">
            {results.map((r, i) => {
              const isWinner = isClosed && i === 0 && r.votes > 0
              return (
                <div
                  key={r.candidate_id}
                  className={`results-item${isWinner ? ' results-item--winner' : ''}`}
                >
                  <div className="results-item-header">
                    <div className="results-item-left">
                      <span className={`results-item-rank${isWinner ? ' results-item-rank--winner' : ''}`}>
                        #{i + 1}
                      </span>
                      <div>
                        <div className="results-item-name">
                          {r.name}
                          {isWinner && (
                            <span className="results-winner-badge">Pemenang</span>
                          )}
                        </div>
                        {r.vision && (
                          <div className="results-item-vision">{r.vision}</div>
                        )}
                      </div>
                    </div>
                    <div className="results-item-votes">
                      <div className="results-item-count">{r.votes}</div>
                      <div className="results-item-pct">{r.percentage}%</div>
                    </div>
                  </div>
                  <div className="results-bar-track" aria-hidden="true">
                    <div
                      className="results-bar-fill"
                      style={{ width: `${r.percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <Link to="/dasbor" className="results-back-btn">
          <ArrowLeftIcon />
          Kembali ke Dasbor
        </Link>

      </main>
    </div>
  )
}
