import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { loadAppConfig } from './lib/appConfig'
/* Cursor custom TrueCount dimuat terakhir (setelah semua CSS halaman via App.jsx)
   agar aturan kursor custom ini menang pada spesifikitas yang sama dengan
   cursor: pointer bawaan tiap halaman (contoh: .btn-submit Windows Hello). */
import './styles/cursor.css'

/* Config server dibaca SEBELUM render supaya semua request API memakai
   alamat yang benar sejak layar pertama. Kalau gagal, app tetap jalan
   dengan default build. */
loadAppConfig()
  .catch((err) => console.warn('[appConfig] memakai default build:', err))
  .finally(() => {
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
