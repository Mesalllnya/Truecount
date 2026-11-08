import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
/* Cursor custom TrueCount dimuat terakhir (setelah semua CSS halaman via App.jsx)
   agar aturan kursor custom ini menang pada spesifikitas yang sama dengan
   cursor: pointer bawaan tiap halaman (contoh: .btn-submit Windows Hello). */
import './styles/cursor.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
