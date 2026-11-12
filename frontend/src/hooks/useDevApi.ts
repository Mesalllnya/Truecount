import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:8000'

function getToken(): string | null {
  return localStorage.getItem('tc_token')
}

interface DevApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook untuk fetch data dari endpoint dev (/dev/flow, /dev/crypto).
 *
 * - AbortController dipakai sebagai cleanup effect, sehingga request
 *   otomatis dibatalkan saat komponen unmount (tidak ada state update
 *   setelah unmount).
 * - `refetch` memicu ulang request tanpa perlu remount.
 */
export function useDevApi<T>(endpoint: string): DevApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(0)

  // Reset dilakukan di event handler (bukan di effect) supaya tidak
  // memicu render berantai; saat mount `loading` sudah true & `error` null.
  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    setRequestId((id) => id + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function load() {
      try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as T
        if (active) setData(json)
      } catch (err) {
        if (controller.signal.aborted) return
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat data')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
      controller.abort()
    }
  }, [endpoint, requestId])

  return { data, loading, error, refetch }
}
