/**
 * Atlas storage — MMKV-first wrapper com API compatível com AsyncStorage.
 *
 * MMKV é síncrono, memory-mapped e baseado em JSI: 10–30× mais rápido que
 * AsyncStorage para blobs grandes (atlas.store.v1 chega na casa dos MB).
 * Mantemos a API async para que callers existentes não mudem assinatura,
 * mas a operação real é instantânea.
 *
 * Em ambiente sem JSI (Expo Go, web, env sem Nitro Modules), MMKV não
 * carrega — caímos num fallback AsyncStorage com cache write-through em
 * memória. Isso preserva persistência cross-reload em qualquer runtime;
 * antes o fallback era Map() puro e tudo era perdido (tema, host pairing,
 * routing prefs, etc).
 */

interface BackendStore {
  get(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
}

let backend: BackendStore
/**
 * Promise que resolve quando o backend está pronto pra ler dados persistidos.
 *  - MMKV: resolve instantâneo (storage é síncrono)
 *  - AsyncStorage fallback: resolve depois de hidratar o cache em memória
 *
 * `atlasStorage.getItem/removeItem/multi*` aguardam isso antes de ler/escrever
 * pra garantir que reads early no boot enxergam dados persistidos.
 * `*Sync` variants NÃO aguardam (best-effort, retornam null se early).
 */
let storageHydrationPromise: Promise<void> = Promise.resolve()

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mmkv = require('react-native-mmkv') as { createMMKV?: (config: { id: string }) => { getString(key: string): string | undefined; set(key: string, value: boolean | string | number | ArrayBuffer): void; remove(key: string): boolean } }
  if (typeof mmkv.createMMKV !== 'function') throw new Error('createMMKV missing')
  const instance = mmkv.createMMKV({ id: 'atlas.v1' })
  backend = {
    get: (key) => instance.getString(key),
    set: (key, value) => instance.set(key, value),
    // MMKV v4 API: instance.remove(key) — NÃO `delete` (que silently nopa).
    delete: (key) => { instance.remove(key) },
  }
} catch {
  // Fallback AsyncStorage com cache em memória write-through.
  // Hydration roda async no boot; reads sync antes disso retornam undefined.
  const memory = new Map<string, string>()
  type AsyncStorageLike = {
    getItem: (k: string) => Promise<string | null>
    setItem: (k: string, v: string) => Promise<void>
    removeItem: (k: string) => Promise<void>
    getAllKeys?: () => Promise<readonly string[]>
  }
  let asyncStorageBackend: AsyncStorageLike | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const asMod = require('@react-native-async-storage/async-storage') as { default?: AsyncStorageLike }
    asyncStorageBackend = asMod?.default ?? null
  } catch {
    asyncStorageBackend = null
  }

  if (asyncStorageBackend) {
    const as: AsyncStorageLike = asyncStorageBackend
    storageHydrationPromise = (async () => {
      try {
        const allKeys = (await as.getAllKeys?.()) ?? []
        for (const key of allKeys) {
          try {
            const value = await as.getItem(key)
            if (value != null) memory.set(key, value)
          } catch {
            // chave individual falhou: ignora.
          }
        }
      } catch {
        // hydration falhou completa: segue com cache vazio.
      }
    })()
    backend = {
      get: (key) => memory.get(key),
      set: (key, value) => {
        memory.set(key, value)
        void as.setItem(key, value).catch(() => {})
      },
      delete: (key) => {
        memory.delete(key)
        void as.removeItem(key).catch(() => {})
      },
    }
  } else {
    // Last resort: nem MMKV nem AsyncStorage. Sessão vira volátil.
    backend = {
      get: (key) => memory.get(key),
      set: (key, value) => memory.set(key, value),
      delete: (key) => memory.delete(key),
    }
  }
}

// Chaves estáveis usadas pelo app. Mantemos uma lista explícita pra não
// depender de getAllKeys (que tem perf ruim em AsyncStorage com muitas keys)
// e pra evitar copiar lixo de versões antigas.
const KNOWN_KEYS: ReadonlyArray<string> = [
  'atlas.store.v1',
  'atlas.health.dataRepairVersion',
  'atlas.screentime.v1',
  'atlas.healthkit.enabled',
  'atlas.healthkit.lastSyncAt',
  'atlas.healthkit.lastError',
  'atlas.healthkit.lastSignalCount',
  'atlas.healthkit.debugTrail',
  'atlas.healthkit.historyBackfilled.v1',
  'atlas.healthkit.historyBackfilledAt',
  'atlas.healthkit.backgroundConfiguredAt',
  'atlas-api.host',
  'atlas-api.port',
  'atlas-api.token',
  'atlas-mobile.deviceToken',
  'atlas-mobile.deviceId',
  'atlas-ai.telemetry-outbox.v1',
  'atlas-ai.pending-submission',
  'atlas-ai.routing',
  'atlas-memory.review-filters.v1',
  'atlas-theme.mode',
]

const PREFIX_KEYS: ReadonlyArray<string> = ['atlas-ai.pinned-traces.']
const MIGRATION_FLAG = 'atlas.migrated.from-async-storage.v1'

let migrationPromise: Promise<void> | null = null

/**
 * Copia chaves do AsyncStorage legado para o MMKV uma única vez. Sem isso,
 * usuários existentes perderiam host/port/device pairing/theme/etc no
 * primeiro update, porque o MMKV nasce vazio.
 *
 * É idempotente (controlado por flag em MMKV) e tolerante a falha — se o
 * AsyncStorage não estiver disponível ou der erro, segue com MMKV vazio.
 */
export function ensureMigrationFromAsyncStorage(): Promise<void> {
  if (migrationPromise) return migrationPromise
  migrationPromise = (async () => {
    try {
      if (backend.get(MIGRATION_FLAG) === '1') return
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('@react-native-async-storage/async-storage') as { default?: { getItem: (k: string) => Promise<string | null>; getAllKeys?: () => Promise<readonly string[]> } }
      const AsyncStorage = mod?.default
      if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function') {
        backend.set(MIGRATION_FLAG, '1')
        return
      }

      const candidates = new Set<string>(KNOWN_KEYS)
      try {
        const allKeys = (await AsyncStorage.getAllKeys?.()) ?? []
        for (const key of allKeys) {
          if (PREFIX_KEYS.some((prefix) => key.startsWith(prefix))) candidates.add(key)
        }
      } catch {
        // getAllKeys falhou: seguimos só com KNOWN_KEYS.
      }

      for (const key of candidates) {
        if (backend.get(key) !== undefined) continue
        try {
          const value = await AsyncStorage.getItem(key)
          if (value != null) backend.set(key, value)
        } catch {
          // chave individual falhou: ignora e segue.
        }
      }
      backend.set(MIGRATION_FLAG, '1')
    } catch {
      // Migration é best-effort. Se nada disso roda, nada quebra — apenas
      // o usuário começa "do zero" no MMKV.
    }
  })()
  return migrationPromise
}

// Dispara migration imediatamente no module load (fire-and-forget). Code
// paths críticos (hydrateApiConfig) também aguardam explicitamente via
// ensureMigrationFromAsyncStorage() pra ter garantia.
void ensureMigrationFromAsyncStorage()

export const atlasStorage = {
  getItemSync(key: string): string | null {
    const value = backend.get(key)
    return value === undefined ? null : value
  },
  setItemSync(key: string, value: string): void {
    backend.set(key, value)
  },
  removeItemSync(key: string): void {
    backend.delete(key)
  },
  async getItem(key: string): Promise<string | null> {
    await storageHydrationPromise
    const value = backend.get(key)
    return value === undefined ? null : value
  },
  async setItem(key: string, value: string): Promise<void> {
    await storageHydrationPromise
    backend.set(key, value)
  },
  async removeItem(key: string): Promise<void> {
    await storageHydrationPromise
    backend.delete(key)
  },
  async multiSet(pairs: ReadonlyArray<[string, string]>): Promise<void> {
    await storageHydrationPromise
    for (const [key, value] of pairs) backend.set(key, value)
  },
  async multiGet(keys: ReadonlyArray<string>): Promise<Array<[string, string | null]>> {
    await storageHydrationPromise
    return keys.map((key) => {
      const value = backend.get(key)
      return [key, value === undefined ? null : value] as [string, string | null]
    })
  },
  async multiRemove(keys: ReadonlyArray<string>): Promise<void> {
    await storageHydrationPromise
    for (const key of keys) backend.delete(key)
  },
}
