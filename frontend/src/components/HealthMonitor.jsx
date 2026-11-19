import { useEffect, useRef } from 'react'
import { apiBase, apiUrl } from '../lib/appConfig'

const POLL_MS = 15000
const RETRY_MS = 1500
const MAX_STARTUP_RETRY = 5

/**
 * HealthMonitor - TIDAK menampilkan apa pun di UI (render null).
 * Hanya memantau /health di background dan menulis ke error log:
 *   - Server tidak bisa dijangkau  → console.error
 *   - Server 500 / config rusak    → console.error (pesan dari backend)
 *   - Database terputus            → console.warn (backend juga mencatat di app.log)
 * Status normal tidak dicatat supaya log tidak berisik.
 *
 * Backend PHP di-spawn oleh app Tauri secara async, jadi beberapa detik
 * pertama setelah aplikasi dibuka server bisa belum siap → retry cepat.
 */
export default function HealthMonitor() {
  const prevRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let retryTimer = null
    let consecutiveFails = 0

    async function check() {
      try {
        const res  = await fetch(apiUrl('/health'), { signal: AbortSignal.timeout(4000) })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return

        // Backend terjangkau tapi gagal (mis. .env hilang → 500 JSON)
        if (!res.ok) {
          const key = `http-${res.status}`
          if (prevRef.current !== key) {
            prevRef.current = key
            console.error(
              `[TrueCount] Health check: backend error ${res.status}` +
              (data.error ? ` - ${data.error}` : '') +
              '. Cek backend/storage/logs/php_errors.log.'
            )
          }
          return
        }

        consecutiveFails = 0
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
        consecutiveFails += 1
        if (prevRef.current !== 'down') {
          prevRef.current = 'down'
          console.error(
            '[TrueCount] Health check: server tidak dapat dijangkau di ' + apiBase() + ' - pastikan backend PHP berjalan.'
          )
        }
        // Server mungkin baru di-spawn, coba lagi sebentar sebelum menunggu polling
        if (consecutiveFails <= MAX_STARTUP_RETRY) {
          retryTimer = setTimeout(check, RETRY_MS)
        }
      }
    }

    check()
    const timer = setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
      clearTimeout(retryTimer)
    }
  }, [])

  return null
}
