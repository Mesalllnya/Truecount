import { useState, useCallback, useEffect, useRef, createContext, useContext, ReactNode } from 'react';

/** API base URL */
const API_BASE = 'http://localhost:8000';

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
  count: number;
  lastAttempt: string | null;
  lockedUntil: string | null;
}

/** Context for failed attempts tracking */
const FailedAttemptsContext = createContext<{
  state: FailedAttemptsState;
  increment: (identifier: string, method: string, success: boolean, error?: string) => Promise<void>;
  reset: (identifier: string) => Promise<void>;
  canUsePassword: (identifier: string) => boolean;
} | null>(null);

/** Provider component */
export function FailedAttemptsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FailedAttemptsState>({
    count: 0,
    lastAttempt: null,
    lockedUntil: null,
  });

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('tc_failed_attempts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Check if lock has expired
        if (parsed.lockedUntil && new Date(parsed.lockedUntil) > new Date()) {
          setState(parsed);
        } else if (parsed.count > 0) {
          // Reset expired lock but keep count for reference
          setState({ ...parsed, lockedUntil: null });
        }
      } catch {
        // Invalid stored data, ignore
      }
    }
  }, []);

  const saveState = useCallback((newState: FailedAttemptsState) => {
    setState(newState);
    localStorage.setItem('tc_failed_attempts', JSON.stringify(newState));
  }, []);

  const increment = useCallback(async (identifier: string, method: string, success: boolean, error?: string) => {
    // Catat ke server hanya untuk counter lokal (percobaan gagal, lockout, password fallback).
    // Penulisan ke tabel auth_attempts ditangani sepenuhnya oleh backend (login.php, webauthn_login_verify.php,
    // authenticate_verify.php) sebagai single source of truth, sehingga tidak ada duplikasi baris log.
    if (success) {
      // Reset on successful auth
      saveState({ count: 0, lastAttempt: new Date().toISOString(), lockedUntil: null });
      return;
    }

    // Increment failed count
    const newCount = state.count + 1;
    const now = new Date().toISOString();
    
    // Lock for 15 minutes after 5 failed attempts
    const lockedUntil = newCount >= 5 
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString() 
      : null;

    saveState({
      count: newCount,
      lastAttempt: now,
      lockedUntil,
    });
  }, [state.count, saveState]);

  const reset = useCallback(async (identifier: string) => {
    try {
      await fetch(`${API_BASE}/auth/attempts/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
    } catch {
      console.warn('[TrueCount] Failed to reset attempts on server');
    }
    saveState({ count: 0, lastAttempt: null, lockedUntil: null });
  }, [saveState]);

  const canUsePassword = useCallback((identifier: string) => {
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

      const res = await fetch(`${API_BASE}/auth/security-setup`, {
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

  // Ref ke stream terbaru untuk cleanup saat unmount
  const streamRef = useRef<MediaStream | null>(null);
  streamRef.current = stream;

  /** Clear the periodic re-check interval */
  const stopRecheck = useCallback(() => {
    if (recheckIntervalRef.current) {
      window.clearInterval(recheckIntervalRef.current);
      recheckIntervalRef.current = null;
    }
  }, []);

  /** Check if video frame has actual content (not black/covered) */
  const checkFrameHasContent = (video: HTMLVideoElement): boolean => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('[Camera] No canvas context');
      return false;
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (!imageData) {
      console.log('[Camera] No image data');
      return false;
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
    
    // Stricter checks:
    // 1. At least 15% non-black pixels
    // 2. Average brightness > 20 (not just sensor noise)
    // 3. Contrast > 30 (real face has shadows/highlights)
    // 4. StdDev > 15 (real face has variance; covered/black shutter has near-zero variance)
    const hasEnoughPixels = nonBlackPercent >= 15;
    const hasBrightness = avgBrightness > 20;
    const hasContrast = contrast > 30;
    const hasVariance = stdDev > 15;
    const result = hasEnoughPixels && hasBrightness && hasContrast && hasVariance;
    
    // Log as individual lines (not collapsed object)
    console.log('[Camera] Frame check:');
    console.log('  nonBlackPercent:', nonBlackPercent.toFixed(2) + '% (need ≥15%) →', hasEnoughPixels ? 'PASS' : 'FAIL');
    console.log('  avgBrightness:', avgBrightness.toFixed(1), '(need >20) →', hasBrightness ? 'PASS' : 'FAIL');
    console.log('  contrast:', contrast.toFixed(1), '(need >30) →', hasContrast ? 'PASS' : 'FAIL');
    console.log('  stdDev:', stdDev.toFixed(1), '(need >25) →', hasVariance ? 'PASS' : 'FAIL');
    console.log('  RESULT:', result ? 'PASSED' : 'FAILED');
    return result;
  };

  const checkCamera = useCallback(async () => {
    console.log('[Camera] Starting camera check...');
    setIsChecking(true);
    setError(null);
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let cameraReady = false;

    try {
      // Force stop any existing tracks first (handles shutter open/close)
      try {
        const existingStreams = await navigator.mediaDevices.getUserMedia({ video: true });
        existingStreams.getTracks().forEach(t => t.stop());
        console.log('[Camera] Stopped existing camera tracks');
      } catch { /* ignore */ }
      
      // Request camera permission with facingMode: user (front camera for face)
      console.log('[Camera] Requesting camera access...');
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      const tracks = stream.getTracks();
      console.log('[Camera] Got stream:', tracks.map(t => ({ kind: t.kind, label: t.label, enabled: t.enabled, readyState: t.readyState })));
      // Log all available video inputs for debugging
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        console.log('[Camera] Available video inputs:', videoInputs.map(d => ({ label: d.label, deviceId: d.deviceId })));
      } catch (e) {
        console.log('[Camera] Could not enumerate devices:', e);
      }
      
      // Create video element to capture frames
      video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      
      await new Promise<void>((resolve, reject) => {
        if (!video) return reject(new Error('Video element not created'));
        video.onloadedmetadata = () => {
          console.log('[Camera] Video metadata loaded:', { width: video!.videoWidth, height: video!.videoHeight });
          video!.play().then(resolve).catch(reject);
        };
        video.onerror = (e) => {
          console.error('[Camera] Video error:', e);
          reject(new Error('Video load error'));
        };
        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Camera init timeout')), 5000);
      });
      
      console.log('[Camera] Video playing, waiting for auto-exposure...');
      // Give camera a moment to auto-expose/adjust (longer for low light)
      await new Promise(r => setTimeout(r, 1500));
      
      if (video) {
        console.log('[Camera] Video ready state:', video.readyState, 'dimensions:', video.videoWidth, 'x', video.videoHeight);
      }
      
      // Check multiple frames to ensure consistent content
      let validFrames = 0;
      const frameChecks = 5; // more checks for reliability
      for (let i = 0; i < frameChecks; i++) {
        if (video && checkFrameHasContent(video)) {
          validFrames++;
          console.log('[Camera] Frame', i + 1, '/', frameChecks, 'PASSED');
        } else {
          console.log('[Camera] Frame', i + 1, '/', frameChecks, 'FAILED');
        }
        await new Promise(r => setTimeout(r, 150));
      }
      
      console.log('[Camera] Final result:', { validFrames, frameChecks, needed: 2, passed: validFrames >= 2 });
      
      if (validFrames < 2) { // need at least 2 valid frames out of 5
        throw new Error('Kamera terdeteksi tertutup/gelap. Buka penutup fisik kamera (shutter) untuk Windows Hello.');
      }
      
      console.log('[Camera] SUCCESS - Camera ready');
      setHasPermission(true);
      stopRecheck(); // Camera is available, stop periodic re-check
      cameraReady = true;
    } catch (err) {
      const error = err as Error;
      console.error('[Camera] ERROR:', error.message);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setError('Izin kamera ditolak. Harap izinkan akses kamera untuk menggunakan Windows Hello.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setError('Kamera tidak ditemukan. Windows Hello memerlukan kamera untuk verifikasi wajah.');
      } else if (error.message.includes('tertutup') || error.message.includes('gelap')) {
        setError(error.message);
      } else if (error.message.includes('timeout')) {
        setError('Kamera tidak merespons. Pastikan kamera tidak digunakan aplikasi lain dan shutter terbuka.');
      } else {
        setError('Tidak dapat mengakses kamera. Periksa pengaturan privasi browser dan buka shutter kamera.');
      }
      setHasPermission(false);
      startRecheck(); // Camera unavailable — start periodic re-check so it auto-recovers when shutter opens
    } finally {
      // Only cleanup on error - keep stream alive on success for preview
      if (!cameraReady) {
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (video) {
          video.srcObject = null;
          video.remove();
        }
      } else {
        // Success - keep stream and video for preview
        setStream(stream);
        setVideoEl(video);
      }
      console.log('[Camera] Check complete, isChecking=false');
      setIsChecking(false);
    }
  }, []);

  /** Start periodic re-check when camera is not available (e.g., shutter closed) */
  const startRecheck = useCallback(() => {
    stopRecheck();
    // Re-check every 3 seconds so that when user opens shutter / grants permission,
    // the camera becomes available automatically without manual retry.
    recheckIntervalRef.current = window.setInterval(() => {
      if (!isChecking) {
        checkCamera();
      }
    }, 3000);
  }, [stopRecheck, checkCamera, isChecking]);

  useEffect(() => {
    checkCamera();
    return () => {
      stopRecheck();
    };
  }, [checkCamera, stopRecheck]);

  /** Verify camera is still active and producing valid frames (quick check before auth) */
  const verifyCameraActive = useCallback(async (videoElement?: HTMLVideoElement | null): Promise<boolean> => {
    const video = videoElement || videoEl;
    if (!video) {
      console.warn('[Camera] Video element not found for verification');
      return false;
    }

    // Wait for video to be ready if not yet (handles stream just assigned to preview element)
    if (video.readyState < 2) {
      console.log('[Camera] Waiting for video to be ready...');
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
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let nonBlackPixels = 0;
      let totalSamples = 0;
      let sumBrightness = 0;
      let sumBrightnessSq = 0;
      let minBrightness = 255;
      let maxBrightness = 0;
      const sampleStep = Math.max(1, Math.floor(data.length / 2000)); // sample ~500 pixels for speed
      for (let i = 0; i < data.length; i += sampleStep * 4) {
        totalSamples++;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const brightness = (r + g + b) / 3;
        sumBrightness += brightness;
        sumBrightnessSq += brightness * brightness;
        minBrightness = Math.min(minBrightness, brightness);
        maxBrightness = Math.max(maxBrightness, brightness);
        if (r > 5 || g > 5 || b > 5) nonBlackPixels++;
      }
      const nonBlackPercent = (nonBlackPixels / totalSamples) * 100;
      const avgBrightness = sumBrightness / totalSamples;
      const contrast = maxBrightness - minBrightness;
      const variance = (sumBrightnessSq / totalSamples) - (avgBrightness * avgBrightness);
      const stdDev = Math.sqrt(Math.max(0, variance));

      const hasEnoughPixels = nonBlackPercent >= 15;
      const hasBrightness = avgBrightness > 20;
      const hasContrast = contrast > 30;
      const hasVariance = stdDev > 15;
      const result = hasEnoughPixels && hasBrightness && hasContrast && hasVariance;

      console.log('[Camera] Verification:', {
        nonBlackPercent: nonBlackPercent.toFixed(2) + '%',
        avgBrightness: avgBrightness.toFixed(1),
        contrast: contrast.toFixed(1),
        stdDev: stdDev.toFixed(1),
        active: result
      });
      return result;
    } catch (err) {
      console.error('[Camera] Verification failed:', err);
      return false;
    }
  }, [videoEl]);

  /**
   * Continuous monitoring while camera is active.
   * Detects shutter closed mid-session: samples frames every 2 seconds;
   * if frames go dark, flips status to inactive and starts periodic re-check.
   */
  useEffect(() => {
    if (hasPermission !== true) return;
    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (cancelled || inFlight || isChecking) return;
      inFlight = true;
      try {
        const active = await verifyCameraActive();
        if (cancelled) return;
        if (!active) {
          console.warn('[Camera] Camera became inactive during monitoring (shutter closed?)');
          setHasPermission(false);
          setError('Kamera terdeteksi tertutup/gelap. Buka penutup fisik kamera (shutter).');
          // Stop stream so preview freezes, then start periodic re-check
          if (stream) stream.getTracks().forEach(t => t.stop());
          startRecheck();
        }
      } catch {
        // Ignore transient poll errors
      } finally {
        inFlight = false;
      }
    };

    const intervalId = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hasPermission, isChecking, stream, verifyCameraActive, startRecheck]);

  /**
   * Matikan kamera saat halaman (mis. LoginPage) di-unmount —
   * misalnya setelah login berhasil dan navigasi ke dashboard.
   */
  useEffect(() => {
    return () => {
      stopRecheck();
      const current = streamRef.current;
      if (current) {
        current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [stopRecheck]);

  /** Capture a photo from the video stream */
  const capturePhoto = useCallback(async (): Promise<string | null> => {
    if (!videoEl || videoEl.readyState < 2) {
      console.warn('[Camera] Video not ready for capture');
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Draw current frame (mirror for selfie view)
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      // Convert to base64 JPEG (quality 0.8)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      console.log('[Camera] Photo captured:', Math.round(dataUrl.length / 1024), 'KB');
      return dataUrl;
    } catch (err) {
      console.error('[Camera] Capture failed:', err);
      return null;
    }
  }, [videoEl]);

  return { hasPermission, isChecking, error, requestPermission: checkCamera, stream, videoEl, capturePhoto, verifyCameraActive };
}

/** Auth guard hook - checks if user can access protected routes */
export function useAuthGuard() {
  const { status, isLoading, refetch } = useSecuritySetup();
  const [canAccess, setCanAccess] = useState(false);

  useEffect(() => {
    if (!isLoading && status) {
      // Allow access if user has at least one security method configured
      // OR if they're on the setup page itself
      setCanAccess(status.hasWebAuthn || status.hasDongle || !status.requiresSetup);
    }
  }, [isLoading, status]);

  return { canAccess, isLoading, status, refetch };
}