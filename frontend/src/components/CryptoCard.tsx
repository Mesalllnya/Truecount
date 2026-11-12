import {
  Key,
  FileText,
  Lock,
  Shield,
  Image,
  GitBranch,
  Cpu,
  Hash,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { memo, type CSSProperties, type KeyboardEvent } from 'react'
import { withAlpha } from './isoTheme'

const ALGO_ICONS: Record<string, LucideIcon> = {
  argon2id: Key,
  'jwt-hs256': FileText,
  'aes-256-gcm': Lock,
  'chacha20-poly1305': Shield,
  vigenere: FileText,
  'steganografi-lsb': Image,
  blockchain: GitBranch,
  'ecdsa-p256': Cpu,
}

/* Warna aksen per algoritma — membedakan kategori supaya grid mudah dipindai. */
const ALGO_COLORS: Record<string, string> = {
  argon2id: '#2e7d32',
  'jwt-hs256': '#1d4ed8',
  'aes-256-gcm': '#c0392b',
  'chacha20-poly1305': '#0f766e',
  vigenere: '#b45309',
  'steganografi-lsb': '#6a1b9a',
  blockchain: '#ef6c00',
  'ecdsa-p256': '#0e7490',
}

interface CryptoCardProps {
  algo: {
    id: string
    name: string
    purpose: string
    file: string
    key_size: string
    mode: string
    description: string
  }
  isActive: boolean
  onActivate: () => void
}

const CryptoCard = memo(function CryptoCard({ algo, isActive, onActivate }: CryptoCardProps) {
  const Icon = ALGO_ICONS[algo.id] || Hash
  const color = ALGO_COLORS[algo.id] || '#6a6a67'

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate()
    }
  }

  return (
    <div
      className={`iso-crypto-card ${isActive ? 'iso-crypto-card--active' : ''}`}
      style={{ '--color': color } as CSSProperties}
      onClick={onActivate}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-expanded={isActive}
      aria-pressed={isActive}
      aria-label={`${algo.name} — ${algo.purpose}`}
    >
      <div className="iso-crypto-head">
        <span className="iso-crypto-icon" style={{ color, background: withAlpha(color, 0.12) }} aria-hidden="true">
          <Icon size={22} strokeWidth={1.75} />
        </span>
        <span className="iso-crypto-chevron" aria-hidden="true">
          <ChevronDown size={18} strokeWidth={2} />
        </span>
      </div>
      <h3 className="iso-crypto-name">{algo.name}</h3>
      <span className="iso-crypto-purpose">{algo.purpose}</span>
      {isActive && (
        <div className="iso-crypto-detail">
          <p>{algo.description}</p>
          <div className="iso-crypto-meta">
            <div>
              <span className="iso-crypto-meta-label">File</span>
              <span className="iso-crypto-meta-value iso-crypto-file">{algo.file}</span>
            </div>
            <div>
              <span className="iso-crypto-meta-label">Key size</span>
              <span className="iso-crypto-meta-value">{algo.key_size}</span>
            </div>
            <div>
              <span className="iso-crypto-meta-label">Mode</span>
              <span className="iso-crypto-meta-value">{algo.mode}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
CryptoCard.displayName = 'CryptoCard'

export default CryptoCard
