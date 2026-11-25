import { useCallback, useEffect, useRef, useState } from 'react'
import { useCameraPermission } from '../hooks/useAuthSecurity'
import Icon from './Icon'
import './IdPhotoCapture.css'

/**
 * IdPhotoCapture - Captures KTP/SIM photo during registration.
 *
 * Props:
 *   onCapture: (base64DataUrl: string) => void
 *   onCancel: () => void
 *   type: 'ktp' | 'sim'
 */
export default function IdPhotoCapture({ onCapture, onCancel, type = 'ktp' }) {
  const label = type === 'ktp' ? 'KTP' : 'SIM'
  const [capturedDataUrl, setCapturedDataUrl] = useState(null)
  const [error, setError] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const videoRef = useRef(null)

  const {
    hasPermission,
    isChecking,
    error: cameraError,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    cameraCount,
    stream,
    videoEl: hookVideoEl,
  } = useCameraPermission()

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current
    const src = stream || hookVideoEl?.srcObject
    if (video && src && video.srcObject !== src) {
      video.srcObject = src
      video.play().catch(() => {})
    }
  }, [stream, hookVideoEl])

  // Start camera on mount
  useEffect(() => {
    startCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Monitor camera state
  useEffect(() => {
    if (hasPermission === true && stream) {
      setIsCameraReady(true)
      setError('')
    } else if (hasPermission === false && cameraError) {
      setError(cameraError)
      setIsCameraReady(false)
    }
  }, [hasPermission, stream, cameraError])

  const handleCapture = useCallback(async () => {
    const video = videoRef.current
    if (!video || isCapturing) return
    setIsCapturing(true)
    setError('')

    try {
      const dataUrl = await capturePhoto(video)
      if (dataUrl) {
        setCapturedDataUrl(dataUrl)
        onCapture(dataUrl)
      } else {
        setError('Gagal mengambil foto. Coba lagi.')
      }
    } catch (err) {
      console.error('[IdPhotoCapture] Capture error:', err)
      setError('Terjadi kesalahan saat mengambil foto.')
    } finally {
      setIsCapturing(false)
    }
  }, [capturePhoto, onCapture, isCapturing])

  const handleRetake = useCallback(() => {
    setCapturedDataUrl(null)
    setError('')
    startCamera() // Restart camera for retake
  }, [startCamera])

  const handleSwitchCamera = useCallback(async () => {
    if (cameraCount < 2) return
    await switchCamera()
  }, [switchCamera, cameraCount])

  // ── Render: Captured state ─────────────────────────────────
  if (capturedDataUrl) {
    return (
      <div className="id-photo-capture" role="region" aria-label={`Hasil foto ${label}`}>
        <div className="id-photo-result">
          <div className="result-frame">
            <img src={capturedDataUrl} alt={`Foto ${label} yang diambil`} />
            <div className="result-badge">
              <Icon name="check" size={14} />
              {label} Terekam
            </div>
          </div>
          <div className="id-photo-actions">
            <button type="button" className="btn-submit--secondary" onClick={handleRetake}>
              <Icon name="rotate-ccw" size={18} />
              Ambil Ulang
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Camera preview / permission state ──────────────
  return (
    <div className="id-photo-capture" role="region" aria-label={`Ambil foto ${label}`}>
      {/* Camera viewport */}
      <div className="id-photo-viewport">
        {(stream || hookVideoEl?.srcObject) ? (
          <video
            ref={videoRef}
            className="id-photo-video"
            autoPlay
            playsInline
            muted
            aria-label={`Pratinjau kamera untuk foto ${label}`}
          />
        ) : (
          <div className="id-photo-placeholder">
            {isChecking ? (
              <div className="id-photo-loading">
                <div className="spinner-large" />
                <span>Memeriksa kamera...</span>
              </div>
            ) : (
              <div className="id-photo-permission" role="alert">
                <Icon name="camera" size={32} />
                <p>{error || 'Izinkan akses kamera untuk melanjutkan.'}</p>
                <button type="button" className="btn-submit" onClick={() => startCamera()}>
                  <Icon name="refresh" size={18} />
                  Periksa Lagi
                </button>
              </div>
            )}
          </div>
        )}

        {/* ID card guide frame */}
        {isCameraReady && (
          <div className="id-photo-guide" aria-hidden="true">
            <div className="guide-frame">
              <div className="guide-label">
                <Icon name="camera" size={16} />
                Sejajarkan wajah &amp; {label}
              </div>
            </div>
          </div>
        )}

        {/* Camera status indicator */}
        {stream && (
          <div className="id-photo-status">
            <span className="status-dot active" />
            <span>Kamera Aktif</span>
          </div>
        )}
      </div>

      {/* Panduan foto (contoh + aturan) dimiliki oleh RegisterPage,
          tepat di atas kamera — satu sumber kebenaran untuk step ini. */}

      {/* Action buttons */}
      <div className="id-photo-actions">
        {cameraCount > 1 && (
          <button
            type="button"
            className="btn-submit--secondary"
            onClick={handleSwitchCamera}
            disabled={isChecking}
            aria-label="Ganti kamera"
          >
            <Icon name="rotate-cw" size={18} />
            Ganti Kamera
          </button>
        )}
        <button
          type="button"
          className="btn-submit"
          onClick={handleCapture}
          disabled={!isCameraReady || isCapturing}
          aria-busy={isCapturing}
        >
          {isCapturing ? (
            <>
              <span className="spinner" />
              Mengambil...
            </>
          ) : (
            <>
              <Icon name="camera" size={18} />
              Ambil Foto {label}
            </>
          )}
        </button>
      </div>

      {/* Cancel button - below main actions */}
      {onCancel && (
        <div className="id-photo-cancel">
          <button type="button" className="btn-submit--secondary btn-full" onClick={onCancel}>
            Batal
          </button>
        </div>
      )}

      {/* Error display */}
      {error && !isChecking && (
        <div className="field-error" role="alert">
          <Icon name="alert" size={16} />
          {error}
        </div>
      )}
    </div>
  )
}