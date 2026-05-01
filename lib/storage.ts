/**
 * Atlas storage — MMKV-first wrapper com API compatível com AsyncStorage.
 *
 * MMKV é síncrono, memory-mapped e baseado em JSI: 10–30× mais rápido que
 * AsyncStorage para blobs grandes (atlas.store.v1 chega na casa dos MB).
 * Mantemos a API async para que callers existentes não mudem assinatura,
 * mas a operação real é instantânea.
 *
 * Em ambiente sem JSI, o construtor lança — caímos num fallback em memória
 * que mantém o estado durante a sessão (suficiente pra dev/web).
 */

interface BackendStore {
  get(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
}

let backend: BackendStore

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mmkv = require('react-native-mmkv') as { createMMKV?: (config: { id: string }) => { getString(key: string): string | undefined; set(key: string, value: string): void; delete(key: string): void } }
  if (typeof mmkv.createMMKV !== 'function') throw new Error('createMMKV missing')
  const instance = mmkv.createMMKV({ id: 'atlas.v1' })
  backend = {
    get: (key) => instance.getString(key),
    set: (key, value) => instance.set(key, value),
    delete: (key) => instance.delete(key),
  }
} catch {
  const memory = new Map<string, string>()
  backend = {
    get: (key) => memory.get(key),
    set: (key, value) => memory.set(key, value),
    delete: (key) => memory.delete(key),
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
    const value = backend.get(key)
    return value === undefined ? null : value
  },
  async setItem(key: string, value: string): Promise<void> {
    backend.set(key, value)
  },
  async removeItem(key: string): Promise<void> {
    backend.delete(key)
  },
  async multiSet(pairs: ReadonlyArray<[string, string]>): Promise<void> {
    for (const [key, value] of pairs) backend.set(key, value)
  },
  async multiGet(keys: ReadonlyArray<string>): Promise<Array<[string, string | null]>> {
    return keys.map((key) => {
      const value = backend.get(key)
      return [key, value === undefined ? null : value] as [string, string | null]
    })
  },
  async multiRemove(keys: ReadonlyArray<string>): Promise<void> {
    for (const key of keys) backend.delete(key)
  },
}
