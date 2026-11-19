import { invoke } from '@tauri-apps/api/core'

export type AppMode = 'client' | 'standalone' | 'server'

export interface AppConfig {
  mode: AppMode
  serverUrl: string
}

export interface HealthInfo {
  status?: string
  app?: string
  database?: string
  server_id?: string
  server_label?: string
  time?: string
  ip?: string
}

const STORAGE_KEY = 'tc_app_config'

const BUILD_MODE: AppMode =
  ((import.meta.env.VITE_DEFAULT_MODE as AppMode | undefined) ||
    (import.meta.env.DEV ? 'standalone' : 'client'))

/**
 * Default alamat server saat build.
 * - Mode standalone: backend lokal selalu 127.0.0.1, jadi pakai localhost.
 * - Mode client/server: pakai VITE_DEFAULT_SERVER_URL (IP laptop server di LAN).
 */
const BUILD_SERVER_URL: string =
  BUILD_MODE === 'standalone'
    ? 'http://localhost:8000'
    : ((import.meta.env.VITE_DEFAULT_SERVER_URL as string | undefined)?.trim() ||
      'http://localhost:8000')

export const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

let config: AppConfig = { mode: BUILD_MODE, serverUrl: BUILD_SERVER_URL }

function coerceMode(value: unknown): AppMode {
  return value === 'server' || value === 'standalone' || value === 'client'
    ? value
    : BUILD_MODE
}

function readStorage(): AppConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    if (typeof parsed?.serverUrl !== 'string' || !parsed.serverUrl) return null
    return { mode: coerceMode(parsed.mode), serverUrl: parsed.serverUrl }
  } catch {
    return null
  }
}

function writeStorage(next: AppConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage bisa diblokir; config tetap hidup di memori.
  }
}

/**
 * Validasi + rapikan alamat server.
 * Hanya origin (scheme + host + port), tanpa path/query/trailing slash.
 */
export function normalizeServerUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const value = raw.trim()
  if (!value) return { ok: false, error: 'Alamat server belum diisi.' }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { ok: false, error: 'Format harus http://host:port, contoh http://192.168.2.102:8000' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Alamat harus diawali http:// atau https://.' }
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    return { ok: false, error: 'Isi host dan port saja, tanpa path atau tanda tanya.' }
  }
  if (!parsed.hostname) {
    return { ok: false, error: 'Host server tidak valid.' }
  }

  return { ok: true, url: parsed.origin }
}

/**
 * Muat config sebelum React render.
 * Di Tauri: baca app_config.json lewat command Rust.
 * Di browser: pakai localStorage (untuk dev).
 */
export async function loadAppConfig(): Promise<AppConfig> {
  if (isTauri) {
    try {
      const stored = await invoke<Partial<AppConfig>>('get_app_config')
      const url = typeof stored?.serverUrl === 'string' ? stored.serverUrl.trim() : ''

      if (url) {
        const normalized = normalizeServerUrl(url)
        config = {
          mode: coerceMode(stored.mode),
          serverUrl: normalized.ok ? normalized.url : url,
        }
        writeStorage(config)
        return config
      }

      // Belum pernah dikonfigurasi: pakai default build lalu simpan sekali.
      config = { mode: BUILD_MODE, serverUrl: BUILD_SERVER_URL }
      await invoke('set_app_config', { config }).catch(() => undefined)
      writeStorage(config)
      return config
    } catch (err) {
      console.warn('[appConfig] gagal membaca get_app_config:', err)
    }
  }

  config = readStorage() ?? { mode: BUILD_MODE, serverUrl: BUILD_SERVER_URL }
  writeStorage(config)
  return config
}

export function getAppConfig(): AppConfig {
  return config
}

export async function saveAppConfig(next: AppConfig): Promise<void> {
  const normalized = normalizeServerUrl(next.serverUrl)
  if (!normalized.ok) throw new Error(normalized.error)

  const resolved: AppConfig = { mode: coerceMode(next.mode), serverUrl: normalized.url }

  // Tauri dulu: kalau spawn/validasi backend gagal, config lama tetap dipakai.
  if (isTauri) {
    await invoke('set_app_config', { config: resolved })
  }

  config = resolved
  writeStorage(config)
}

export function defaultAppConfig(): AppConfig {
  return { mode: BUILD_MODE, serverUrl: BUILD_SERVER_URL }
}

/** IP LAN laptop ini (IPv4) untuk saran alamat server. */
export async function getLanIp(): Promise<string | null> {
  if (isTauri) {
    try {
      const ip = await invoke<string | null>('get_lan_ip')
      return typeof ip === 'string' && ip.trim() ? ip.trim() : null
    } catch {
      return null
    }
  }

  // Browser dev: kalau diakses lewat IP LAN, pakai hostname itu.
  const host = window.location.hostname
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return null
  }
  return host
}

/** Base URL API aktif, tanpa trailing slash. */
export function apiBase(): string {
  return config.serverUrl.replace(/\/+$/, '')
}

/** Bangun URL API dari path relatif. */
export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${apiBase()}${suffix}`
}

/** Tes koneksi ke /health dengan timeout singkat. */
export async function testServerConnection(
  serverUrl: string,
  timeoutMs = 3500,
): Promise<HealthInfo> {
  const normalized = normalizeServerUrl(serverUrl)
  if (!normalized.ok) throw new Error(normalized.error)

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${normalized.url}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!res.ok) {
      throw new Error(`Server menjawab HTTP ${res.status}.`)
    }

    const data = (await res.json()) as HealthInfo
    if (!data || typeof data !== 'object') {
      throw new Error('Respons server bukan JSON yang valid.')
    }
    return data
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Server tidak menjawab dalam 3,5 detik. Cek IP dan firewall.')
    }
    if (err instanceof TypeError) {
      throw new Error('Tidak bisa menghubungi server. Cek IP laptop dan jaringan yang sama.')
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}
