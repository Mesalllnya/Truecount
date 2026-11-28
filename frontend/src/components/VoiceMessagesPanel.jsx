import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Mic,
  Square,
  Play,
  Pause,
  Send,
  RefreshCw,
  Trash2,
  Headphones,
  ShieldCheck,
  Inbox,
  Circle,
  CheckCircle2,
  Clock,
  Upload,
  Eye,
  EyeOff,
} from 'lucide-react'

import { apiUrl } from '../lib/appConfig'
import { useAuth } from '../hooks/useAuthSession'
import './VoiceMessagesPanel.css'

const MAX_DURATION = 300

async function readJson(response) {
  const text = await response.text()

  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new Error('Respons server tidak valid.')
  }
}

function formatDuration(seconds) {
  const total = Math.floor(seconds || 0)
  const minutes = Math.floor(total / 60)
  const remaining = total % 60

  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

function formatDate(date) {
  if (!date) return '-'

  return new Date(date).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function getSupportedMimeType() {
  if (
    !window.MediaRecorder ||
    typeof window.MediaRecorder.isTypeSupported !== 'function'
  ) {
    return ''
  }

  const types = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]

  return (
    types.find(type => MediaRecorder.isTypeSupported(type)) || ''
  )
}

function getFileExtension(mimeType) {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('mpeg')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'

  return 'webm'
}

export default function VoiceMessagesPanel() {
  const { token } = useAuth()

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const startTimeRef = useRef(0)
  const timerRef = useRef(null)
  const audioUrlRef = useRef(null)
  const previewUrlRef = useRef(null)

  const [admins, setAdmins] = useState([])
  const [recipientId, setRecipientId] = useState('')
  const [messages, setMessages] = useState([])
  const [sentMessages, setSentMessages] = useState([])

  // Sub-tab daftar pesan: masuk (inbox) atau terkirim (history + status).
  const [listTab, setListTab] = useState('inbox')

  const [recording, setRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [recordedDuration, setRecordedDuration] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')

  const [audioUrl, setAudioUrl] = useState('')
  const [playingMessageId, setPlayingMessageId] = useState(null)

  const [loading, setLoading] = useState(false)
  const [loadingInbox, setLoadingInbox] = useState(false)
  const [loadingSent, setLoadingSent] = useState(false)
  const [loadingAudioId, setLoadingAudioId] = useState(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const clearAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }

    setAudioUrl('')
    setPlayingMessageId(null)
  }, [])

  const clearPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    setPreviewUrl('')
  }, [])

  const fetchAdmins = useCallback(async () => {
    try {
      const response = await fetch(
        apiUrl('/voice-messages/admins'),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(
          data.error || 'Gagal mengambil daftar admin.'
        )
      }

      setAdmins(data.admins || [])
    } catch (err) {
      setError(err.message)
    }
  }, [token])

  const fetchInbox = useCallback(async () => {
    setLoadingInbox(true)

    try {
      const response = await fetch(
        apiUrl('/voice-messages/inbox'),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(
          data.error || 'Gagal mengambil inbox.'
        )
      }

      setMessages(data.messages || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingInbox(false)
    }
  }, [token])

  const fetchSent = useCallback(async () => {
    setLoadingSent(true)

    try {
      const response = await fetch(
        apiUrl('/voice-messages/sent'),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(
          data.error || 'Gagal mengambil history terkirim.'
        )
      }

      setSentMessages(data.messages || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingSent(false)
    }
  }, [token])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- state loading/error diset saat fetch dimulai
    fetchAdmins()
    fetchInbox()
    fetchSent()
  }, [fetchAdmins, fetchInbox, fetchSent])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)

      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop()
      }

      streamRef.current
        ?.getTracks()
        .forEach(track => track.stop())

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
      }

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  async function startRecording() {
    setError('')
    setSuccess('')
    setRecordedBlob(null)
    setRecordedDuration(0)

    clearAudioUrl()
    clearPreviewUrl()

    if (
      !navigator.mediaDevices?.getUserMedia ||
      !window.MediaRecorder
    ) {
      setError('Browser tidak mendukung perekaman audio.')
      return
    }

    try {
      const mimeType = getSupportedMimeType()

      if (!mimeType) {
        throw new Error(
          'Browser tidak memiliki format rekaman yang didukung.'
        )
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream, {
        mimeType,
      })

      let failed = false

      recorderRef.current = recorder

      recorder.ondataavailable = event => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onerror = event => {
        failed = true

        setError(
          event.error?.message ||
            'Terjadi kesalahan saat merekam audio.'
        )

        setRecording(false)
        setElapsed(0)
        clearInterval(timerRef.current)

        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      recorder.onstop = () => {
        clearInterval(timerRef.current)

        if (failed) {
          chunksRef.current = []
          return
        }

        const chunks = chunksRef.current
        chunksRef.current = []

        const blob = new Blob(chunks, {
          type: recorder.mimeType || mimeType,
        })

        const duration = Math.min(
          MAX_DURATION,
          Math.max(
            0.1,
            (Date.now() - startTimeRef.current) / 1000
          )
        )

        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null

        setRecording(false)
        setElapsed(0)

        if (blob.size === 0) {
          setRecordedBlob(null)
          setRecordedDuration(0)
          setError(
            'Rekaman kosong. Coba rekam ulang dan pastikan mikrofon aktif.'
          )
          return
        }

        setRecordedBlob(blob)
        setRecordedDuration(duration)

        clearPreviewUrl()

        const url = URL.createObjectURL(blob)
        previewUrlRef.current = url
        setPreviewUrl(url)
      }

      startTimeRef.current = Date.now()

      recorder.start(250)
      setRecording(true)

      timerRef.current = setInterval(() => {
        const seconds = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        )

        setElapsed(seconds)

        if (seconds >= MAX_DURATION) {
          stopRecording()
        }
      }, 500)
    } catch (err) {
      setError(
        err.message || 'Tidak dapat mengakses mikrofon.'
      )

      streamRef.current
        ?.getTracks()
        .forEach(track => track.stop())

      streamRef.current = null
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)

    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  function deleteRecording() {
    setRecordedBlob(null)
    setRecordedDuration(0)
    setElapsed(0)
    setError('')
    setSuccess('')
    clearPreviewUrl()
  }

  async function sendVoiceMessage() {
    if (!recordedBlob) {
      setError('Belum ada rekaman untuk dikirim.')
      return
    }

    if (!recipientId) {
      setError('Pilih admin penerima terlebih dahulu.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()

      const extension = getFileExtension(recordedBlob.type)

      const audioFile = new File(
        [recordedBlob],
        `voice-message.${extension}`,
        {
          type: recordedBlob.type,
        }
      )

      formData.append('recipient_id', recipientId)

      formData.append(
        'duration_seconds',
        recordedDuration.toFixed(2)
      )

      formData.append('audio', audioFile)

      const response = await fetch(
        apiUrl('/voice-messages'),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      )

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(
          data.error || 'Gagal mengirim voice message.'
        )
      }

      setSuccess(
        data.message || 'Voice message berhasil dikirim.'
      )

      setRecordedBlob(null)
      setRecordedDuration(0)
      setRecipientId('')
      clearPreviewUrl()

      await fetchInbox()
      await fetchSent()
    } catch (err) {
      setError(
        err.message || 'Terjadi kesalahan saat mengirim audio.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function playMessage(message) {
    setError('')
    setSuccess('')

    if (
      playingMessageId === message.id &&
      audioUrl
    ) {
      clearAudioUrl()
      return
    }

    setLoadingAudioId(message.id)
    clearAudioUrl()

    try {
      const response = await fetch(
        apiUrl(`/voice-messages/${message.id}/audio`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        // Server mungkin masih mengirim JSON error
        const data = await readJson(response)
        throw new Error(data.error || 'Gagal memuat audio.')
      }

      // Ambil parameter dekripsi dari header sesi
      const b64Key   = response.headers.get('X-Audio-Key')
      const b64Nonce = response.headers.get('X-Audio-Nonce')
      const b64Tag   = response.headers.get('X-Audio-Tag')
      const mimeType = (response.headers.get('X-Audio-Mime') || 'audio/webm').trim()

      if (!b64Key || !b64Nonce || !b64Tag) {
        throw new Error('Header enkripsi audio tidak lengkap.')
      }

      // Decode Base64 → Uint8Array
      const fromB64 = (str) =>
        Uint8Array.from(atob(str.trim()), (c) => c.charCodeAt(0))

      const keyBytes   = fromB64(b64Key)
      const nonceBytes = fromB64(b64Nonce)
      const tagBytes   = fromB64(b64Tag)

      // Baca ciphertext dari body
      const cipherBytes = new Uint8Array(await response.arrayBuffer())

      // Gabungkan ciphertext + tag (format yang diharapkan Web Crypto AES-GCM)
      const cipherWithTag = new Uint8Array(cipherBytes.length + tagBytes.length)
      cipherWithTag.set(cipherBytes)
      cipherWithTag.set(tagBytes, cipherBytes.length)

      // Import key ke Web Crypto API
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      )

      // Dekripsi — gagal jika tag tidak cocok (audio dimodifikasi)
      let plainBuffer
      try {
        plainBuffer = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: nonceBytes, tagLength: 128 },
          cryptoKey,
          cipherWithTag
        )
      } catch {
        throw new Error('Gagal mendekripsi audio: data tidak valid atau telah dimodifikasi.')
      }

      // Buat Blob URL sementara dari plaintext audio
      const blob = new Blob([plainBuffer], { type: mimeType })
      const url = URL.createObjectURL(blob)

      audioUrlRef.current = url

      setAudioUrl(url)
      setPlayingMessageId(message.id)

      if (!message.is_read) {
        await markAsRead(message.id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAudioId(null)
    }
  }

  async function markAsRead(messageId) {
    try {
      const response = await fetch(
        apiUrl(`/voice-messages/${messageId}/read`),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(
          data.error || 'Gagal memperbarui status pesan.'
        )
      }

      setMessages(current =>
        current.map(message =>
          message.id === messageId
            ? {
                ...message,
                is_read: true,
              }
            : message
        )
      )
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="voice-panel">
      <div className="voice-panel-intro">
        <div>
          <h2>Pesan Suara Admin</h2>
          <p>
            Rekam dan kirim pesan suara terenkripsi ke administrator lain.
          </p>
        </div>

        <span className="voice-security-badge">
          <ShieldCheck size={16} />
          <span>Encrypted Audio</span>
        </span>
      </div>

      {error && (
        <div className="voice-alert voice-alert-error" role="alert">
          {error}

          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Tutup pesan kesalahan"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="voice-alert voice-alert-success" role="status">
          {success}

          <button
            type="button"
            onClick={() => setSuccess('')}
            aria-label="Tutup pesan berhasil"
          >
            ×
          </button>
        </div>
      )}

      <section className="voice-compose">
        <div className="voice-section-heading">
          <div className="voice-heading-icon">
            <Mic size={20} />
          </div>

          <div>
            <h3>Kirim Voice Message</h3>
            <p>
              Rekam pesan dan kirim ke administrator lain.
            </p>
          </div>
        </div>

        <div className="voice-form">
          <label htmlFor="voice-recipient">
            Penerima
          </label>

          <select
            id="voice-recipient"
            value={recipientId}
            onChange={e => setRecipientId(e.target.value)}
            disabled={recording || loading}
          >
            <option value="">
              Pilih administrator
            </option>

            {admins.map(admin => (
              <option
                key={admin.id}
                value={admin.id}
              >
                {admin.username}
              </option>
            ))}
          </select>

          <div className="voice-recorder">
            <div className="voice-recorder-status">
              <div
                className={
                  recording
                    ? 'voice-pulse active'
                    : 'voice-pulse'
                }
              >
                <Mic size={25} />
              </div>

              <div>
                <strong>
                  {recording
                    ? 'Sedang merekam...'
                    : recordedBlob
                      ? 'Rekaman siap dikirim'
                      : 'Siap merekam'}
                </strong>

                <span>
                  {recording
                    ? 'Maksimal durasi 5 menit'
                    : 'Pastikan mikrofon sudah diizinkan'}
                </span>
              </div>
            </div>

            <div className="voice-timer">
              {formatDuration(
                recording
                  ? elapsed
                  : recordedDuration
              )}
            </div>

            <div className="voice-recorder-actions">
              {!recording && !recordedBlob && (
                <button
                  type="button"
                  className="voice-button voice-button-primary"
                  onClick={startRecording}
                  disabled={!admins.length}
                >
                  <Mic size={17} />
                  Mulai Rekam
                </button>
              )}

              {recording && (
                <button
                  type="button"
                  className="voice-button voice-button-danger"
                  onClick={stopRecording}
                >
                  <Square size={16} />
                  Hentikan Rekaman
                </button>
              )}

              {recordedBlob && (
                <>
                  {previewUrl && (
                    <audio
                      className="voice-preview"
                      controls
                      src={previewUrl}
                    />
                  )}

                  <button
                    type="button"
                    className="voice-button voice-button-primary"
                    onClick={sendVoiceMessage}
                    disabled={loading || !recipientId}
                  >
                    <Send size={16} />

                    {loading
                      ? 'Mengirim...'
                      : 'Kirim Audio'}
                  </button>

                  <button
                    type="button"
                    className="voice-button voice-button-muted"
                    onClick={deleteRecording}
                    disabled={loading}
                  >
                    <Trash2 size={16} />
                    Hapus
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="voice-hint">
            <ShieldCheck size={14} />
            Audio dienkripsi ganda: ChaCha20-Poly1305 di server + AES-256-GCM sesi saat pengiriman. Hanya bisa diputar di dalam aplikasi.
          </p>
        </div>
      </section>

      <section className="voice-inbox">
        <div className="voice-section-heading">
          <div className="voice-heading-icon">
            {listTab === 'inbox' ? (
              <Inbox size={20} />
            ) : (
              <Upload size={20} />
            )}
          </div>

          <div>
            <h3>
              {listTab === 'inbox'
                ? 'Inbox Voice Messages'
                : 'History Terkirim'}
            </h3>
            <p>
              {listTab === 'inbox'
                ? 'Pesan suara yang dikirim oleh administrator lain.'
                : 'Pesan suara yang kamu kirim beserta status penerima.'}
            </p>
          </div>

          <button
            type="button"
            className="voice-refresh"
            onClick={
              listTab === 'inbox'
                ? fetchInbox
                : fetchSent
            }
            disabled={
              listTab === 'inbox'
                ? loadingInbox
                : loadingSent
            }
            title={
              listTab === 'inbox'
                ? 'Refresh inbox'
                : 'Refresh history terkirim'
            }
            aria-label="Muat ulang daftar pesan"
          >
            <RefreshCw
              size={18}
              className={
                (listTab === 'inbox'
                  ? loadingInbox
                  : loadingSent)
                  ? 'voice-spinning'
                  : ''
              }
            />
          </button>
        </div>

        <div
          className="voice-subtabs"
          role="tablist"
          aria-label="Daftar pesan suara"
        >
          <button
            id="voice-subtab-inbox"
            type="button"
            role="tab"
            className={
              listTab === 'inbox'
                ? 'voice-subtab active'
                : 'voice-subtab'
            }
            aria-selected={listTab === 'inbox'}
            aria-controls="voice-subpanel-list"
            onClick={() => setListTab('inbox')}
          >
            <Inbox size={15} />
            Masuk
            {messages.some(message => !message.is_read) && (
              <span className="voice-subtab-badge">
                {
                  messages.filter(
                    message => !message.is_read
                  ).length
                }
              </span>
            )}
          </button>

          <button
            id="voice-subtab-sent"
            type="button"
            role="tab"
            className={
              listTab === 'sent'
                ? 'voice-subtab active'
                : 'voice-subtab'
            }
            aria-selected={listTab === 'sent'}
            aria-controls="voice-subpanel-list"
            onClick={() => setListTab('sent')}
          >
            <Upload size={15} />
            Terkirim
          </button>
        </div>

        <div
          id="voice-subpanel-list"
          role="tabpanel"
          aria-labelledby={
            listTab === 'inbox'
              ? 'voice-subtab-inbox'
              : 'voice-subtab-sent'
          }
          className="voice-message-list"
        >
          {listTab === 'inbox' ? (
            loadingInbox && messages.length === 0 ? (
              <div className="voice-empty">
                Memuat inbox...
              </div>
            ) : messages.length === 0 ? (
              <div className="voice-empty">
                <Headphones size={34} />

                <strong>
                  Belum ada voice message
                </strong>

                <span>
                  Pesan suara yang diterima akan muncul di sini.
                </span>
              </div>
            ) : (
              messages.map(message => (
                <article
                  className={
                    `voice-message-card ${
                      !message.is_read ? 'unread' : ''
                    }`
                  }
                  key={message.id}
                >
                  <div className="voice-message-avatar">
                    <Mic size={21} />
                  </div>

                  <div className="voice-message-info">
                    <div className="voice-message-title">
                      <strong>
                        {message.sender_username}
                      </strong>

                      {!message.is_read ? (
                        <span className="voice-unread-label">
                          <Circle
                            size={8}
                            fill="currentColor"
                          />
                          Baru
                        </span>
                      ) : (
                        <span className="voice-read-label">
                          <CheckCircle2 size={13} />
                          Dibaca
                        </span>
                      )}
                    </div>

                    <div className="voice-message-meta">
                      <span>
                        <Clock size={13} />
                        {formatDate(message.created_at)}
                      </span>

                      <span>
                        {formatDuration(
                          message.duration_seconds
                        )}
                      </span>
                    </div>

                    <span className="voice-message-size">
                      {(message.file_size / 1024).toFixed(1)} KB
                    </span>

                    {playingMessageId === message.id && audioUrl && (
                      <audio
                        className="voice-playback"
                        controls
                        autoPlay
                        src={audioUrl}
                        onEnded={clearAudioUrl}
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    className="voice-play-button"
                    onClick={() => playMessage(message)}
                    disabled={
                      loadingAudioId === message.id
                    }
                    title="Putar pesan"
                    aria-label={`Putar pesan dari ${message.sender_username}`}
                  >
                    {loadingAudioId === message.id ? (
                      <RefreshCw
                        size={17}
                        className="voice-spinning"
                      />
                    ) : playingMessageId === message.id ? (
                      <Pause size={18} />
                    ) : (
                      <Play size={18} />
                    )}
                  </button>
                </article>
              ))
            )
          ) : loadingSent && sentMessages.length === 0 ? (
            <div className="voice-empty">
              Memuat history terkirim...
            </div>
          ) : sentMessages.length === 0 ? (
            <div className="voice-empty">
              <Upload size={34} />

              <strong>
                Belum ada pesan terkirim
              </strong>

              <span>
                Pesan suara yang kamu kirim akan muncul di sini
                beserta status sudah diputar atau belum.
              </span>
            </div>
          ) : (
            sentMessages.map(message => (
              <article
                className={
                  `voice-message-card ${
                    !message.is_read ? 'sent-pending' : ''
                  }`
                }
                key={message.id}
              >
                <div className="voice-message-avatar">
                  <Mic size={21} />
                </div>

                <div className="voice-message-info">
                  <div className="voice-message-title">
                    <strong>
                      {message.recipient_username}
                    </strong>

                    {message.is_read ? (
                      <span className="voice-read-label">
                        <Eye size={13} />
                        Sudah diputar
                      </span>
                    ) : (
                      <span className="voice-unread-label">
                        <EyeOff size={13} />
                        Belum diputar
                      </span>
                    )}
                  </div>

                  <div className="voice-message-meta">
                    <span>
                      <Clock size={13} />
                      Dikirim {formatDate(message.created_at)}
                    </span>

                    <span>
                      {formatDuration(
                        message.duration_seconds
                      )}
                    </span>
                  </div>

                  <span className="voice-message-size">
                    {message.is_read && message.read_at
                      ? `Diputar ${formatDate(message.read_at)} · `
                      : ''}
                    {(message.file_size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <footer className="voice-footer">
        <ShieldCheck size={15} />

        <span>
          Akses playback hanya diberikan kepada administrator penerima.
        </span>
      </footer>
    </div>
  )
}
