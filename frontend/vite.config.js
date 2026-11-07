import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// https://v2.tauri.app/start/frontend/vite/
export default defineConfig(({ command }) => ({
  plugins: [react()],

  // Tauri butuh file:// protocol untuk dev — disable HMR overlay di mode desktop
  clearScreen: false,

  server: {
    // Port tetap agar Tauri bisa menunjuk ke sini
    port: 5173,
    strictPort: true,
    // Tauri mendengarkan event dari host ini
    host: '127.0.0.1',
    // HMR untuk hot reload saat desktop dev
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      port: 5183,
    },
    watch: {
      // Hindari Tauri rebuild berulang karena perubahan Rust
      ignored: ['**/src-tauri/**'],
    },
  },

  build: {
    // Tauri butuh target ES2021+ dengan output yang efisien
    // Pakai target yang kompatibel dengan esbuild/terser
    target:
      command === 'build'
        ? ['es2020', 'chrome90', 'safari13']
        : undefined,
    // Jangan minify pada dev — mempercepat iterasi
    // Terser adalah default Vite 8+, lebih stabil untuk syntax modern
    minify: command === 'build' ? 'terser' : false,
    // Tingkatkan batas chunk warning ke 1.5 MB
    chunkSizeWarningLimit: 1500,
    sourcemap: command !== 'build',
  },
}))
