/* eslint-disable react/only-export-components, react-refresh/only-export-components, react/set-state-in-effect */
import { useState, useCallback, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { logCamera } from '../utils/cameraLogger';

/** API base URL */
import { apiUrl } from '../lib/appConfig';

/** Auth attempt record */
export interface AuthAttempt {
  id: number;
  identifier: string;
  method: 'webauthn' | 'dongle' | 'password';
  success: boolean;
  error?: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
}

/** Security setup status */
export interface SecuritySetupStatus {
  hasWebAuthn: boolean;
  hasDongle: boolean;
  requiresSetup: boolean;
  userId?: number;
}

/** Failed attempts counter state */
interface FailedAttemptsState {
  identifier: string;
  count: number;
  lastAttempt: string | null;
  lockedUntil: string | null;
}

/** Context for failed attempts tracking */
const FailedAttemptsContext = createContext<{
  state: FailedAttemptsState;
  increment: (identifier: string, method: string, success: boolean, error?: string) => Promise<void>;
  reset: (identifier: string, syncServer?: boolean) => Promise<void>;
  canUsePassword: (identifier: string) => boolean;
} | null>(null);

/** Provider component */
export function FailedAttemptsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FailedAttemptsState>({
    identifier: '',
    count: 0,
    lastAttempt: null,
    lockedUntil: null,
  });

  // State disimpan di memori saja (tidak dipersist ke localStorage/session)
  // supaya counter otomatis reset setiap kali halaman dimuat ulang.

  const increment = useCallback(async (identifier: string, _method: string, success: boolean, _error?: string) => {
    // Catat ke server hanya untuk counter lokal (percobaan gagal, lockout, password fallback).
    // Penulisan ke tabel auth_attempts ditangani sepenuhnya oleh backend (login.php, webauthn_login_verify.php,
    // authenticate_verify.php) sebagai single source of truth, sehingga tidak ada duplikasi baris log.
    if (success) {
      // Reset on successful auth
      setState({ identifier, count: 0, lastAttempt: new Date().toISOString(), lockedUntil: null });
      return;
    }

    const now = new Date().toISOString();
    // Hitungan gagal bersifat per-identifier: bila username/email berubah, mulai dari awal.
    const sameIdentifier = state.identifier === identifier;
    const previousCount = sameIdentifier ? state.count : 0;

    // Cap di 5 agar tampilan tidak pernah melebihi "5/5" (mencegah anomali 11/5).
    const newCount = Math.min(previousCount + 1, 5);

    // Kunci hanya bila sudah gagal LEBIH dari 5 kali (percobaan ke-6 dan seterusnya).
    const lockedUntil = previousCount + 1 > 5
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
      : null;

    setState({
      identifier,
      count: newCount,
      lastAttempt: now,
      lockedUntil,
    });
  }, [state.count, state.identifier]);

  const reset = useCallback(async (identifier: string, syncServer = true) => {
    if (syncServer) {
      try {
        await fetch(apiUrl('/auth/attempts/reset'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier }),
        });
      } catch {
        console.warn('[TrueCount] Failed to reset attempts on server');
      }
    }
    setState({ identifier: '', count: 0, lastAttempt: null, lockedUntil: null });
  }, []);

  const canUsePassword = useCallback((_identifier?: string) => {
    // Allow password if:
    // 1. 5+ failed attempts (lockedUntil is set)
    // 2. Or lock has expired but count >= 5
    return state.count >= 5;
  }, [state.count]);

  return (
    <FailedAttemptsContext.Provider value={{ state, increment, reset, canUsePassword }}>
      {children}
    </FailedAttemptsContext.Provider>
  );
}

/** Hook to use failed attempts tracking */
export function useFailedAttempts() {
  const context = useContext(FailedAttemptsContext);
  if (!context) {
    throw new Error('useFailedAttempts must be used within FailedAttemptsProvider');
  }
  return context;
}

/** Hook to check user's security setup status */
export function useSecuritySetup() {
  const [status, setStatus] = useState<SecuritySetupStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSetup = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('tc_token');
      if (!token) {
        setStatus({ hasWebAuthn: false, hasDongle: false, requiresSetup: true });
        return;
      }

      const res = await fetch(apiUrl('/auth/security-setup'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memeriksa pengaturan keamanan');
      setStatus(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setError(msg);
      setStatus({ hasWebAuthn: false, hasDongle: false, requiresSetup: true, userId: undefined });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  return { status, isLoading, error, refetch: checkSetup };
}

/** ── Global camera stream registry ─────────────────────────────────
 * Setiap MediaStream yang dibuat didaftarkan di sini sehingga SEMUA
 * stream bisa dipaksa mati dari mana pun (route guard, unmount, pagehide).
 * Menutup celah kebocoran stream saat dua checkCamera berjalan tumpang
 * tindih (StrictMode / recheck interval) — penyebab LED kamera tetap
 * nyala setelah meninggalkan halaman masuk. */
const activeCameraStreams = new Set<MediaStream>();

/** Paksa matikan SEMUA stream kamera yang masih hidup di seluruh aplikasi. */
export function stopAllCameraStreams(): void {
  activeCameraStreams.forEach((s) => {
    try {
      s.getTracks().forEach((t) => t.stop());
    } catch {
      // Track mungkin sudah berhenti — abaikan.
    }
  });
  activeCameraStreams.clear();
}

/** Pesan alert untuk kondisi kamera tertutup / gelap — arahkan user ke solusi. */
const CAMERA_BLOCKED_MESSAGES: Record<'flat' | 'dark' | 'black', string> = {
  flat: 'Kamera tertutup. Buka penutup kamera (shutter), ganti kamera, atau pastikan tidak ada yang menutupi lensa.',
  dark: 'Cahaya terlalu gelap. Nyalakan lampu atau ubah posisi kamera agar wajah terlihat.',
  black: 'Kamera gelap total — tidak ada gambar. Buka penutup kamera (shutter) atau ganti kamera.',
};

/** Hook to check camera availability AND verify it produces valid frames (not covered/black) */
export function useCameraPermission() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Stream and video for live preview
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  // Interval ref for periodic camera re-check when permission is denied
  const recheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkCameraRef = useRef<() => Promise<void>>(async () => {});
  const isMountedRef = useRef(true);
  const stopCameraRef = useRef<() => void>(() => {});
  // Nomor urut run checkCamera — untuk membatalkan run yang tumpang tindih
  // (StrictMode / recheck interval) agar stream run basi tidak bocor.
  const runIdRef = useRef(0);
  // Kamera yang dipilih user (untuk fitur "Ganti Kamera" — laptop Lenovo
  // sering punya 2 perangkat: kamera IR + kamera RGB).
  const deviceIdRef = useRef<string | null>(null);
  const [cameraCount, setCameraCount] = useState(0);

  // Ref ke stream terbaru untuk cleanup saat unmount
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  /** Hentikan semua track stream secara aman — null-check + try/catch agar
   *  tidak crash ("Cannot read properties of null") saat ref belum tersinkron
   *  dengan state (Race Condition pada StrictMode / async unmount). */
  const stopStreamSafely = useCallback(() => {
    const current = streamRef.current;
    if (!current) return;
    try {
      current.getTracks().forEach((track) => track.stop());
    } catch {
      // Track mungkin sudah berhenti — abaikan.
    }
    activeCameraStreams.delete(current);
    streamRef.current = null;
  }, []);

  // Tandai component sebagai sudah unmount — mencegah state update setelah navigasi
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /** Clear the periodic re-check interval */
  const stopRecheck = useCallback(() => {
    if (recheckIntervalRef.current) {
      window.clearInterval(recheckIntervalRef.current);
      recheckIntervalRef.current = null;
    }
  }, []);

  /** Start periodic re-check when camera is not available (e.g., shutter closed) */
  const startRecheck = useCallback(() => {
    stopRecheck();
    // Re-check CEPAT (750ms) supaya saat shutter dibuka / izin diberikan,
    // kamera pulih secepat mungkin.
    recheckIntervalRef.current = window.setInterval(() => {
      checkCameraRef.current();
    }, 750);
  }, [stopRecheck]);

  /** Analisis isi frame — deteksi kamera tertutup / gelap sekali.
   *  Shutter Lenovo yang tertutup menghasilkan frame ABU-ABU RATA (bukan hitam,
   *  kadang dengan ikon lock) — karena itu deteksi utama berdasarkan "kerataan"
   *  frame (flatPercent), bukan hanya kecerahan. */
  const analyzeFrame = (video: HTMLVideoElement): { ok: boolean; reason: 'ok' | 'flat' | 'dark' | 'black'; metrics: string } => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { ok: false, reason: 'black', metrics: 'no canvas context' };
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (!imageData) {
      return { ok: false, reason: 'black', metrics: 'no image data' };
    }
    const data = imageData.data;

    // Sample pixels to check if frame is not all black
    let nonBlackPixels = 0;
    let totalSamples = 0;
    let sumBrightness = 0;
    let sumBrightnessSq = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    const sampleStep = Math.max(1, Math.floor(data.length / 4000)); // sample ~1000 pixels
    for (let i = 0; i < data.length; i += sampleStep * 4) {
      totalSamples++;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;
      sumBrightness += brightness;
      sumBrightnessSq += brightness * brightness;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
      // Not pure black (allow some noise threshold)
      if (r > 5 || g > 5 || b > 5) nonBlackPixels++;
    }
    const nonBlackPercent = (nonBlackPixels / totalSamples) * 100;
    const avgBrightness = sumBrightness / totalSamples;
    const contrast = maxBrightness - minBrightness;
    // Variance = E[X^2] - E[X]^2
    const variance = (sumBrightnessSq / totalSamples) - (avgBrightness * avgBrightness);
    const stdDev = Math.sqrt(Math.max(0, variance));

    // "Kerataan": persentase piksel yang warnanya nyaris sama dengan rata-rata.
    // Frame wajah/ruangan nyata tidak akan pernah ≥85% rata; frame shutter
    // tertutup (abu-abu rata + ikon lock) hampir 100% rata.
    let flatPixels = 0;
    for (let i = 0; i < data.length; i += sampleStep * 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (Math.abs(brightness - avgBrightness) < 15) flatPixels++;
    }
    const flatPercent = (flatPixels / totalSamples) * 100;

    const metrics = `nonBlack=${nonBlackPercent.toFixed(1)}%, avgBright=${avgBrightness.toFixed(1)}, contrast=${contrast.toFixed(1)}, stdDev=${stdDev.toFixed(1)}, flat=${flatPercent.toFixed(1)}%`;

    let reason: 'ok' | 'flat' | 'dark' | 'black' = 'ok';
    if (nonBlackPercent < 5) reason = 'black';
    else if (flatPercent >= 85) reason = 'flat';   // shutter tertutup / lensa tertutup (frame rata)
    else if (avgBrightness < 10) reason = 'dark';  // gelap sekali

    return { ok: reason === 'ok', reason, metrics };
  };

  const checkCamera = useCallback(async () => {
    const runId = ++runIdRef.current;
    logCamera('INFO', `Memulai checkCamera (run #${runId})...`, {
      isTauri: typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
      isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
      protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
    });
    setIsChecking(true);
    setError(null);
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let cameraReady = false;

    // Cek ketersediaan mediaDevices
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Browser hanya mengekspos kamera di secure context (HTTPS / localhost).
      // Halaman yang dibuka via http://<ip-lan> sengaja tidak mendapat API kamera.
      const insecure =
        typeof window !== 'undefined' && window.isSecureContext === false;
      const msg = insecure
        ? 'getUserMedia diblokir: halaman dibuka tanpa HTTPS (bukan secure context)'
        : 'navigator.mediaDevices.getUserMedia tidak tersedia di environment ini';
      logCamera('ERROR', msg);
      if (runId === runIdRef.current && isMountedRef.current) {
        setError(
          insecure
            ? 'Kamera hanya tersedia di HTTPS atau aplikasi desktop TrueCount. Buka halaman ini lewat HTTPS, atau gunakan aplikasi desktop.'
            : 'Kamera tidak didukung pada perangkat ini.',
        );
        setHasPermission(false);
        setIsChecking(false);
      }
      return;
    }

    try {
      // Matikan SEMUA stream lama (termasuk milik run lain yang tumpang tindih)
      // sebelum meminta akses baru — mencegah stream bocor yang menyalakan LED.
      stopAllCameraStreams();
      stopStreamSafely();
      logCamera('INFO', 'Stream lama dihentikan, meminta akses getUserMedia baru');

      logCamera('INFO', 'Meminta akses getUserMedia (facingMode: user / deviceId terpilih)...');
      try {
        stream = await navigator.mediaDevices.getUserMedia(
          deviceIdRef.current
            ? { video: { deviceId: { exact: deviceIdRef.current }, width: { ideal: 640 }, height: { ideal: 480 } } }
            : { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } }
        );
      } catch (err: any) {
        logCamera('WARN', `Constraint utama gagal (${err?.name}: ${err?.message}), mencoba basic constraints { video: true }...`);
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
      }

      // Dapatkan track video dari stream
      if (!stream) {
        throw new Error('Stream kamera tidak tersedia setelah inisialisasi');
      }
      const tracks = stream.getVideoTracks();

      logCamera('INFO', `Berhasil mendapatkan stream kamera (${tracks.length} track)`, tracks.map(t => ({
        id: t.id,
        label: t.label,
        enabled: t.enabled,
        readyState: t.readyState,
        muted: t.muted,
      })));

      // Daftarkan ke registry global SEBELUM guard — jika run ini ternyata
      // basi (ada run lebih baru / halaman sudah unmount), stream langsung
      // dihentikan sehingga tidak pernah bocor (LED kamera ikut mati).
      activeCameraStreams.add(stream);
      if (runId !== runIdRef.current || !isMountedRef.current) {
        logCamera('WARN', `checkCamera run #${runId} basi (digantikan run lebih baru / halaman unmount) — stream baru langsung dihentikan`);
        stream.getTracks().forEach((t) => t.stop());
        activeCameraStreams.delete(stream);
        return;
      }

      // Simpan stream ke ref segera (tidak hanya via state effect) agar
      // cleanup saat unmount tetap bisa menghentikan track meski React belum
      // merender ulang / men-sync state ke ref.
      streamRef.current = stream;

      // Catat perangkat kamera yang dipakai + jumlah kamera tersedia
      // (untuk fitur "Ganti Kamera" — mis. Lenovo dengan kamera IR + RGB).
      const deviceSettings = stream.getVideoTracks()[0]?.getSettings?.();
      if (deviceSettings?.deviceId) deviceIdRef.current = deviceSettings.deviceId;
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const count = devices.filter((d) => d.kind === 'videoinput' && d.deviceId).length;
        if (runId === runIdRef.current && isMountedRef.current) setCameraCount(count);
      }).catch(() => { /* enumerateDevices tidak kritis */ });

      // Daftarkan listener event track kamera
      tracks.forEach(track => {
        track.onended = () => logCamera('WARN', `[Track Event] onended dipicu untuk '${track.label}'`);
        track.onmute = () => logCamera('WARN', `[Track Event] onmute dipicu untuk '${track.label}'`);
        track.onunmute = () => logCamera('INFO', `[Track Event] onunmute dipicu untuk '${track.label}'`);
      });
      
      // Create video element to capture frames
      video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      
      await new Promise<void>((resolve, reject) => {
        if (!video) return reject(new Error('Video element not created'));
        let resolved = false;
        const onReady = () => {
          if (!resolved) {
            resolved = true;
            logCamera('INFO', `Video metadata loaded: ${video!.videoWidth}x${video!.videoHeight}`);
            video!.play().catch(() => {});
            resolve();
          }
        };

        if (video.readyState >= 1) {
          onReady();
          return;
        }

        video.onloadedmetadata = onReady;
        video.oncanplay = onReady;
        video.onerror = (e) => {
          if (!resolved) {
            resolved = true;
            logCamera('ERROR', 'Video element error event', e);
            reject(new Error('Video load error'));
          }
        };
        // Timeout 3.5 detik (jika track sudah live, lanjutkan tanpa reject)
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            if (stream && stream.getVideoTracks().some(t => t.readyState === 'live')) {
              logCamera('WARN', 'Metadata wait timeout tetapi track video live, melanjutkan');
              resolve();
            } else {
              logCamera('ERROR', 'Camera init timeout: metadata tidak terload dan track tidak live');
              reject(new Error('Camera init timeout'));
            }
          }
        }, 3500);
      });
      
      // Warmup singkat — auto-exposure kamera masih menyesuaikan (±0.25 dtk).
      await new Promise(r => setTimeout(r, 250));

      // Cek frame SECEPAT MUNGKIN: 2 percobaan, lolos pada percobaan pertama
      // langsung berhenti (total ±0.25 dtk). Kalau tertutup/gelap: stream TETAP
      // dipertahankan agar monitor bisa mendeteksi pembukaan shutter secara
      // live — recovery instan tanpa buka ulang kamera.
      let validFrames = 0;
      let lastReason: 'flat' | 'dark' | 'black' = 'flat';
      for (let i = 0; i < 2; i++) {
        if (video) {
          const verdict = analyzeFrame(video);
          logCamera('INFO', `Frame check ${i + 1}/2: ${verdict.metrics} -> ${verdict.ok ? 'PASS' : `FAIL (${verdict.reason})`}`);
          if (verdict.ok) {
            validFrames++;
            break;
          }
          lastReason = verdict.reason;
        }
        if (i === 0) await new Promise(r => setTimeout(r, 150));
      }

      logCamera('INFO', `Hasil validasi frame: ${validFrames}/2 valid`);

      // Guard terakhir: run bisa digantikan selama menunggu exposure/frame check.
      if (runId !== runIdRef.current || !isMountedRef.current) {
        logCamera('WARN', `checkCamera run #${runId} basi setelah validasi frame — stream dihentikan`);
        stream.getTracks().forEach((t) => t.stop());
        activeCameraStreams.delete(stream);
        return;
      }

      if (validFrames < 1) {
        // Kamera tertutup / gelap: pertahankan stream + tampilkan alert.
        // Monitor (polling 500ms) akan langsung flip ke "siap" saat shutter dibuka.
        logCamera('WARN', `Kamera tertutup/gelap (${lastReason}) — stream dipertahankan, menunggu pembukaan shutter`);
        setHasPermission(false);
        setError(CAMERA_BLOCKED_MESSAGES[lastReason]);
        stopRecheck();
        cameraReady = true;
        setStream(stream);
        setVideoEl(video);
        return;
      }

      logCamera('INFO', 'Kamera BERHASIL diinisialisasi dan siap (hasPermission=true)');
      setHasPermission(true);
      stopRecheck(); // Camera is available, stop periodic re-check
      cameraReady = true;
      setStream(stream);
      setVideoEl(video);
    } catch (err) {
      const error = err as Error;
      logCamera('ERROR', `Gagal inisialisasi kamera: [${error.name}] ${error.message}`);
      // Run basi (sudah digantikan run lebih baru) — jangan ubah state / recheck.
      if (runId === runIdRef.current && isMountedRef.current) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setError('Izin kamera ditolak. Harap izinkan akses kamera untuk menggunakan Windows Hello.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setError('Kamera tidak ditemukan. Windows Hello memerlukan kamera untuk verifikasi wajah.');
        } else if (error.message.includes('tertutup') || error.message.includes('gelap')) {
          setError(error.message);
        } else if (error.message.includes('timeout')) {
          setError('Kamera tidak merespons. Pastikan kamera tidak digunakan aplikasi lain dan shutter terbuka.');
        } else {
          setError('Tidak dapat mengakses kamera. Periksa pengaturan privasi perangkat dan buka shutter kamera.');
        }
        setHasPermission(false);
        startRecheck(); // Camera unavailable — start periodic re-check so it auto-recovers when shutter opens
      }
    } finally {
      // Only cleanup on error - keep stream alive on success for preview
      if (!cameraReady) {
        logCamera('WARN', 'Membersihkan stream karena kameraReady=false');
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          activeCameraStreams.delete(stream);
        }
        if (video) {
          video.srcObject = null;
          video.remove();
        }
      }
      // Hanya run terbaru yang boleh menutup status isChecking —
      // run basi tidak boleh mengganggu state run yang sedang berjalan.
      if (runId === runIdRef.current && isMountedRef.current) {
        logCamera('INFO', 'checkCamera selesai, isChecking=false');
        setIsChecking(false);
      }
    }
  }, [stopRecheck, startRecheck, stopStreamSafely]);

  useEffect(() => {
    checkCameraRef.current = checkCamera;
  }, [checkCamera]);

  // NOTE: Camera is NOT auto-started on mount.
  // Consumer (LoginPage) must call startCamera() explicitly.
  // This ensures camera only activates on login page, not on SecuritySetupPage etc.
  const startCamera = useCallback(() => {
    checkCamera();
  }, [checkCamera]);

  // Stop camera saat navigasi back/forward ATAU halaman dibuang penuh (pagehide).
  // Stream cleanup penuh ada di effect unmount terpisah + route guard global.
  useEffect(() => {
    const handleLeave = () => {
      stopCameraRef.current();
    };
    window.addEventListener('popstate', handleLeave);
    window.addEventListener('pagehide', handleLeave);
    return () => {
      window.removeEventListener('popstate', handleLeave);
      window.removeEventListener('pagehide', handleLeave);
      stopRecheck();
    };
  }, [stopRecheck]);

  /** Verify camera is still active and producing valid frames (quick check before auth) */
  const verifyCameraActive = useCallback(async (videoElement?: HTMLVideoElement | null): Promise<boolean> => {
    const video = videoElement || videoEl;
    if (!video) {
      console.warn('[Camera] Video element not found for verification');
      return false;
    }

    // Wait for video to be ready if not yet (handles stream just assigned to preview element)
    if (video.readyState < 2) {
      logCamera('INFO', 'Menunggu video siap untuk verifikasi...');
      await new Promise<void>((resolve, reject) => {
        const handler = () => resolve();
        video.addEventListener('loadedmetadata', handler, { once: true });
        setTimeout(() => {
          video.removeEventListener('loadedmetadata', handler);
          reject(new Error('Video not ready within timeout'));
        }, 3000);
      }).catch(() => {
        console.warn('[Camera] Video not ready for verification');
        return false;
      });
    }

    // Ensure video is playing so frames are available
    try {
      await video.play();
    } catch {
      // Autoplay may be blocked, but frames can still be drawn from paused video if metadata loaded
    }

    if (video.readyState < 2) {
      console.warn('[Camera] Video still not ready after play attempt');
      return false;
    }

    try {
      // Pakai analyzer yang sama dengan checkCamera — deteksi frame rata
      // (shutter tertutup), gelap sekali, atau hitam total.
      const verdict = analyzeFrame(video);
      logCamera('INFO', 'Verifikasi frame sebelum auth', {
        metrics: verdict.metrics,
        reason: verdict.reason,
        active: verdict.ok
      });
      return verdict.ok;
    } catch (err) {
      console.error('[Camera] Verification failed:', err);
      return false;
    }
  }, [videoEl]);

  /**
   * Continuous monitoring — aktif selama ada stream (termasuk saat kamera
   * "tertutup", karena stream dipertahankan khusus untuk auto-recovery).
   * - Polling 500ms: deteksi shutter tertutup/gelap dalam ±1 detik.
   * - Saat frame valid lagi → otomatis flip kembali ke "siap" secepat mungkin
   *   (tanpa buka ulang kamera — stream tetap hidup).
   */
  useEffect(() => {
    if (!stream) return;
    let cancelled = false;
    let inFlight = false;
    let failCount = 0;
    let intervalId = null;

    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const isLive = stream.getVideoTracks().some(t => t.readyState === 'live');
        if (!isLive) {
          logCamera('WARN', 'Continuous monitoring: stream tidak live!', {
            tracks: stream.getVideoTracks().map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled }))
          });
          if (!cancelled) {
            setHasPermission(false);
            setError('Kamera terputus. Pastikan kamera terhubung.');
            stopCameraRef.current();
          }
          return;
        }

        const active = await verifyCameraActive();
        if (cancelled) return;
        if (!active) {
          failCount++;
          logCamera('WARN', `Continuous monitoring: frame tidak aktif (${failCount}/2)`);
          if (failCount >= 2) {
            logCamera('ERROR', 'Continuous monitoring: kamera tertutup/gelap — alert ditampilkan (stream dipertahankan)');
            setHasPermission(false);
            setError('Kamera tertutup atau terlalu gelap. Buka penutup kamera (shutter), nyalakan lampu, ubah posisi, atau ganti kamera.');
            // Stream TETAP dipertahankan: pembukaan shutter terdeteksi di poll
            // berikutnya (±500ms) tanpa buka ulang kamera.
          }
        } else {
          // Recovery: kamera valid lagi → kembali "siap" secepat mungkin
          if (hasPermission !== true || failCount >= 2) {
            logCamera('INFO', 'Continuous monitoring: kamera PULIH — kembali aktif');
            setHasPermission(true);
            setError(null);
          }
          failCount = 0;
        }
      } catch {
        // Ignore transient poll errors
      } finally {
        inFlight = false;
      }
    };

    intervalId = window.setInterval(poll, 500);
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [stream, verifyCameraActive, hasPermission, stopCameraRef]);

  /**
   * Matikan kamera saat halaman (mis. LoginPage) di-unmount —
   * misalnya setelah login berhasil dan navigasi ke dashboard.
   * stopAllCameraStreams() memastikan stream bocor dari run tumpang tindih
   * ikut mati, bukan hanya stream yang terakhir tercatat di ref.
   */
  useEffect(() => {
    return () => {
      stopRecheck();
      stopStreamSafely();
      stopAllCameraStreams();
    };
  }, [stopRecheck, stopStreamSafely]);

  /** Capture a photo from the video stream */
  const capturePhoto = useCallback(async (activeVideoEl?: HTMLVideoElement | null): Promise<string | null> => {
    const el = activeVideoEl || videoEl;
    if (!el || el.readyState < 2) {
      console.warn('[Camera] Video not ready for capture');
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = el.videoWidth;
      canvas.height = el.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Draw current frame (mirror for selfie view)
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);

      // Convert to base64 JPEG (quality 0.8)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      logCamera('INFO', 'Foto berhasil diambil', {
        sizeKB: Math.round(dataUrl.length / 1024)
      });
      return dataUrl;
    } catch (err) {
      console.error('[Camera] Capture failed:', err);
      return null;
    }
  }, [videoEl]);

  /** Paksa matikan kamera (track + interval) — dipanggil sebelum navigate keluar halaman login */
  const stopCamera = useCallback(() => {
    stopRecheck();
    stopStreamSafely();
    stopAllCameraStreams();
    setStream(null);
    setVideoEl(null);
    setHasPermission(false);
    setIsChecking(false);
  }, [stopRecheck, stopStreamSafely]);

  // Ref selalu menunjuk ke versi terbaru dan terisi sejak mount pertama,
  // sehingga handler popstate/pagehide tidak pernah memanggil fungsi kosong (noop).
  useEffect(() => {
    stopCameraRef.current = () => stopCamera();
  });

  /** Ganti kamera aktif (mis. kamera IR → RGB di laptop Lenovo yang punya 2 kamera).
   *  Dipakai tombol "Ganti Kamera" saat kamera tertutup / gelap. */
  const switchCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      setError('Tidak bisa mengganti kamera di perangkat ini.');
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
      if (cams.length < 2) {
        setError('Hanya ada satu kamera di perangkat ini. Buka penutup kamera (shutter) atau ubah posisi pencahayaan.');
        return;
      }
      const idx = cams.findIndex((c) => c.deviceId === deviceIdRef.current);
      const next = cams[(idx + 1) % cams.length];
      logCamera('INFO', `Ganti kamera → perangkat #${((idx + 1) % cams.length) + 1}: ${next.label || next.deviceId}`);
      deviceIdRef.current = next.deviceId;
      await checkCamera();
    } catch (err) {
      logCamera('ERROR', `Gagal mengganti kamera: ${err instanceof Error ? err.message : String(err)}`);
      setError('Gagal mengganti kamera. Coba lagi.');
    }
  }, [checkCamera]);

  return { hasPermission, isChecking, error, requestPermission: checkCamera, stream, videoEl, capturePhoto, verifyCameraActive, stopCamera, startCamera, switchCamera, cameraCount };
}

/** Auth guard hook - checks if user can access protected routes */
export function useAuthGuard() {
  const { status, isLoading, refetch } = useSecuritySetup();
  const canAccess = Boolean(
    !isLoading && status && (status.hasWebAuthn || status.hasDongle || !status.requiresSetup)
  );

  return { canAccess, isLoading, status, refetch };
}