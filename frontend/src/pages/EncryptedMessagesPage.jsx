import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'
import './DashboardPage.css'
import './EncryptedMessagesPage.css'

const API = 'http://localhost:8000'

async function readJson(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new Error('Respons server tidak valid.')
  }
}

export default function EncryptedMessagesPage() {
  const navigate = useNavigate()
  const token = localStorage.getItem('tc_token')

  const [message, setMessage] = useState('')
  const [algorithm, setAlgorithm] = useState('aes256gcm')
  const [messageId, setMessageId] = useState('')
  const [decryptId, setDecryptId] = useState('')
  const [plaintext, setPlaintext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!token) return <Navigate to="/masuk" replace />

  async function handleEncrypt(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setPlaintext('')

    if (!message.trim()) {
      setError('Pesan tidak boleh kosong.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API}/encrypted-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          algorithm,
        }),
      })

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengenkripsi pesan.')
      }

      const id = data.data?.id
      if (!id) throw new Error('ID pesan tidak ditemukan pada respons.')

      setMessageId(String(id))
      setDecryptId(String(id))
      setSuccess(`Pesan berhasil dienkripsi menggunakan ${algorithm === 'aes256gcm' ? 'AES-256-GCM' : 'ChaCha20-Poly1305'}.`)
      setMessage('')
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDecrypt(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setPlaintext('')

    const id = Number(decryptId)
    if (!Number.isInteger(id) || id <= 0) {
      setError('Masukkan ID pesan yang valid.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        `${API}/encrypted-messages/${encodeURIComponent(id)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mendekripsi pesan.')
      }

      setPlaintext(data.data?.plaintext ?? '')
      setSuccess('Pesan berhasil didekripsi.')
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan.')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('tc_token')
    navigate('/masuk')
  }

  return (
    <div className="dash-shell">
      <header className="dash-nav">
        <Link to="/dasbor" className="dash-brand" title="TrueCount">
          <img
            src={navLogoLight}
            alt="TrueCount"
            className="dash-brand-logo"
          />
        </Link>

        <nav className="dash-nav-links" aria-label="Navigasi dasbor">
          <Link to="/dasbor" className="dash-nav-item">Dasbor</Link>
          <Link to="/pilih" className="dash-nav-item">Pemilihan</Link>
          <Link to="/pesan-terenkripsi" className="dash-nav-item dash-nav-active">
            Pesan Terenkripsi
          </Link>
          <Link to="/pengaturan" className="dash-nav-item">Pengaturan</Link>
        </nav>

        <button className="dash-logout" onClick={handleLogout}>
          Keluar
        </button>
      </header>

      <main className="encrypted-page">
        <header className="encrypted-heading">
          <span className="encrypted-eyebrow">TRUECOUNT SECURITY</span>
          <h1>Encrypted Messages</h1>
          <p>
            Kirim dan simpan pesan menggunakan enkripsi authenticated
            encryption.
          </p>
        </header>

        {error && <div className="encrypted-alert error" role="alert">{error}</div>}
        {success && <div className="encrypted-alert success" role="status">{success}</div>}

        <section className="encrypted-card">
          <div className="encrypted-card-heading">
            <h2>Enkripsi Pesan</h2>
            <p>Pesan akan dienkripsi sebelum disimpan ke database.</p>
          </div>

          <form onSubmit={handleEncrypt}>
            <label htmlFor="message-algorithm">Algoritma enkripsi</label>
            <select
              id="message-algorithm"
              value={algorithm}
              onChange={e => setAlgorithm(e.target.value)}
              disabled={loading}
            >
              <option value="aes256gcm">AES-256-GCM</option>
              <option value="chacha20">ChaCha20-Poly1305</option>
            </select>

            <label htmlFor="message-content">Isi pesan</label>
            <textarea
              id="message-content"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tulis pesan rahasia di sini..."
              rows={5}
              required
              disabled={loading}
            />

            <button className="encrypted-button" type="submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Enkripsi & Simpan'}
            </button>
          </form>

          {messageId && (
            <div className="encrypted-result">
              <strong>Pesan berhasil disimpan!</strong>
              <p>ID pesan: <code>{messageId}</code></p>
              <button
                type="button"
                className="encrypted-secondary-button"
                onClick={() => {
                  setDecryptId(messageId)
                  setPlaintext('')
                }}
              >
                Gunakan ID untuk dekripsi
              </button>
            </div>
          )}
        </section>

        <section className="encrypted-card">
          <div className="encrypted-card-heading">
            <h2>Dekripsi Pesan</h2>
            <p>Masukkan ID pesan untuk mengambil dan membuka pesan milik akun ini.</p>
          </div>

          <form onSubmit={handleDecrypt}>
            <label htmlFor="decrypt-id">ID pesan</label>
            <input
              id="decrypt-id"
              type="number"
              min="1"
              value={decryptId}
              onChange={e => setDecryptId(e.target.value)}
              placeholder="Contoh: 12"
              required
              disabled={loading}
            />

            <button className="encrypted-button" type="submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Dekripsi Pesan'}
            </button>
          </form>

          {plaintext !== '' && (
            <div className="encrypted-plaintext">
              <strong>Plaintext hasil dekripsi</strong>
              <p>{plaintext}</p>
            </div>
          )}
        </section>

        <p className="encrypted-note">
          Pesan hanya dapat diakses oleh akun pemiliknya. Simpan ID pesan
          untuk membukanya kembali.
        </p>
      </main>
    </div>
  )
}
