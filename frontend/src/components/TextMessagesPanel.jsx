
import { useState } from 'react'
import { apiUrl } from '../lib/appConfig'
import { useAuth } from '../hooks/useAuthSession'

const ALGORITHM_LABELS = {
  aes256gcm: 'AES-256-GCM',
  chacha20: 'ChaCha20-Poly1305',
  vigenere: 'Vigenère Cipher',
}

async function readJson(response) {
  const text = await response.text()

  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new Error('Respons server tidak valid.')
  }
}

export default function TextMessagesPanel() {
  const { token } = useAuth()

  const [message, setMessage] = useState('')
  const [algorithm, setAlgorithm] = useState('aes256gcm')
  const [vigenereKey, setVigenereKey] = useState('')
  const [decryptKey, setDecryptKey] = useState('')
  const [messageId, setMessageId] = useState('')
  const [decryptId, setDecryptId] = useState('')
  const [plaintext, setPlaintext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleEncrypt(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setPlaintext('')

    if (!message.trim()) {
      setError('Pesan tidak boleh kosong.')
      return
    }

    if (
      algorithm === 'vigenere' &&
      !/^[a-zA-Z]+$/.test(vigenereKey)
    ) {
      setError('Key Vigenère wajib berisi huruf A-Z tanpa spasi atau angka.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(apiUrl('/encrypted-messages'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          algorithm,
          vigenere_key: algorithm === 'vigenere' ? vigenereKey : '',
        }),
      })

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengenkripsi pesan.')
      }

      const id = data.data?.id

      if (!id) {
        throw new Error('ID pesan tidak ditemukan pada respons.')
      }

      setMessageId(String(id))
      setDecryptId(String(id))
      setDecryptKey(algorithm === 'vigenere' ? vigenereKey : '')

      setSuccess(
        `Pesan berhasil dienkripsi menggunakan ${ALGORITHM_LABELS[algorithm]}.`
      )

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

    if (decryptKey && !/^[a-zA-Z]+$/.test(decryptKey)) {
      setError('Key Vigenère hanya boleh berisi huruf A-Z.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        apiUrl(`/encrypted-messages/${encodeURIComponent(id)}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Vigenere-Key': decryptKey,
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

  return (
    <div className="text-messages-panel">
      {error && (
        <div className="encrypted-alert error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="encrypted-alert success" role="status">
          {success}
        </div>
      )}

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
            <option value="vigenere">Vigenère Cipher</option>
          </select>

          {algorithm === 'vigenere' && (
            <>
              <label htmlFor="vigenere-key">Key Vigenère</label>

              <input
                id="vigenere-key"
                type="password"
                value={vigenereKey}
                onChange={e => setVigenereKey(e.target.value)}
                placeholder="Masukkan key, contoh: KUNCI"
                autoComplete="off"
                required
                disabled={loading}
              />

              <small>
                Gunakan huruf A-Z saja. Simpan key ini karena diperlukan
                untuk dekripsi.
              </small>
            </>
          )}

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

          <button
            className="encrypted-button"
            type="submit"
            disabled={loading}
          >
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
          <p>
            Masukkan ID pesan untuk mengambil dan membuka pesan milik akun ini.
          </p>
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

          <label htmlFor="decrypt-key">
            Key Vigenère (jika diperlukan)
          </label>

          <input
            id="decrypt-key"
            type="password"
            value={decryptKey}
            onChange={e => setDecryptKey(e.target.value)}
            placeholder="Masukkan key untuk pesan Vigenère"
            autoComplete="off"
            disabled={loading}
          />

          <small>
            Kosongkan jika pesan menggunakan AES-256-GCM
            atau ChaCha20-Poly1305.
          </small>

          <button
            className="encrypted-button"
            type="submit"
            disabled={loading}
          >
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
        dan key Vigenère untuk membukanya kembali.
      </p>
    </div>
  )
}
