import { useEffect, useRef } from 'react'

const API = 'http://localhost:8000'
const POLL_MS = 15000

/**
 * HealthMonitor — TIDAK menampilkan apa pun di UI (render null).
 * Hanya memantau /health di background dan menulis ke error log:
 *   - Server tidak bisa dijangkau  → console.error
 *   - Database terputus            → console.warn (backend juga mencatat di app.log)
 * Status normal tidak dicatat supaya log tidak berisik.
 */
export default function HealthMonitor() {
  const prevRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res  = await fetch(`${API}/health`, { signal: AbortSignal.timeout(4000) })
        const data = await res.json()
        if (cancelled) return

        const prev = prevRef.current
        const ok   = data.status === 'ok'
        const db   = data.database === 'connected'

        if (!ok || !db) {
          // Log hanya saat ada perubahan status (bukan tiap polling)
          const key = `${ok}-${db}`
          if (prev !== key) {
            prevRef.current = key
            if (!db) {
              console.warn(
                `[TrueCount] Health check: database tidak tersambung (status=${data.status}). Cek backend/storage/logs/app.log.`
              )
            } else {
              console.warn(`[TrueCount] Health check: server dalam kondisi degradasi (${data.status}).`)
            }
          }
        } else {
          prevRef.current = 'ok'
        }
      } catch {
        if (cancelled) return
        if (prevRef.current !== 'down') {
          prevRef.current = 'down'
          console.error(
            '[TrueCount] Health check: server tidak dapat dijangkau di ' + API + ' — pastikan backend PHP berjalan.'
          )
        }
      }
    }

    check()
    const timer = setInterval(check, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  return null
}
