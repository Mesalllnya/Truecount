import { useState, useEffect } from 'react'

/**
 * IsometricFlow.jsx
 * Visualisasi 3D isometrik: Flow Aplikasi TrueCount dari awal hingga akhir.
 * Menggunakan CSS 3D Transform (tanpa library tambahan) agar ringan.
 *
 * Data diambil dari GET /dev/flow (Admin + Dev only).
 */

const API_BASE = 'http://localhost:8000'

const ROLE_COLOR = {
  sistem: '#2e7d32',      // hijau
  admin:  '#ef6c00',      // oranye
  pemilih:'#1565c0',      // biru
  'admin+pemilih': '#6a1b9a', // ungu (campuran)
}

function getToken() {
  return localStorage.getItem('tc_token')
}

function parseRole(role) {
  // role dari DB bisa 'admin+pemilih' atau tunggal
  const key = String(role).toLowerCase()
  return ROLE_COLOR[key] ?? ROLE_COLOR.sistem
}

export default function IsometricFlow() {
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/dev/flow`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error('Gagal memuat data flow.')
        const data = await res.json()
        if (cancelled) return
        setNodes(data.flow ?? [])
      } catch (err) {
        if (cancelled) return
        setError(err.message || 'Gagal memuat flow aplikasi.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="iso-loading">
        <div className="iso-spinner" aria-hidden="true" />
        <p>Memuat visualisasi flow…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="iso-error" role="alert">{error}</div>
    )
  }

  return (
    <section className="iso-section" aria-labelledby="flow-title">
      <h2 id="flow-title" className="iso-section-title">
        <span style={{ fontSize: '1.4rem', marginRight: '0.5rem' }}>🗺️</span>
        Flow Aplikasi
      </h2>
      <p className="iso-section-desc">
        Alur lengkap aplikasi TrueCount dari awal hingga akhir. Klik blok untuk detail.
      </p>

      <div className="iso-container" role="region" aria-label="Diagram alur aplikasi isometrik">
        {/* Panah utama dari kiri ke kanan (top row) */}
        {nodes.map((n, i) => {
          const isActive = activeId === n.id
          const color = parseRole(n.role)

          return (
            <div
              key={n.id}
              className={`iso-node ${isActive ? 'iso-node--active' : ''}`}
              style={{
                '--x': n.x,
                '--y': n.y,
                '--color': color,
              }}
              onClick={() => setActiveId(activeId === n.id ? null : n.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setActiveId(activeId === n.id ? null : n.id)}
              aria-pressed={isActive}
              aria-label={n.label}
            >
              <div className="iso-face iso-face--top" />
              <div className="iso-face iso-face--front">
                <div className="iso-node-icon" style={{ color: color }}>
                  {nodeIcon(n.id)}
                </div>
                <span className="iso-node-label">{n.label}</span>
              </div>
              <div className="iso-face iso-face--side" />
              {isActive && (
                <div className="iso-detail">
                  <h3>{n.label}</h3>
                  <p>{n.description}</p>
                  <span className="iso-badge" style={{ background: color, color: '#fff' }}>
                    Peran: {n.role}
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {/* Panah antar node ( SVG di atas canvas isometrik ) */}
        <div className="iso-arrows">
          {nodes.flatMap(n =>
            (n.edges ?? []).map(targetId => {
              const src = nodes.find(x => x.id === n.id)
              const dst = nodes.find(x => x.id === targetId)
              if (!src || !dst) return null
              return (
                <svg
                  key={`${n.id}->${targetId}`}
                  className="iso-edge"
                  viewBox="0 0 200 120"
                  preserveAspectRatio="none"
                  style={{
                    left: 'var(--arrow-left, 0)',
                    top: 'var(--arrow-top, 0)',
                    width: 'var(--arrow-w, 200px)',
                    height: 'var(--arrow-h, 120px)',
                  }}
                  aria-hidden="true"
                >
                  <defs>
                    <marker id={`arrow-${n.id}-${targetId}`} markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill={parseRole(src.role)} />
                    </marker>
                  </defs>
                  <line
                    x1="10" y1="60" x2="190" y2="60"
                    stroke={parseRole(src.role)}
                    strokeWidth="2.5"
                    markerEnd={`url(#arrow-${n.id}-${targetId})`}
                  />
                </svg>
              )
            })
          )}
        </div>
      </div>

      {/* Legend warna peran */}
      <div className="iso-legend">
        <span className="iso-legend-item">
          <span className="iso-legend-dot" style={{ background: ROLE_COLOR.sistem }} /> Sistem
        </span>
        <span className="iso-legend-item">
          <span className="iso-legend-dot" style={{ background: ROLE_COLOR.admin }} /> Admin
        </span>
        <span className="iso-legend-item">
          <span className="iso-legend-dot" style={{ background: ROLE_COLOR.pemilih }} /> Pemilih
        </span>
      </div>
    </section>
  )
}

function nodeIcon(id) {
  const icons = {
    user: '👤',
    login: '🔐',
    setup: '🛡️',
    dashboard: '📊',
    vote: '🗳️',
    result: '⛓️',
  }
  return icons[id] ?? '⬢'
}
