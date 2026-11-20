import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// https://v2.tauri.app/start/frontend/vite/

// TC_HTTPS=1 (npm run dev:https) → mode demo browser via LAN:
// server HTTPS self-signed supaya kamera (getUserMedia) tersedia — browser
// hanya mengekspos kamera di secure context (HTTPS / localhost) — dan host
// dibuka agar bisa diakses dari HP / PC lain di jaringan yang sama.
const httpsMode = process.env.TC_HTTPS === '1'

// Route API backend yang diproxy ke PHP (127.0.0.1:8000) supaya halaman dan
// API berada di origin yang sama: tanpa CORS dan tanpa mixed content,
// sehingga alamat server bisa diisi https://<ip-lan>:5173 (sama dengan halaman).
const API_PREFIXES = [
  '/health',
  '/auth',
  '/invites',
  '/mfa',
  '/elections',
  '/users',
  '/voice-messages',
  '/encrypted-messages',
  '/dev',
  '/uploads',
  '/__tc-setup',
]

const apiProxy = Object.fromEntries(
  API_PREFIXES.map((prefix) => [
    prefix,
    { target: 'http://127.0.0.1:8000', changeOrigin: true },
  ]),
)

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(httpsMode ? [basicSsl()] : [])],

  // Tauri butuh file:// protocol untuk dev - disable HMR overlay di mode desktop
  clearScreen: false,

  server: {
    // Port tetap agar Tauri bisa menunjuk ke sini
    port: 5173,
    strictPort: true,
    // Tauri mendengarkan event dari host ini; mode HTTPS dibuka untuk LAN
    host: httpsMode ? true : 'localhost',
    // HMR untuk hot reload saat desktop dev (mode HTTPS: biarkan Vite
    // menentukan sendiri — wss — supaya halaman https tetap bisa HMR)
    ...(httpsMode
      ? {}
      : {
          hmr: {
            protocol: 'ws',
            host: 'localhost',
            port: 5183,
          },
        }),
    proxy: apiProxy,
    watch: {
      // Hindari Tauri rebuild berulang karena perubahan Rust
      ignored: ['**/src-tauri/**'],
    },
  },

  preview: {
    port: 4173,
    proxy: apiProxy,
  },

  build: {
    // Tauri butuh target ES2021+ dengan output yang efisien
    // Pakai target yang kompatibel dengan esbuild/terser
    target:
      command === 'build'
        ? ['es2020', 'chrome90', 'safari13']
        : undefined,
    // Jangan minify pada dev - mempercepat iterasi
    // Terser adalah default Vite 8+, lebih stabil untuk syntax modern
    minify: command === 'build' ? 'terser' : false,
    // Tingkatkan batas chunk warning ke 1.5 MB
    chunkSizeWarningLimit: 1500,
    sourcemap: command !== 'build',
  },
}))
