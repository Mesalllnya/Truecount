import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './AboutPage.css'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'

/* ── SVG Icons ───────────────────────────────────────────── */
function Icon({ name, size = 20 }) {
  const icons = {
    user: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    school: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6a2 2 0 0 1-2 2h-2" />
        <path d="M10 10.5 8 15H6a2 2 0 0 1-2-2v-5.5" />
        <path d="M12 2l10 5.5v5.5" />
        <path d="M2 10.5 12 5l10 5.5" />
        <path d="M8 15h2" />
      </svg>
    ),
    code: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    shield: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    arrow: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    ),
    check: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    users: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    award: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="7" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  }
  return icons[name] ?? null
}

/* ── Scroll-reveal hook ─────────────────────────────────── */
function useReveal(threshold = 0.12) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

/* ── Team Data ───────────────────────────────────────────── */
const team = [
  {
    number: '01',
    name: 'Rio Meidi Ataurrahman',
    role: 'Authentication & User Management',
    sprints: 'Sprint 1 & 4',
    focus: ['Auth System', 'Invite Flow', 'JWT & Argon2id', 'WebAuthn / USB Token', 'Tauri Desktop'],
    description: 'Mengembangkan seluruh sistem autentikasi - dari register invite-only, JWT custom HS256, hingga integrasi MFA biometrik dan token USB. Bertanggung jawab pada keamanan akses dan wrapper desktop Tauri.',
    university: 'UPN "Veteran" Yogyakarta',
    major: 'S1 Informatika',
    batch: 'Angkatan 2024',
    github: 'https://github.com/orions29', // placeholder
    linkedin: 'https://linkedin.com/in/riomeidia', // placeholder
  },
  {
    number: '02',
    name: 'Muhamad Ifsal Fadhilah',
    role: 'Election Management & Voting System',
    sprints: 'Sprint 2',
    focus: ['Election CRUD', 'Candidate CRUD', 'Voting Page', 'Result Tallying', 'Ballot Privacy'],
    description: 'Membangun fitur inti pemungutan suara: manajemen pemilihan, kandidat, registrasi voter, halaman voting, dan perhitungan hasil. Memastikan privacy by design dengan pemisahan tabel voters dan ballots.',
    university: 'UPN "Veteran" Yogyakarta',
    major: 'S1 Informatika',
    batch: 'Angkatan 2024',
    github: 'https://github.com/Mesalllnya', // placeholder
    linkedin: '#', // placeholder
  },
  {
    number: '03',
    name: 'Erlan Rifqi Davin D',
    role: 'Cryptography & Advanced Security',
    sprints: 'Sprint 3',
    focus: ['Vigenere Cipher', 'AES-256-GCM', 'ChaCha20-Poly1305', 'Steganography LSB', 'Blockchain Log'],
    description: 'Mengimplementasikan lapisan kriptografi: enkripsi pesan & file, steganografi, serta blockchain sederhana untuk audit trail. Mengelola tabel encrypted_messages, encrypted_files, dan blocks.',
    university: 'UPN "Veteran" Yogyakarta',
    major: 'S1 Informatika',
    batch: 'Angkatan 2024',
    github: '#', // placeholder
    linkedin: '#', // placeholder
  },
]

/* ── Project Milestones ─────────────────────────────────── */
const milestones = [
  { sprint: 'Sprint 1', title: 'Authentication & Invite', status: 'done', items: ['Register/Login JWT', 'Invite-only system', 'Admin dashboard', 'Landing page', '41 test pass'] },
  { sprint: 'Sprint 2', title: 'Election & Voting', status: 'progress', items: ['Election CRUD', 'Candidate CRUD', 'Voting page', 'Result tally', 'Ballot encryption'] },
  { sprint: 'Sprint 3', title: 'Cryptography', status: 'pending', items: ['Vigenere/AES/ChaCha20', 'File encryption', 'Steganography LSB', 'Blockchain log', 'Crypto testing'] },
  { sprint: 'Sprint 4', title: 'MFA & Desktop', status: 'partial', items: ['WebAuthn biometrik', 'USB token', 'PHP sidecar bundling', 'Desktop installer', 'Final audit'] },
]

/* ── Tech Stack ─────────────────────────────────────────── */
const techStack = [
  { category: 'Frontend', items: ['React 19', 'Vite 8', 'React Router 7', 'CSS Variables'] },
  { category: 'Backend', items: ['PHP 8.1+', 'Native (no framework)', 'JWT HS256 Custom', 'Argon2id'] },
  { category: 'Database', items: ['MySQL 8 / MariaDB 10.6', '11 Tables', 'Privacy by Design'] },
  { category: 'Desktop', items: ['Tauri v2 (Rust)', 'Auto-spawn PHP', 'Native Installer'] },
  { category: 'Security', items: ['E2E Encryption', 'WebAuthn', 'USB Token', 'Blockchain Audit'] },
  { category: 'Tools', items: ['Git', 'npm', 'Concurrently', 'Terser'] },
]

/* ── Main ────────────────────────────────────────────────── */
export default function AboutPage() {
  const [heroRef, heroVis] = useReveal()
  const [teamRef, teamVis] = useReveal()
  const [milestoneRef, milestoneVis] = useReveal()
  const [techRef, techVis] = useReveal()

  return (
    <div className="about">
      {/* ══ HERO ═════════════════════════════════════════════ */}
      <main
        ref={heroRef}
        className={`about-hero${heroVis ? ' about-hero--visible' : ''}`}
      >
        <div className="hero-content">
          <p className="hero-eyebrow">Tentang Kami</p>
          <h1>
            Tim <em>TrueCount</em> -<br />
            Mahasiswa yang membangun<br />
            e-voting aman.
          </h1>
          <p className="hero-sub">
            TrueCount dikembangkan sebagai <strong> Proyek Akhir Mata Kuliah Kriptografi </strong>
            oleh tiga mahasiswa S1 Informatika UPN "Veteran" Yogyakarta Angkatan 2024.
            Kami percaya suara setiap orang berhak dihitung dengan jujur, aman, dan transparan.
          </p>
          <div className="hero-meta">
            <div className="meta-item">
              <Icon name="award" size={18} />
              <span>Proyek Akhir Kriptografi</span>
            </div>
            <div className="meta-item">
              <Icon name="school" size={18} />
              <span>UPN "Veteran" Yogyakarta</span>
            </div>
            <div className="meta-item">
              <Icon name="users" size={18} />
              <span>3 Anggota Tim</span>
            </div>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-visual-accent" />
          <div className="hero-visual-frame">
            <div className="hero-placeholder">
              <Icon name="code" size={64} />
            </div>
            <div className="hero-img-tag">
              <Icon name="check" size={12} />
              <span>Academic Project</span>
            </div>
          </div>
          <p className="hero-deco-text" aria-hidden="true">SECURE · VERIFIED · TRUSTED</p>
        </div>
      </main>

      {/* ══ TEAM ════════════════════════════════════════════ */}
      <section ref={teamRef} className={`section team-section${teamVis ? ' team-section--visible' : ''}`}>
        <div className="section-head">
          <p className="section-label">Anggota Tim</p>
          <h2 className="section-title">Tiga orang.<br />Satu visi.</h2>
        </div>
        <div className="team-grid">
          {team.map((member, i) => (
            <article key={member.number} className="team-card" style={{ '--delay': `${i * 120}ms` }}>
              <div className="team-card-inner">
                {/* Avatar placeholder */}
                <div className="team-avatar">
                  <div className="avatar-placeholder">
                    <Icon name="user" size={32} />
                  </div>
                  <span className="team-number">{member.number}</span>
                </div>

                <div className="team-info">
                  <h3 className="team-name">{member.name}</h3>
                  <p className="team-role">{member.role}</p>
                  <p className="team-sprints">
                    <Icon name="award" size={14} />
                    <span>{member.sprints}</span>
                  </p>

                  <div className="team-focus">
                    {member.focus.map((f, idx) => (
                      <span key={idx} className="focus-tag">{f}</span>
                    ))}
                  </div>

                  <p className="team-desc">{member.description}</p>

                  <div className="team-meta">
                    <div className="meta-row">
                      <Icon name="school" size={14} />
                      <span>{member.university}</span>
                    </div>
                    <div className="meta-row">
                      <Icon name="user" size={14} />
                      <span>{member.major} - {member.batch}</span>
                    </div>
                  </div>

                  <div className="team-links">
                    <a href={member.github} className="team-link" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" /></svg>
                    </a>
                    <a href={member.linkedin} className="team-link" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                    </a>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ══ MILESTONES ══════════════════════════════════════ */}
      <section
        ref={milestoneRef}
        className={`section milestones-section${milestoneVis ? ' milestones-section--visible' : ''}`}
      >
        <div className="section-head section-head--light">
          <p className="section-label">Progres Proyek</p>
          <h2 className="section-title">Dari konsep<br />ke kenyataan.</h2>
        </div>
        <div className="milestones-timeline">
          {milestones.map((m, i) => (
            <div key={m.sprint} className={`milestone${m.status === 'done' ? ' milestone--done' : ''}${m.status === 'progress' ? ' milestone--progress' : ''}${m.status === 'partial' ? ' milestone--partial' : ''}`} style={{ '--delay': `${i * 140}ms` }}>
              <div className="milestone-marker">
                <span className="milestone-sprint">{m.sprint}</span>
                <div className={`milestone-dot${m.status === 'done' ? ' done' : ''}${m.status === 'progress' ? ' progress' : ''}${m.status === 'partial' ? ' partial' : ''}`} />
              </div>
              <div className="milestone-content">
                <h3 className="milestone-title">{m.title}</h3>
                <ul className="milestone-items">
                  {m.items.map((item, idx) => (
                    <li key={idx}>
                      <Icon name="check" size={14} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ TECH STACK ═══════════════════════════════════════ */}
      <section
        ref={techRef}
        className={`section tech-section${techVis ? ' tech-section--visible' : ''}`}
      >
        <div className="section-head">
          <p className="section-label">Teknologi</p>
          <h2 className="section-title">Stack yang kami<br />pilih dengan hati-hati.</h2>
        </div>
        <div className="tech-grid">
          {techStack.map((t, i) => (
            <div key={t.category} className="tech-card" style={{ '--delay': `${i * 80}ms` }}>
              <h3 className="tech-category">{t.category}</h3>
              <ul className="tech-items">
                {t.items.map((item, idx) => (
                  <li key={idx}>
                    <Icon name="check" size={14} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ══ CTA ══════════════════════════════════════════════ */}
      <section className="section cta-section">
        <div className="cta-inner">
          <h2>Tertarik mengikuti perjalanan kami?</h2>
          <p>Jelajahi platform e-voting yang kami bangun - aman, transparan, dan terverifikasi.</p>
          <Link to="/masuk" className="btn-solid btn-lg">
            Masuk ke TrueCount <Icon name="arrow" size={16} />
          </Link>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════ */}
      <footer className="footer">
        <Link to="/" className="nav-brand" aria-label="TrueCount - Beranda">
          <img src={navLogoLight} alt="TrueCount" className="nav-logo" />
        </Link>
        <p>Sistem E-Voting Aman - Proyek Akhir Kriptografi</p>
        <p className="footer-copy">© 2026 UPN "Veteran" Yogyakarta</p>
      </footer>
    </div>
  )
}