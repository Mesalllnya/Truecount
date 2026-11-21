import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import {
  defaultAppConfig,
  getAppConfig,
  getLanIp,
  normalizeServerUrl,
  saveAppConfig,
  testServerConnection,
} from '../lib/appConfig'
import './ClientConfigPage.css'

const MODES = [
  {
    id: 'client',
    label: 'Client',
    icon: 'globe',
    hint: 'PC ini hanya menjalankan UI. Semua data dikirim ke laptop server.',
  },
  {
    id: 'server',
    label: 'Server',
    icon: 'server',
    hint: 'Laptop ini menjalankan PHP untuk dirinya sendiri dan client di LAN.',
  },
  {
    id: 'standalone',
    label: 'Standalone',
    icon: 'wifi',
    hint: 'PHP lokal hanya untuk laptop ini, tanpa akses dari PC lain.',
  },
]

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isLoopbackUrl(raw) {
  try {
    const host = new URL(raw).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

function StatusRow({ label, value, tone = 'default' }) {
  return (
    <div className="cc-status-row">
      <dt>{label}</dt>
      <dd data-tone={tone}>{value}</dd>
    </div>
  )
}

export default function ClientConfigPage() {
  const navigate = useNavigate()
  const [active, setActive] = useState(() => getAppConfig())

  const [mode, setMode] = useState(active.mode)
  const [url, setUrl] = useState(active.serverUrl)
  const [lanIp, setLanIp] = useState(null)
  const [test, setTest] = useState({ state: 'idle', health: null, error: null, attempt: 0, attempts: 0 })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedOk, setSavedOk] = useState(false)

  // Nomor "run" pemeriksaan koneksi — membatalkan retry lama yang masih berjalan.
  const connectRunRef = useRef(0)

  const validation = normalizeServerUrl(url)
  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0]
  const isTesting = test.state === 'testing'
  const lanUrl = lanIp ? `http://${lanIp}:8000` : ''

  useEffect(() => {
    document.title = 'Koneksi Server - TrueCount'
    return () => { document.title = 'TrueCount - Secure E-Voting' }
  }, [])

  useEffect(() => {
    let cancelled = false
    getLanIp().then((ip) => {
      if (!cancelled && ip) setLanIp(ip)
    })
    return () => { cancelled = true }
  }, [])

  // Saat halaman ditinggalkan, batalkan retry koneksi yang masih berjalan.
  useEffect(() => () => { connectRunRef.current += 1 }, [])

  // Mode Server: isi otomatis dengan IP LAN laptop ini, bukan localhost.
  // Hanya saat lanIp/mode berubah, supaya user tetap bisa mengetik alamat lain.
  useEffect(() => {
    if (!lanUrl || mode !== 'server') return
    setUrl((current) => (isLoopbackUrl(current) ? lanUrl : current))
  }, [lanUrl, mode])

  function useLanAddress() {
    if (!lanUrl) return
    setUrl(lanUrl)
    resetTest()
  }

  function resetTest() {
    setTest({ state: 'idle', health: null, error: null, attempt: 0, attempts: 0 })
    setSavedOk(false)
  }

  /**
   * Periksa koneksi ke server dari halaman ini.
   * retries > 1: coba ulang otomatis (untuk kasus backend baru dinyalakan
   * dan butuh waktu beberapa detik sebelum siap).
   */
  async function runConnectionCheck(targetUrl, { retries = 1, prefix = '' } = {}) {
    const runId = ++connectRunRef.current

    for (let attempt = 1; attempt <= retries; attempt++) {
      if (runId !== connectRunRef.current) return
      setTest({ state: 'testing', health: null, error: null, attempt, attempts: retries })

      try {
        const health = await testServerConnection(targetUrl)
        if (runId !== connectRunRef.current) return
        setTest({ state: 'ok', health, error: null, attempt, attempts: retries })
        return
      } catch (err) {
        if (runId !== connectRunRef.current) return
        const message = err instanceof Error ? err.message : 'Tes koneksi gagal.'

        if (attempt === retries) {
          setTest({
            state: 'error',
            health: null,
            error: prefix + message,
            attempt,
            attempts: retries,
          })
          return
        }

        // Jeda sebentar sebelum mencoba lagi.
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    }
  }

  async function handleTest() {
    setSaveError(null)
    await runConnectionCheck(url, { retries: 1 })
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!validation.ok || saving) return

    setSaving(true)
    setSaveError(null)

    try {
      await saveAppConfig({ mode, serverUrl: validation.url })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi.')
      setSaving(false)
      return
    }

    setActive({ mode, serverUrl: validation.url })
    setSavedOk(true)
    setSaving(false)

    // Tidak dilempar ke landing page: langsung coba hubungi server dari
    // halaman ini, dengan beberapa kali percobaan otomatis.
    await runConnectionCheck(validation.url, {
      retries: 3,
      prefix: 'Konfigurasi tersimpan, tetapi server belum terhubung. ',
    })
  }

  function goHome() {
    try {
      window.location.assign('/')
    } catch {
      navigate('/', { replace: true })
    }
  }

  function handleReset() {
    const fallback = defaultAppConfig()
    setMode(fallback.mode)
    setUrl(fallback.serverUrl)
    resetTest()
  }

  const health = test.health
  const databaseOk = health?.database === 'connected'
  const serverId = health?.server_id ? String(health.server_id).slice(0, 8) : '-'

  return (
    <div className="cc-shell">
      <header className="cc-header">
        <button type="button" className="cc-back" onClick={() => navigate(-1)}>
          <Icon name="arrow-left" size={16} />
          Kembali
        </button>

        <div className="cc-header-main">
          <div className="cc-heading">
            <h1>
              <Icon name="server" size={22} />
              Koneksi Server
            </h1>
            <p>Arahkan aplikasi ini ke laptop yang menjalankan pemilihan.</p>
          </div>

          <div className="cc-current" title={active.serverUrl}>
            <span className="cc-current-dot" data-mode={active.mode} />
            <div>
              <span className="cc-current-label">Alamat aktif</span>
              <strong>{active.serverUrl.replace(/^https?:\/\//, '')}</strong>
            </div>
          </div>
        </div>
      </header>

      <main className="cc-main">
        <form className="cc-panel cc-form" onSubmit={handleSave} noValidate>
          <fieldset className="cc-fieldset">
            <legend>Mode aplikasi</legend>
            <div className="cc-modes" role="radiogroup" aria-label="Mode aplikasi">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === item.id}
                  className={`cc-mode${mode === item.id ? ' is-active' : ''}`}
                  onClick={() => {
                    setMode(item.id)
                    resetTest()
                  }}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <p className="cc-hint">{activeMode.hint}</p>
          </fieldset>

          <div className="cc-field">
            <label htmlFor="cc-server-url">Alamat server</label>
            <div className={`cc-input-wrap${validation.ok ? '' : ' has-error'}`}>
              <Icon name="globe" size={18} />
              <input
                id="cc-server-url"
                name="serverUrl"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck="false"
                placeholder="http://192.168.2.102:8000"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                  resetTest()
                }}
                aria-invalid={validation.ok ? 'false' : 'true'}
                aria-describedby={validation.ok ? 'cc-url-help' : 'cc-url-error'}
              />
            </div>
            {validation.ok ? (
              <p className="cc-hint" id="cc-url-help">
                Host dan port saja. Contoh: <code>http://192.168.2.102:8000</code>
              </p>
            ) : (
              <p className="cc-error" id="cc-url-error" role="alert">
                {validation.error}
              </p>
            )}
            {mode === 'server' && lanUrl && (
              <p className="cc-hint cc-lan-hint">
                IP LAN laptop ini: <code>{lanUrl}</code>
                {url !== lanUrl && (
                  <button type="button" className="cc-lan-use" onClick={useLanAddress}>
                    Pakai
                  </button>
                )}
              </p>
            )}
          </div>

          {saveError && <p className="cc-error" role="alert">{saveError}</p>}

          <div className="cc-actions">
            <button
              type="button"
              className="cc-btn cc-btn--secondary"
              onClick={handleTest}
              disabled={!validation.ok || isTesting}
            >
              <Icon name="activity" size={17} />
              {isTesting ? 'Menguji…' : 'Tes koneksi'}
            </button>

            <button
              type="submit"
              className="cc-btn cc-btn--primary"
              disabled={!validation.ok || saving}
            >
              <Icon name="save" size={17} />
              {saving ? 'Menyimpan…' : 'Simpan & sambungkan'}
            </button>
          </div>

          <button type="button" className="cc-reset" onClick={handleReset}>
            <Icon name="refresh" size={15} />
            Reset ke default build
          </button>
        </form>

        <aside className="cc-panel cc-status" aria-live="polite">
          <div className="cc-status-head">
            <h2>Status koneksi</h2>
            <span className="cc-pill" data-state={test.state}>
              {test.state === 'ok' ? 'Terhubung' : test.state === 'error' ? 'Gagal' : isTesting ? 'Menguji' : 'Belum dites'}
            </span>
          </div>

          {test.state === 'idle' && (
            <p className="cc-status-empty">
              Tekan <strong>Tes koneksi</strong> untuk memastikan PC ini benar-benar
              mencapai laptop server sebelum menyimpan.
            </p>
          )}

          {test.state === 'testing' && (
            <p className="cc-status-empty">
              <Icon name="activity" size={15} /> Menyambungkan ke server
              {test.attempts > 1 ? ` (percobaan ${test.attempt} dari ${test.attempts})` : ''}…
            </p>
          )}

          {test.state === 'error' && (
            <div className="cc-status-error" role="alert">
              <Icon name="alert" size={18} />
              <p>{test.error}</p>
            </div>
          )}

          {savedOk && test.state === 'ok' && (
            <div className="cc-note cc-note--ok">
              <p>Konfigurasi tersimpan dan server terhubung.</p>
              <button type="button" className="cc-btn cc-btn--secondary" onClick={goHome}>
                <Icon name="arrow" size={15} />
                Buka beranda
              </button>
            </div>
          )}

          {savedOk && test.state === 'error' && (
            <p className="cc-note cc-note--warn">
              Konfigurasi sudah tersimpan. Kalau server baru saja dinyalakan, beri
              waktu beberapa detik lalu tekan <strong>Tes koneksi</strong> untuk
              mencoba lagi.
            </p>
          )}

          {test.state === 'ok' && (
            <dl className="cc-status-list">
              <StatusRow
                label="Server"
                value={`${health?.server_label || 'TrueCount'}${health?.server_id ? ` · ${serverId}` : ''}`}
                tone="strong"
              />
              <StatusRow
                label="Aplikasi"
                value={health?.app || 'TrueCount'}
              />
              <StatusRow
                label="Database"
                value={databaseOk ? 'Terhubung' : 'Bermasalah'}
                tone={databaseOk ? 'ok' : 'warn'}
              />
              <StatusRow
                label="Status"
                value={health?.status === 'ok' ? 'Normal' : 'Degraded'}
                tone={health?.status === 'ok' ? 'ok' : 'warn'}
              />
              <StatusRow label="Waktu server" value={formatTime(health?.time)} />
            </dl>
          )}

          {test.state === 'ok' && !databaseOk && (
            <p className="cc-note cc-note--warn">
              Server hidup, tetapi database-nya bermasalah. Hubungi operator laptop
              sebelum memulai pemilihan.
            </p>
          )}
        </aside>

        <footer className="cc-footnote">
          <p>
            Database dan kredensial hanya ada di laptop server. Halaman ini cuma
            menyimpan alamat server di PC ini.
          </p>
          <p className="cc-access">
            Buka lagi kapan saja: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>S</kbd>
            <span> atau ketik <code>__tcServerConfig()</code> di console.</span>
          </p>
        </footer>
      </main>
    </div>
  )
}
