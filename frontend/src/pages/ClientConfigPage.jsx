import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import {
  defaultAppConfig,
  getAppConfig,
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
  const saved = useMemo(() => getAppConfig(), [])

  const [mode, setMode] = useState(saved.mode)
  const [url, setUrl] = useState(saved.serverUrl)
  const [test, setTest] = useState({ state: 'idle', health: null, error: null })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const validation = normalizeServerUrl(url)
  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0]
  const isTesting = test.state === 'testing'

  useEffect(() => {
    document.title = 'Koneksi Server - TrueCount'
    return () => { document.title = 'TrueCount - Secure E-Voting' }
  }, [])

  async function handleTest() {
    setSaveError(null)
    setTest({ state: 'testing', health: null, error: null })

    try {
      const health = await testServerConnection(url)
      setTest({ state: 'ok', health, error: null })
    } catch (err) {
      setTest({
        state: 'error',
        health: null,
        error: err instanceof Error ? err.message : 'Tes koneksi gagal.',
      })
    }
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!validation.ok || saving) return

    setSaving(true)
    setSaveError(null)

    try {
      await saveAppConfig({ mode, serverUrl: validation.url })
      try {
        window.location.assign('/')
      } catch {
        navigate('/', { replace: true })
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi.')
      setSaving(false)
    }
  }

  function handleReset() {
    const fallback = defaultAppConfig()
    setMode(fallback.mode)
    setUrl(fallback.serverUrl)
    setTest({ state: 'idle', health: null, error: null })
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

          <div className="cc-current" title={saved.serverUrl}>
            <span className="cc-current-dot" data-mode={saved.mode} />
            <div>
              <span className="cc-current-label">Alamat aktif</span>
              <strong>{saved.serverUrl.replace(/^https?:\/\//, '')}</strong>
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
                  onClick={() => setMode(item.id)}
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
                  setTest({ state: 'idle', health: null, error: null })
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
              {saving ? 'Menyimpan…' : 'Simpan & muat ulang'}
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

          {test.state === 'error' && (
            <div className="cc-status-error" role="alert">
              <Icon name="alert" size={18} />
              <p>{test.error}</p>
            </div>
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
