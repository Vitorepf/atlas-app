// HTTP foundation for the Atlas API client: config cache, auth/token storage,
// and the request engine. Split out of ./client.ts (barrel) so the domain
// surface can import the plumbing without a circular dependency. Do not import
// from ./client here — core.ts must stay dependency-free of the domain barrel.
import { atlasStorage, ensureMigrationFromAsyncStorage } from '../storage'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

const extraAtlas = (Constants.expoConfig?.extra?.atlas ?? {}) as Partial<ApiConfig>

const DEFAULT_HOST = extraAtlas.apiHost ?? '127.0.0.1'
const DEFAULT_PORT = Number(extraAtlas.apiPort ?? 3737)
const DEFAULT_TOKEN = extraAtlas.apiToken ?? 'local-development-atlas-token-change-me'
const LEGACY_PLACEHOLDER_TOKEN = 'local-development-atlas-token-change-me'
const LEGACY_DEFAULT_HOSTS = new Set(['vitors-macbook-pro-1', 'macbook-pro-de-vitor'])

const HOST_KEY = 'atlas-api.host'
const PORT_KEY = 'atlas-api.port'
const TOKEN_KEY = 'atlas-api.token'
const MOBILE_TOKEN_KEY = 'atlas-mobile.deviceToken'
const MOBILE_DEVICE_ID_KEY = 'atlas-mobile.deviceId'

let cachedHost: string | null = null
let cachedPort: number | null = null
let cachedToken: string | null = null
let cachedMobileDeviceToken: string | null = null
let cachedMobileDeviceId: string | null = null
let hydratePromise: Promise<void> | null = null

export interface ApiConfig {
  apiHost: string
  apiPort: number
  apiToken: string
}

export interface MobileDeviceSession {
  deviceToken: string
  deviceId: string
}

export class AtlasApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly payload: unknown,
  ) {
    super(message)
    this.name = 'AtlasApiError'
  }
}

function shouldUseStoredBackendHost(host: string): boolean {
  const normalized = host.trim()
  if (!normalized) return false

  // Builds antigos gravavam hostnames Bonjour/DNS locais como default. Quando
  // esses nomes param de resolver, o app fica "zerado" mesmo com relatório real
  // no backend. Se o operador não escolheu outro host, migra para o default atual.
  if (LEGACY_DEFAULT_HOSTS.has(normalized) && normalized !== DEFAULT_HOST) return false

  return true
}

export async function hydrateApiConfig(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      // Garante que valores legados em AsyncStorage estejam copiados pro
      // MMKV antes de ler. Sem isso, usuários atualizando perderiam host
      // customizado, device pairing, etc.
      await ensureMigrationFromAsyncStorage()
      const [host, port, token, mobileToken, mobileDeviceId] = await Promise.all([
        atlasStorage.getItem(HOST_KEY),
        atlasStorage.getItem(PORT_KEY),
        readStoredToken(),
        readStoredMobileDeviceToken(),
        readStoredMobileDeviceId(),
      ])

      if (host) {
        if (shouldUseStoredBackendHost(host)) {
          cachedHost = host.trim()
        } else {
          cachedHost = null
          await atlasStorage.removeItem(HOST_KEY)
        }
      }
      if (port) {
        const n = Number(port)
        if (Number.isFinite(n) && n > 0) cachedPort = n
      }
      if (token && token !== LEGACY_PLACEHOLDER_TOKEN) cachedToken = token
      if (mobileToken) cachedMobileDeviceToken = mobileToken
      if (mobileDeviceId) cachedMobileDeviceId = mobileDeviceId
    })()
  }

  await hydratePromise
}

export function getBackendHost(): string {
  return cachedHost ?? DEFAULT_HOST
}

export function getBackendPort(): number {
  return cachedPort ?? DEFAULT_PORT
}

export function getBackendToken(): string {
  return cachedToken ?? DEFAULT_TOKEN
}

export function getApiConfig(): ApiConfig {
  return {
    apiHost: getBackendHost(),
    apiPort: getBackendPort(),
    apiToken: getBackendToken(),
  }
}

export async function setBackendHost(host: string): Promise<void> {
  cachedHost = host.trim() || DEFAULT_HOST
  await atlasStorage.setItem(HOST_KEY, cachedHost)
}

// Drop a stored backend host so the app reverts to the build-injected default
// host (set by `npm run dev:ios` to the Mac's LAN IP). Recovery path for when a
// previously-stored host (e.g. a Tailscale IP) stops being reachable and would
// otherwise permanently shadow the working default.
export async function clearStoredBackendHost(): Promise<void> {
  cachedHost = null
  await atlasStorage.removeItem(HOST_KEY)
}

export function getDefaultBackendHost(): string {
  return DEFAULT_HOST
}

export async function setBackendPort(port: number): Promise<void> {
  cachedPort = Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT
  await atlasStorage.setItem(PORT_KEY, String(cachedPort))
}

export async function setBackendToken(token: string): Promise<void> {
  cachedToken = token.trim() || DEFAULT_TOKEN
  await writeStoredToken(cachedToken)
}

export function getApiBase(): string {
  const host = getBackendHost().replace(/\/+$/, '')
  if (host.startsWith('http://') || host.startsWith('https://')) return host

  return `http://${host}:${getBackendPort()}`
}

export function getAtlasAuthHeaders(): Record<string, string> {
  return { 'X-Atlas-Token': getBackendToken() }
}

export function getMobileDeviceSession(): MobileDeviceSession | null {
  if (!cachedMobileDeviceToken || !cachedMobileDeviceId) return null

  return {
    deviceToken: cachedMobileDeviceToken,
    deviceId: cachedMobileDeviceId,
  }
}

export function hasMobileDeviceBearer(): boolean {
  return Boolean(cachedMobileDeviceToken)
}

export function getMobileAuthHeaders(): Record<string, string> {
  if (!cachedMobileDeviceToken) return {}

  return { Authorization: `Bearer ${cachedMobileDeviceToken}` }
}

export async function setMobileDeviceSession(session: MobileDeviceSession): Promise<void> {
  cachedMobileDeviceToken = session.deviceToken
  cachedMobileDeviceId = session.deviceId
  await Promise.all([
    writeStoredMobileDeviceToken(session.deviceToken),
    writeStoredMobileDeviceId(session.deviceId),
  ])
}

export async function clearMobileDeviceSession(): Promise<void> {
  cachedMobileDeviceToken = null
  cachedMobileDeviceId = null
  await Promise.all([
    removeStoredMobileDeviceToken(),
    removeStoredMobileDeviceId(),
  ])
}

export function getMobileDeviceToken(): string | null {
  return cachedMobileDeviceToken
}

export function getMobileDeviceId(): string | null {
  return cachedMobileDeviceId
}

export async function apiGet<T>(
  path: string,
  opts: { auth?: boolean; etag?: boolean } = {},
): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' }, opts)
}

export async function mobileApiGet<T>(
  path: string,
  opts: { timeoutMs?: number; retry?: boolean } = {},
): Promise<T> {
  return mobileApiRequest<T>(path, { method: 'GET' }, opts)
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function mobileApiPost<T>(
  path: string,
  body: unknown,
  opts: { idempotencyKey?: string } = {},
): Promise<T> {
  return mobileApiRequest<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  })
}

export async function mobileApiDelete<T>(path: string): Promise<T> {
  return mobileApiRequest<T>(path, { method: 'DELETE' })
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'DELETE' })
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: form as unknown as BodyInit,
  })
}

const DEFAULT_FETCH_TIMEOUT_MS = 15_000
const UPLOAD_FETCH_TIMEOUT_MS = 120_000

// --- GET ETag/304 conditional cache ------------------------------------------
// The backend serves an ETag (a deterministic surface hash over the body minus
// volatile fields like generated_at) plus a 304 branch when nothing real
// changed. Without honoring it, every poll re-downloads + re-parses a fresh body
// = a brand-new object reference each tick, which defeats react-query structural
// sharing and makes the UI blink. This cache makes GET conditional:
//   • on a GET with a cached ETag we send `If-None-Match`;
//   • a 304 returns the PREVIOUSLY-PARSED payload BY REFERENCE (no re-parse, so
//     the reference is stable → structural sharing keeps it → no re-render);
//   • a 200 stores the response ETag + parsed payload for next time.
// It is purely additive and self-gating: endpoints that don't emit an ETag never
// get a cache entry and never receive an `If-None-Match`, so their behavior is
// byte-identical to before. Only the operator-token GET surfaces that serve an
// ETag (the Loop command read models today) take the fast path. The cache is
// keyed by the absolute request URL (which already carries auth scope via path +
// query) and is bounded with simple LRU eviction so it can't grow unbounded in a
// long-lived session.
interface EtagCacheEntry {
  etag: string
  payload: unknown
}

const ETAG_CACHE = new Map<string, EtagCacheEntry>()
const ETAG_CACHE_MAX_ENTRIES = 64

function etagCacheGet(url: string): EtagCacheEntry | undefined {
  const hit = ETAG_CACHE.get(url)
  if (hit === undefined) return undefined
  // Touch for LRU recency: delete + re-set moves it to the end of the Map.
  ETAG_CACHE.delete(url)
  ETAG_CACHE.set(url, hit)
  return hit
}

function etagCacheSet(url: string, entry: EtagCacheEntry): void {
  if (ETAG_CACHE.has(url)) ETAG_CACHE.delete(url)
  ETAG_CACHE.set(url, entry)
  while (ETAG_CACHE.size > ETAG_CACHE_MAX_ENTRIES) {
    const oldest = ETAG_CACHE.keys().next().value
    if (oldest === undefined) break
    ETAG_CACHE.delete(oldest)
  }
}

function fetchBackoffMs(attempt: number): number {
  return Math.min(200 * 2 ** attempt, 1400)
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function executeFetch(
  url: string,
  init: RequestInit,
  options: { timeoutMs?: number; retry?: boolean } = {},
): Promise<Response> {
  const headers = new Headers(init.headers ?? {})
  const method = (init.method ?? 'GET').toUpperCase()
  const isUpload = init.body instanceof FormData
  const timeoutMs = options.timeoutMs ?? (isUpload ? UPLOAD_FETCH_TIMEOUT_MS : DEFAULT_FETCH_TIMEOUT_MS)
  const safeMethods = method === 'GET' || method === 'HEAD'
  const hasIdempotencyKey = headers.has('Idempotency-Key')
  const shouldRetry = options.retry ?? (safeMethods || hasIdempotencyKey)
  const maxAttempts = shouldRetry ? 3 : 1

  // Se o caller passou um signal externo, encadeamos com o nosso de timeout:
  // qualquer um dos dois aborta o fetch. Hoje nenhum caller usa, mas evita
  // armadilha futura de signal silenciosamente sobrescrito.
  const externalSignal = (init as RequestInit & { signal?: AbortSignal }).signal ?? null

  let lastError: unknown = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onExternalAbort = () => controller.abort()
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort()
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
      if (response.status >= 500 && response.status <= 599 && attempt < maxAttempts - 1) {
        // Drena o body e preserva payload pro caso de TODAS as tentativas
        // falharem — caller terá a mensagem real do servidor.
        let errorPayload: unknown = null
        try {
          const text = await response.text()
          if (text) {
            try { errorPayload = JSON.parse(text) } catch { errorPayload = text }
          }
        } catch {
          // body já consumido / stream falhou: nada a fazer.
        }
        lastError = new AtlasApiError(
          errorMessage(url, response.status, errorPayload),
          response.status,
          url,
          errorPayload,
        )
        await delayMs(fetchBackoffMs(attempt))
        continue
      }
      return response
    } catch (error) {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
      lastError = error
      if (attempt < maxAttempts - 1) {
        await delayMs(fetchBackoffMs(attempt))
        continue
      }
      throw error
    }
  }
  throw lastError ?? new AtlasApiError('Atlas API request failed', 0, url, null)
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit,
  opts: { auth?: boolean; timeoutMs?: number; retry?: boolean; etag?: boolean } = {},
): Promise<T> {
  await hydrateApiConfig()

  const headers = new Headers(init.headers)
  if (opts.auth !== false) {
    headers.set('X-Atlas-Token', getBackendToken())
  }

  const url = `${getApiBase()}${path}`
  const method = (init.method ?? 'GET').toUpperCase()

  // Conditional GET — OPT-IN (opts.etag). Default-off so every existing caller is
  // byte-identical: only callers that ask for it (the Loop read models, whose
  // backend serves ETag + 304) participate, keeping blast radius to that surface
  // while concurrent work touches other screens. When on: if we hold a cached
  // ETag for this exact URL, send `If-None-Match`; a 304 means the body is
  // byte-identical to what we already parsed, so we hand back the SAME reference
  // (stable identity → react-query keeps it → no per-poll blink). A caller-supplied
  // If-None-Match is never overridden.
  const conditional = opts.etag === true && method === 'GET'
  const isConditionalGet = conditional && !headers.has('If-None-Match')
  const cached = isConditionalGet ? etagCacheGet(url) : undefined
  if (cached !== undefined) headers.set('If-None-Match', cached.etag)

  const response = await executeFetch(
    url,
    { ...init, headers },
    { timeoutMs: opts.timeoutMs, retry: opts.retry },
  )

  if (response.status === 304 && cached !== undefined) {
    // Drain to free the connection; the body is empty by spec. Return cached ref.
    void response.text().catch(() => undefined)
    return cached.payload as T
  }

  const text = await response.text()
  const payload = text ? parsePayload(text) : null

  if (!response.ok) {
    const message = errorMessage(path, response.status, payload)
    throw new AtlasApiError(message, response.status, path, payload)
  }

  // Store/refresh the conditional-GET cache when the server advertises an ETag.
  // Only for opt-in GETs (self-gating twice over): no opt-in ⇒ no cache entry.
  if (conditional) {
    const etag = response.headers.get('ETag')
    if (etag !== null && etag !== '') {
      etagCacheSet(url, { etag, payload })
    }
  }

  return payload as T
}

async function mobileApiRequest<T>(
  path: string,
  init: RequestInit,
  opts: { timeoutMs?: number; retry?: boolean } = {},
): Promise<T> {
  await hydrateApiConfig()

  if (!cachedMobileDeviceToken) {
    throw new AtlasApiError('Atlas mobile ainda nao esta pareado.', 401, path, null)
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${cachedMobileDeviceToken}`)

  const response = await executeFetch(
    `${getApiBase()}${path}`,
    { ...init, headers },
    { timeoutMs: opts.timeoutMs, retry: opts.retry },
  )

  const text = await response.text()
  const payload = text ? parsePayload(text) : null

  if (!response.ok) {
    const message = errorMessage(path, response.status, payload)
    // Single source of truth for "server doesn't accept our mobile bearer":
    // any 401 on a mobile-bearer endpoint means the device record is gone
    // (revoked, deleted, banco resetado, build apontando pra outro server).
    // Clear local session atomically so callers never observe a "pareado
    // localmente mas rejeitado pelo servidor" estado fantasma. Idempotent —
    // safe to invoke from anywhere.
    if (response.status === 401) {
      await clearMobileDeviceSession()
    }
    throw new AtlasApiError(message, response.status, path, payload)
  }

  return payload as T
}

function parsePayload(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function errorMessage(path: string, status: number, payload: unknown): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    return String((payload as { message: unknown }).message)
  }
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error: unknown }).error
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message)
    }
  }
  if (payload && typeof payload === 'object' && 'errors' in payload) {
    const errors = (payload as { errors: unknown }).errors
    if (errors && typeof errors === 'object') {
      const first = Object.values(errors as Record<string, unknown>)[0]
      if (Array.isArray(first) && first[0]) return String(first[0])
      if (typeof first === 'string') return first
    }
  }

  return `Atlas API ${status} em ${path}`
}

export function queryString(params: Record<string, unknown>): string {
  const pairs: Array<[string, string]> = []
  for (const [key, value] of Object.entries(params)) {
    const normalized = normalizeQueryValue(key, value)
    if (normalized !== null) pairs.push([key, normalized])
  }
  if (pairs.length === 0) return ''

  return `?${pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')}`
}

function normalizeQueryValue(key: string, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null

  if (key === 'limit' && typeof value === 'number') {
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(value)))
    return String(safeLimit)
  }

  // Booleans · Laravel `boolean` validate aceita 1/0/true/false mas
  // REJEITA "true"/"false" como string. String(true) = "true" (422).
  // Solução universal: serializar boolean como "1"/"0" sempre.
  if (typeof value === 'boolean') {
    return value ? '1' : '0'
  }

  return String(value)
}

async function readStoredToken(): Promise<string | null> {
  try {
    const secureToken = await SecureStore.getItemAsync(TOKEN_KEY)
    if (secureToken) return secureToken
  } catch {
    // SecureStore can be unavailable in a non-native runtime; legacy storage remains a fallback.
  }

  return atlasStorage.getItem(TOKEN_KEY)
}

async function writeStoredToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    await atlasStorage.removeItem(TOKEN_KEY)
  } catch {
    await atlasStorage.setItem(TOKEN_KEY, token)
  }
}

async function readStoredMobileDeviceToken(): Promise<string | null> {
  try {
    const secureToken = await SecureStore.getItemAsync(MOBILE_TOKEN_KEY)
    if (secureToken) return secureToken
  } catch {
    // SecureStore can be unavailable in a non-native runtime; AsyncStorage remains a fallback.
  }

  return atlasStorage.getItem(MOBILE_TOKEN_KEY)
}

async function writeStoredMobileDeviceToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(MOBILE_TOKEN_KEY, token)
    await atlasStorage.removeItem(MOBILE_TOKEN_KEY)
    return
  } catch {
    // SecureStore can be unavailable in non-native runtimes; MMKV/memory remains a fallback.
  }

  await atlasStorage.setItem(MOBILE_TOKEN_KEY, token)
}

async function removeStoredMobileDeviceToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(MOBILE_TOKEN_KEY)
  } catch {
    // Ignore SecureStore removal failures and still clear the fallback key.
  }

  await atlasStorage.removeItem(MOBILE_TOKEN_KEY)
}

async function readStoredMobileDeviceId(): Promise<string | null> {
  try {
    const secureDeviceId = await SecureStore.getItemAsync(MOBILE_DEVICE_ID_KEY)
    if (secureDeviceId) return secureDeviceId
  } catch {
    // SecureStore can be unavailable in a non-native runtime; storage remains a fallback.
  }

  return atlasStorage.getItem(MOBILE_DEVICE_ID_KEY)
}

async function writeStoredMobileDeviceId(deviceId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(MOBILE_DEVICE_ID_KEY, deviceId)
  } catch {
    // Device id is not secret; durable storage is still attempted below.
  }

  await atlasStorage.setItem(MOBILE_DEVICE_ID_KEY, deviceId)
}

async function removeStoredMobileDeviceId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(MOBILE_DEVICE_ID_KEY)
  } catch {
    // Ignore SecureStore removal failures and still clear the fallback key.
  }

  await atlasStorage.removeItem(MOBILE_DEVICE_ID_KEY)
}
