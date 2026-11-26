import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { logCamera } from './utils/cameraLogger'
import { loadAppConfig } from './lib/appConfig'
/* Cursor custom TrueCount dimuat terakhir (setelah semua CSS halaman via App.jsx)
   agar aturan kursor custom ini menang pada spesifikitas yang sama dengan
   cursor: pointer bawaan tiap halaman (contoh: .btn-submit Windows Hello). */
import './styles/cursor.css'

/* Jaring pengaman diagnostik (issue #54): error di LUAR React (event handler,
   async, WebView2) sering hilang tanpa jejak dan diduga kuat terkait layar
   putih. Direkam ke log diagnostik (cameraLogger) supaya akar masalah bisa
   dibongkar dari log, bukan tebakan. */
function logGlobalError(kind, message, stack) {
  try {
    logCamera('ERROR', kind, {
      message,
      stack: typeof stack === 'string' ? stack.slice(0, 1200) : undefined,
      url: window.location.href,
    })
  } catch {
    // Logging tidak boleh menghasilkan error baru.
  }
}
window.addEventListener('error', (event) => {
  logGlobalError('Uncaught window error', event?.message, event?.error?.stack)
})
window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason
  logGlobalError(
    'Unhandled promise rejection',
    reason?.message ?? String(reason),
    reason?.stack
  )
})

/* Config server dibaca SEBELUM render supaya semua request API memakai
   alamat yang benar sejak layar pertama. Kalau gagal, app tetap jalan
   dengan default build. */
loadAppConfig()
  .catch((err) => console.warn('[appConfig] memakai default build:', err))
  .finally(() => {
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </StrictMode>,
    )
  })
