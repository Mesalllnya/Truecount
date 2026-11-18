/**
 * Logger & Diagnostik Khusus Kamera TrueCount
 * Menyimpan log ke memori, localStorage, dan (opsional) file via Tauri IPC.
 * Hanya level WARN/ERROR yang dicetak ke konsol; INFO cukup untuk diagnostik.
 */

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  data?: any;
}

const MAX_LOGS = 150;
const STORAGE_KEY = 'tc_camera_debug_logs';

declare global {
  interface Window {
    __TC_CAMERA_LOGS__?: LogEntry[];
    __TAURI_INTERNALS__?: any;
  }
}

if (typeof window !== 'undefined' && !window.__TC_CAMERA_LOGS__) {
  window.__TC_CAMERA_LOGS__ = [];
}

/** Tambah satu baris log kamera */
export function logCamera(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const entry: LogEntry = { timestamp, level, message, data };

  if (typeof window !== 'undefined') {
    if (!window.__TC_CAMERA_LOGS__) window.__TC_CAMERA_LOGS__ = [];
    window.__TC_CAMERA_LOGS__.push(entry);
    if (window.__TC_CAMERA_LOGS__.length > MAX_LOGS) {
      window.__TC_CAMERA_LOGS__.shift();
    }

    // Simpan ringkasan ke localStorage agar tidak hilang saat refresh
    try {
      const serialized = JSON.stringify(window.__TC_CAMERA_LOGS__.slice(-40));
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch { /* ignore */ }

    // Kirim ke backend Rust/log file jika berjalan di Tauri
    try {
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        const payload = `[CAMERA ${level}] ${message} ${data ? JSON.stringify(data) : ''}`;
        window.__TAURI_INTERNALS__.invoke('log_from_frontend', { message: payload }).catch(() => {});
      }
    } catch { /* ignore */ }
  }

  // Hanya WARN/ERROR yang dicetak ke konsol. INFO tetap tersimpan di memori,
  // localStorage, dan file log Tauri untuk keperluan diagnostik.
  if (level === 'ERROR') {
    console.error('[Camera]', message, data ?? '');
  } else if (level === 'WARN') {
    console.warn('[Camera]', message, data ?? '');
  }
}

/** Mengambil seluruh riwayat log dalam format teks rapi untuk disalin */
export async function getFormattedCameraDiagnostic(): Promise<string> {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const isSecure = typeof window !== 'undefined' && window.isSecureContext;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'N/A';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A';

  // Periksa perangkat kamera yang terpasang di sistem
  let devicesList = 'Tidak dapat mendeteksi perangkat';
  try {
    if (navigator?.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      devicesList = videoDevices.length > 0
        ? videoDevices.map((d, i) => `  ${i + 1}. [${d.deviceId.slice(0, 8)}...] Label: "${d.label || '(Nama tidak diizinkan sebelum getUserMedia)'}"`).join('\n')
        : '  (Tidak ada perangkat videoinput terdeteksi)';
    }
  } catch (err: any) {
    devicesList = `  Gagal enumerateDevices: ${err?.message || err}`;
  }

  const logs = (typeof window !== 'undefined' && window.__TC_CAMERA_LOGS__) || [];

  return `=== TRUECOUNT CAMERA DIAGNOSTIC REPORT ===
Waktu Laporan: ${new Date().toLocaleString('id-ID')}
Environment:
  - Mode Desktop (Tauri): ${isTauri ? 'YA (Tauri Runtime)' : 'TIDAK (Web Browser)'}
  - isSecureContext: ${isSecure}
  - Origin: ${origin}
  - User Agent: ${ua}

Perangkat Kamera Terdeteksi:
${devicesList}

Log Event Kamera (${logs.length} entri terakhir):
${logs.map(l => `[${l.timestamp.slice(11, 23)}] [${l.level}] ${l.message}${l.data ? ' -> ' + JSON.stringify(l.data) : ''}`).join('\n')}
=== END OF REPORT ===`;
}

/** Salin log ke clipboard user */
export async function copyCameraLogsToClipboard(): Promise<boolean> {
  try {
    const text = await getFormattedCameraDiagnostic();
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback textarea jika clipboard API terbatas
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    }
  } catch (err) {
    console.error('Gagal menyalin log:', err);
    return false;
  }
}

