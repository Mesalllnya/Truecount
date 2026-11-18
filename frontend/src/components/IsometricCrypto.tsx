import { Lock } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useDevApi } from '../hooks/useDevApi'
import CryptoCard from './CryptoCard'
import { IsoLoading, IsoError, SectionHeader } from './IsoShared'

interface CryptoAlgorithm {
  id: string
  name: string
  purpose: string
  file: string
  key_size: string
  mode: string
  description: string
}

interface CryptoData {
  algorithms: CryptoAlgorithm[]
}

/** Main IsometricCrypto component - Algoritma Kriptografi visualisasi */
export default function IsometricCrypto() {
  const { data, loading, error, refetch } = useDevApi<CryptoData>('/dev/crypto')
  const [activeId, setActiveId] = useState<string | null>(null)

  const algorithms = useMemo(() => data?.algorithms ?? [], [data])

  if (loading) return <IsoLoading message="Memuat visualisasi kriptografi…" />
  if (error) return <IsoError message={error} onRetry={refetch} />

  return (
    <section className="iso-section" aria-labelledby="crypto-title">
      <SectionHeader
        icon={Lock}
        title="Algoritma Kriptografi"
        description="Algoritma yang diterapkan di TrueCount untuk menjaga kerahasiaan, integritas, dan autentikasi. Klik kartu untuk detail implementasi."
      />

      <div className="iso-crypto-grid" role="region" aria-label="Grid algoritma kriptografi">
        {algorithms.map((algo) => (
          <CryptoCard
            key={algo.id}
            algo={algo}
            isActive={activeId === algo.id}
            onActivate={() => setActiveId((prev) => (prev === algo.id ? null : algo.id))}
          />
        ))}
      </div>
    </section>
  )
}