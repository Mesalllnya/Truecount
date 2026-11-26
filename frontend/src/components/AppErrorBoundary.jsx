import { Component } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { logCamera } from '../utils/cameraLogger'
import { stopAllCameraStreams } from '../hooks/useAuthSecurity'
import '../pages/AuthPage.css'
import './AppErrorBoundary.css'

/**
 * AppErrorBoundary — jaring pengaman level aplikasi (issue #54).
 *
 * Tanpa boundary ini, error JS yang tidak tertangkap membuat SELURUH pohon
 * React di-unmount → layar putih polos tanpa pesan, dan cleanup kamera bisa
 * tidak sempat jalan sehingga LED kamera tetap menyala.
 *
 * Saat error ditangkap:
 *  1. Semua stream kamera DIPAKSA mati (stopAllCameraStreams) — walau cleanup
 *     React gagal di tengah jalan, LED tidak tertinggal menyala.
 *  2. Error + konteks (URL, stack, component stack) dicatat ke log diagnostik
 *     (cameraLogger) supaya akar masalah bisa dibongkar dari log, bukan tebakan.
 *  3. User melihat pesan yang bisa ditindaklanjuti + tombol muat ulang,
 *     bukan layar putih.
 */
export default class AppErrorBoundary extends Component {
  state = { error: null, info: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // 1. Matikan kamera — jangan biarkan LED menyala di atas layar error.
    try {
      stopAllCameraStreams()
    } catch (stopErr) {
      console.warn('[ErrorBoundary] Gagal mematikan kamera:', stopErr)
    }

    // 2. Rekam bukti ke log diagnostik (tersimpan juga via Tauri di desktop).
    try {
      logCamera('ERROR', 'Uncaught React error — ditangkap AppErrorBoundary', {
        message: error?.message ?? String(error),
        stack: error?.stack?.slice(0, 1200),
        componentStack: info?.componentStack?.slice(0, 1200),
        url: typeof window !== 'undefined' ? window.location.href : '',
      })
    } catch (logErr) {
      console.warn('[ErrorBoundary] Gagal menulis log:', logErr)
    }
    console.error('[TrueCount] Uncaught error:', error, info)

    this.setState({ info })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    const detail = [
      error?.message ?? String(error),
      info?.componentStack ? info.componentStack.trim().slice(0, 800) : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-state">
            <div className="auth-state-icon auth-state-icon--error" aria-hidden="true">
              <AlertCircle size={28} strokeWidth={2} />
            </div>
            <h1>Terjadi Kesalahan</h1>
            <p>
              Aplikasi tidak dapat menampilkan halaman ini karena terjadi
              kesalahan tak terduga. Muat ulang aplikasi untuk melanjutkan.
            </p>
            <div className="auth-state-cta">
              <button type="button" className="btn-submit" onClick={this.handleReload}>
                <RefreshCw size={16} strokeWidth={2} /> Muat Ulang Aplikasi
              </button>
            </div>
            <details className="ae-details">
              <summary>Detail teknis</summary>
              <pre>{detail}</pre>
            </details>
          </div>
        </div>
        <div className="auth-mosaic" aria-hidden="true" />
      </div>
    )
  }
}
