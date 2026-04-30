import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import Constants from 'expo-constants'
import { SideSheet } from './SideSheet'
import { ScreenTimeSelectionSheet } from '../ScreenTimeSelectionSheet'
import { CreateDomainPanel } from '../domains/CreateDomainPanel'
import { Frau, Label, Mono, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'
import { domainColor } from '../../lib/domains'
import {
  type AiProvidersStatusResponse,
  type AtlasHealth,
  getApiConfig,
  getAiProvidersStatus,
  getHealth,
  hydrateApiConfig,
  listCaptures,
  setBackendHost,
  setBackendPort,
  setBackendToken,
} from '../../lib/api/client'
import { formatRelativeSync, localQueueCounts, useAtlasStore } from '../../lib/atlasStore'
import {
  SCREEN_TIME_BUCKETS,
  type ScreenTimeLocalStatus,
} from '../../lib/screenTime'

export function SettingsSheet() {
  const open = useOverlays((s) => s.open)
  const close = useOverlays((s) => s.close)
  const visible = open === 'settings'
  const { c, mode, setMode } = useTheme()
  const sync = useAtlasStore((s) => s.sync)
  const syncing = useAtlasStore((s) => s.syncing)
  const requestHealthKitPermissions = useAtlasStore((s) => s.requestHealthKitPermissions)
  const syncScreenTime = useAtlasStore((s) => s.syncScreenTime)
  const configureScreenTime = useAtlasStore((s) => s.configureScreenTime)
  const requestScreenTimePermissions = useAtlasStore((s) => s.requestScreenTimePermissions)
  const serverReachable = useAtlasStore((s) => s.serverReachable)
  const lastSyncAt = useAtlasStore((s) => s.lastSyncAt)
  const lastError = useAtlasStore((s) => s.lastError)
  const healthKit = useAtlasStore((s) => s.healthKit)
  const domains = useAtlasStore((s) => s.domains)
  const healthKitSyncing = useAtlasStore((s) => s.healthKitSyncing)
  const screenTime = useAtlasStore((s) => s.screenTime)
  const screenTimeSyncing = useAtlasStore((s) => s.screenTimeSyncing)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures.length)
  const queuedCheckins = useAtlasStore((s) => s.queuedCheckins.length)
  const queuedBehaviors = useAtlasStore((s) => s.queuedBehaviors.length)
  const queuedBehaviorLogs = useAtlasStore((s) => s.queuedBehaviorLogs.length)
  const queuedSignals = useAtlasStore((s) => s.queuedPassiveSignals.length)
  const queuedSnapshots = useAtlasStore((s) => s.queuedHealthSnapshots.length)
  const queuedDigitalSessions = useAtlasStore((s) => s.queuedDigitalSessions.length)
  const queuedDigitalSnapshots = useAtlasStore((s) => s.queuedDigitalActivitySnapshots.length)
  const queueLastError = useAtlasStore((s) => firstQueueError([
    ...s.queuedCaptures.map((item) => item.last_error),
    ...s.queuedCheckins.map((item) => item.last_error),
    ...s.queuedBehaviors.map((item) => item.last_error),
    ...s.queuedBehaviorLogs.map((item) => item.last_error),
    ...s.queuedPassiveSignals.map((item) => item.last_error),
    ...s.queuedHealthSnapshots.map((item) => item.last_error),
    ...s.queuedDigitalSessions.map((item) => item.last_error),
    ...s.queuedDigitalActivitySnapshots.map((item) => item.last_error),
  ]))
  const healthSignals = useAtlasStore((s) => (
    s.passiveSignals.filter((signal) => signal.source === 'healthkit').length
    + s.queuedPassiveSignals.filter((signal) => signal.source === 'healthkit').length
  ))
  const screenTimeSignals = useAtlasStore((s) => (
    s.digitalSessions.filter((session) => session.source === 'screentime').length
    + s.queuedDigitalSessions.filter((session) => session.source === 'screentime').length
  ))

  const [hostDraft, setHostDraft] = useState('')
  const [portDraft, setPortDraft] = useState('')
  const [tokenDraft, setTokenDraft] = useState('')
  const [apiStatus, setApiStatus] = useState<string | null>(null)
  const [apiConfigLoaded, setApiConfigLoaded] = useState(false)
  const [testing, setTesting] = useState(false)
  const [serverHealth, setServerHealth] = useState<AtlasHealth | null>(null)
  const [aiStatus, setAiStatus] = useState<AiProvidersStatusResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [screenTimeSelectionBucket, setScreenTimeSelectionBucket] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return

    setApiConfigLoaded(false)
    void hydrateApiConfig().then(() => {
      const config = getApiConfig()
      setHostDraft(config.apiHost)
      setPortDraft(String(config.apiPort))
      setTokenDraft(config.apiToken)
      setApiConfigLoaded(true)
    })
  }, [visible])

  useEffect(() => {
    if (!visible || !apiConfigLoaded) return
    void getHealth()
      .then(setServerHealth)
      .catch(() => setServerHealth(null))
    void refreshAiStatus({ silent: true })
  }, [visible, apiConfigLoaded])

  const queue = queuedCaptures
    + queuedCheckins
    + queuedBehaviors
    + queuedBehaviorLogs
    + queuedSignals
    + queuedSnapshots
    + queuedDigitalSessions
    + queuedDigitalSnapshots
  const statusKind = apiStatus
    ? statusKindFromMessage(apiStatus)
    : (testing || syncing)
      ? 'pending'
    : connectionStatusKind({ serverReachable, lastError, queue })
  const statusDescription = apiStatus ?? connectionStatusDescription({
    serverReachable,
    lastError,
    queue,
    syncing,
    testing,
  })

  const saveApiConfig = async () => {
    const config = normalizeApiDrafts(hostDraft, portDraft, tokenDraft)
    await setBackendHost(config.host)
    await setBackendPort(config.port)
    await setBackendToken(config.token)
    setHostDraft(config.host)
    setPortDraft(String(config.port))
    setTokenDraft(config.token)
  }

  const testServer = async () => {
    setTesting(true)
    setApiStatus(null)

    try {
      await saveApiConfig()
      const health = await getHealth()
      setServerHealth(health)
      await listCaptures({ limit: 1 })
      await sync()
      setApiStatus(statusAfterSync(health.db_connected ? 'Servidor e token ok' : 'Servidor online · Postgres indisponível'))
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : 'Falha ao testar servidor')
    } finally {
      setTesting(false)
    }
  }

  const refreshAiStatus = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setAiLoading(true)
    setAiError(null)

    try {
      await saveApiConfig()
      const status = await getAiProvidersStatus()
      setAiStatus(status)
    } catch (error) {
      setAiError(humanAiError(error, 'Falha ao ler Atlas AI'))
    } finally {
      if (!silent) setAiLoading(false)
    }
  }

  return (
    <>
    <SideSheet visible={visible}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={close} style={({ pressed }) => [styles.slot, { opacity: pressed ? 0.65 : 1 }]}>
          <Sans weight="med" size={15} color={c.ink}>← Voltar</Sans>
        </Pressable>
        <Frau size={24} lineHeight={28} letterSpacing={-0.36} align="center" color={c.ink}>
          Configurações
        </Frau>
        <View style={styles.slot} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        <Section label="Aparência">
          <Row first name="Tema" desc="Dia, noite ou seguir o sistema">
            <Segmented
              value={mode}
              options={[
                { key: 'light', label: 'Dia' },
                { key: 'dark',  label: 'Noite' },
                { key: 'auto',  label: 'Auto' },
              ]}
              onChange={(k) => setMode(k as typeof mode)}
            />
          </Row>
        </Section>

        <Section label="Domínios">
          {domains.map((domain, index) => (
            <Row
              key={domain.key}
              first={index === 0}
              name={domain.label}
              desc={`${domain.key} · ${domainPrivacyLabel(domain.defaultSensitivity)}`}
            >
              <View style={[styles.domainDot, { backgroundColor: domainColor(domain.key, c, domains) }]} />
            </Row>
          ))}
          <View style={[styles.domainCreator, { borderTopColor: c.border }]}>
            <CreateDomainPanel />
          </View>
        </Section>

        <Section label="Servidor Atlas">
          <Row first name="Host" desc="Nome MagicDNS ou IP Tailscale do atlas-server">
            <ApiTextInput
              value={hostDraft}
              onChangeText={setHostDraft}
              placeholder="100.x.x.x"
            />
          </Row>
          <Row name="Porta" desc="Laravel Docker expõe 3737 no host">
            <ApiTextInput
              value={portDraft}
              onChangeText={setPortDraft}
              placeholder="3737"
              keyboardType="number-pad"
              narrow
            />
          </Row>
          <Row name="Token" desc="Header X-Atlas-Token">
            <ApiTextInput
              value={tokenDraft}
              onChangeText={setTokenDraft}
              placeholder="token"
              secureTextEntry
            />
          </Row>
          <Row name="Status" desc={statusDescription}>
            <StatusBadge status={statusKind} />
          </Row>
          <View style={styles.apiActions}>
            <MiniButton label={testing ? 'Testando…' : 'Testar conexão'} disabled={testing || syncing} onPress={testServer} />
            <MiniButton
              label={syncing ? 'Sincronizando…' : 'Sincronizar agora'}
              disabled={syncing || testing}
              onPress={() => {
                void syncNow(saveApiConfig, sync, setApiStatus)
              }}
            />
          </View>
        </Section>

        <Section label="Operação do servidor">
          <Row first name="PostgreSQL" desc={databaseHealthDescription(serverHealth)}>
            <StatusBadge status={databaseHealthStatus(serverHealth)} />
          </Row>
          <Row name="Storage Atlas" desc={storageHealthDescription(serverHealth)}>
            <StatusBadge status={storageHealthStatus(serverHealth)} />
          </Row>
          <Row name="Whisper" desc={transcriptionHealthDescription(serverHealth)}>
            <StatusBadge status={transcriptionHealthStatus(serverHealth)} />
          </Row>
          <Row name="Fila de transcrição" desc={transcriptionQueueDescription(serverHealth)}>
            <StatusBadge status={transcriptionQueueStatus(serverHealth)} />
          </Row>
          <Row name="Scheduler" desc={serverHealth?.checks?.scheduler?.note ?? 'Não verificado neste aparelho'}>
            <StatusBadge status={serverHealth ? 'pending' : 'offline'} />
          </Row>
        </Section>

        <Section label="Atlas AI">
          <Row first name="Gateway" desc={aiGatewayDescription(aiStatus, aiError)}>
            <StatusBadge status={aiGatewayStatus(aiStatus, aiError, aiLoading)} />
          </Row>
          <Row name="Claude CLI" desc={providerDescription(aiStatus, 'claude_cli')}>
            <StatusBadge status={providerStatus(aiStatus, 'claude_cli')} />
          </Row>
          <Row name="Codex CLI" desc={providerDescription(aiStatus, 'codex_cli')}>
            <StatusBadge status={providerStatus(aiStatus, 'codex_cli')} />
          </Row>
          <Row name="Último evento" desc={lastAiEventDescription(aiStatus)}>
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>
              {formatRelativeSync(aiStatus?.recent_events[0]?.occurred_at ?? null)}
            </Mono>
          </Row>
          <View style={styles.apiActions}>
            <MiniButton
              label={aiLoading ? 'Atualizando…' : 'Atualizar AI'}
              disabled={aiLoading}
              onPress={() => {
                void refreshAiStatus()
              }}
            />
          </View>
        </Section>

        <Section label="Saúde Apple">
          <Row first name="Permissões" desc={healthKitDescription(healthKit)}>
            <StatusBadge status={healthKit.available && healthKit.enabled ? 'online' : 'offline'} />
          </Row>
          <Row name="Última coleta" desc={`${healthSignals} sinais de saúde no Atlas`}>
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>{formatRelativeSync(healthKit.lastSyncAt)}</Mono>
          </Row>
          <Row name="Base inicial" desc={healthKit.historyBackfilled ? 'Coleta inicial concluída' : 'Coleta automática pendente'}>
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>
              {healthKit.historyBackfilled ? formatRelativeSync(healthKit.historyBackfilledAt) : 'pendente'}
            </Mono>
          </Row>
          <Row name="Coleta automática" desc="Primeiro plano, eventos do HealthKit e segundo plano">
            <Mono size={12} letterSpacing={0.48} color={healthKit.enabled ? c.moss : c.ink2}>
              {healthKit.enabled ? formatRelativeSync(healthKit.backgroundConfiguredAt) : 'inativa'}
            </Mono>
          </Row>
          {healthKit.lastError ? (
            <View style={styles.healthError}>
              <Sans size={12} lineHeight={17} color={c.recRed}>
                {healthKit.lastError}
              </Sans>
            </View>
          ) : null}
          {healthKit.debugTrail.length > 0 ? (
            <View style={styles.healthDebug}>
              {healthKit.debugTrail.slice(-3).map((line) => (
                <Mono key={line} size={9.5} letterSpacing={0.1} color={c.ink2}>
                  {line}
                </Mono>
              ))}
            </View>
          ) : null}
          <View style={styles.apiActions}>
            <MiniButton
              label={healthKitSyncing ? 'Atualizando…' : 'Permitir Saúde'}
              disabled={healthKitSyncing}
              onPress={() => {
                void requestHealthKitPermissions()
              }}
            />
          </View>
        </Section>

        <Section label="Produtividade iPhone">
          <Row first name="Estado" desc={screenTimeDescription(screenTime)}>
            <StatusBadge status={screenTimeStatusKind(screenTime, screenTimeSyncing)} />
          </Row>
          <Row name="Buckets cognitivos" desc={screenTime.nativeModuleAvailable ? 'Categorias nativas prontas para coleta' : 'Modulo iOS nativo ausente neste build'}>
            <Mono size={12} letterSpacing={0.48} color={screenTime.configuredBucketCount > 0 ? c.moss : c.ink2}>
              {screenTime.configuredBucketCount}/{SCREEN_TIME_BUCKETS.length}
            </Mono>
          </Row>
          <Row name="Última coleta" desc={`${screenTimeSignals} sessões do iPhone no Atlas`}>
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>
              {formatRelativeSync(screenTime.lastSyncAt)}
            </Mono>
          </Row>
          {screenTime.available && screenTime.lastError ? (
            <View style={styles.healthError}>
              <Sans size={12} lineHeight={17} color={c.recRed}>
                {screenTime.lastError}
              </Sans>
            </View>
          ) : null}
          {screenTime.debugTrail.length > 0 ? (
            <View style={styles.healthDebug}>
              {screenTime.debugTrail.slice(-3).map((line) => (
                <Mono key={line} size={9.5} letterSpacing={0.1} color={c.ink2}>
                  {line}
                </Mono>
              ))}
            </View>
          ) : null}
          <View style={styles.bucketGrid}>
            {SCREEN_TIME_BUCKETS.map((bucket) => (
              <Pressable
                key={bucket.id}
                disabled={!screenTime.enabled}
                onPress={() => setScreenTimeSelectionBucket(bucket.id)}
                style={({ pressed }) => [
                  styles.bucketChip,
                  {
                    borderColor: c.border,
                    backgroundColor: pressed ? c.surface : 'transparent',
                    opacity: screenTime.enabled ? 1 : 0.55,
                  },
                ]}
              >
                <Mono size={10} letterSpacing={0.34} color={c.prussian}>
                  {bucket.shortLabel}
                </Mono>
                <Sans size={11} lineHeight={14} color={c.ink2}>
                  {bucket.categoryLabel}
                </Sans>
              </Pressable>
            ))}
          </View>
          <View style={styles.apiActions}>
            <MiniButton
              label="Autorizar"
              disabled={!screenTime.nativeModuleAvailable || screenTimeSyncing}
              onPress={() => {
                void requestScreenTimePermissions()
              }}
            />
            <MiniButton
              label="Ativar coleta"
              disabled={!screenTime.enabled || screenTimeSyncing}
              onPress={() => {
                void configureScreenTime()
              }}
            />
            <MiniButton
              label="Coletar agora"
              disabled={!screenTime.enabled || screenTime.configuredBucketCount <= 0 || screenTimeSyncing}
              onPress={() => {
                void syncScreenTime()
              }}
            />
          </View>
        </Section>

        <Section label="Sync">
          <Row first name="Fila local" desc={queueDescription({ queuedCaptures, queuedCheckins, queuedBehaviors, queuedBehaviorLogs, queuedSignals, queuedSnapshots, queuedDigitalSessions, queuedDigitalSnapshots })}>
            <Mono size={12} letterSpacing={0.48} color={queue > 0 ? c.bronze : c.ink2}>{queue}</Mono>
          </Row>
          <Row name="Última sincronização" desc={lastSyncAt ? 'Servidor Laravel' : 'Ainda não sincronizado'}>
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>{formatRelativeSync(lastSyncAt)}</Mono>
          </Row>
          {queueLastError ? (
            <View style={styles.queueError}>
              <Sans size={12} lineHeight={17} color={c.recRed}>
                {queueLastError}
              </Sans>
            </View>
          ) : null}
        </Section>

        <Section label="Sobre">
          <Row first name="Versão" desc="Atlas 1.0">
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>
              {Constants.expoConfig?.version ?? '1.0.0'}
            </Mono>
          </Row>
        </Section>
      </ScrollView>
    </SideSheet>
    <ScreenTimeSelectionSheet
      visible={visible && screenTimeSelectionBucket !== null}
      bucketId={screenTimeSelectionBucket}
      onClose={() => {
        setScreenTimeSelectionBucket(null)
        if (screenTime.enabled) {
          void configureScreenTime()
        }
      }}
    />
    </>
  )
}

function normalizeApiDrafts(hostDraft: string, portDraft: string, tokenDraft: string) {
  const host = hostDraft.trim().replace(/\/+$/, '')
  const port = Number(portDraft)
  const token = tokenDraft.trim()

  if (!host) {
    throw new Error('Informe o host do atlas-server.')
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Informe uma porta válida.')
  }

  if (!token) {
    throw new Error('Informe o token do Atlas.')
  }

  return { host, port, token }
}

async function syncNow(
  saveApiConfig: () => Promise<void>,
  sync: () => Promise<void>,
  setApiStatus: (status: string | null) => void,
) {
  try {
    setApiStatus(null)
    await saveApiConfig()
    await sync()
    setApiStatus(statusAfterSync('Sincronização completa'))
  } catch (error) {
    setApiStatus(error instanceof Error ? error.message : 'Falha ao sincronizar')
  }
}

type ConnectionStatusKind = 'online' | 'pending' | 'offline'
type ProviderHealth = AiProvidersStatusResponse['providers'][number]
const PROVIDER_HEALTH_FRESH_MS = 10 * 60 * 1000
const AI_WORKER_FRESH_MS = 2 * 60 * 1000

function statusAfterSync(successMessage: string): string {
  const state = useAtlasStore.getState()
  const counts = localQueueCounts(state)

  if (!state.serverReachable) return state.lastError ?? 'Servidor não alcançado'
  if (state.lastError) return state.lastError
  if (counts.total > 0) {
    return `Servidor online · ${counts.total} ${counts.total === 1 ? 'item pendente' : 'itens pendentes'}`
  }

  return successMessage
}

function connectionStatusKind(input: {
  serverReachable: boolean
  lastError: string | null
  queue: number
}): ConnectionStatusKind {
  if (!input.serverReachable) return 'offline'
  if (input.lastError || input.queue > 0) return 'pending'
  return 'online'
}

function statusKindFromMessage(status: string): ConnectionStatusKind {
  const lower = status.toLowerCase()
  if (lower.includes('pendente') || lower.includes('fila') || lower.includes('postgres indisponível')) return 'pending'
  if (lower.includes('ok') || lower.includes('completa')) return 'online'
  return 'offline'
}

function connectionStatusDescription(input: {
  serverReachable: boolean
  lastError: string | null
  queue: number
  syncing: boolean
  testing: boolean
}): string {
  if (input.testing) return 'Testando servidor e token'
  if (input.syncing) return 'Sincronizando fila local'
  if (!input.serverReachable) return input.lastError ?? 'Servidor não verificado'
  if (input.lastError) return input.lastError
  if (input.queue > 0) {
    return `Servidor online · ${input.queue} ${input.queue === 1 ? 'item pendente' : 'itens pendentes'}`
  }

  return 'Conexão pronta'
}

function databaseHealthStatus(health: AtlasHealth | null): ConnectionStatusKind {
  if (!health) return 'offline'
  return health.db_connected ? 'online' : 'offline'
}

function databaseHealthDescription(health: AtlasHealth | null): string {
  if (!health) return 'Rode "Testar conexão" para carregar o health operacional'
  return health.db_connected ? 'Postgres conectado' : 'Servidor responde, mas Postgres falhou'
}

function storageHealthStatus(health: AtlasHealth | null): ConnectionStatusKind {
  if (!health) return 'offline'
  return health.checks?.storage?.writable ? 'online' : 'offline'
}

function storageHealthDescription(health: AtlasHealth | null): string {
  const storage = health?.checks?.storage
  if (!storage) return 'Storage ainda não verificado'
  if (storage.writable) return `Escrita ok · ${storage.path ?? 'disco atlas'}`
  return storage.error ? `Falha no storage · ${storage.error}` : 'Storage Atlas sem escrita'
}

function transcriptionHealthStatus(health: AtlasHealth | null): ConnectionStatusKind {
  const transcription = health?.checks?.transcription
  if (!transcription) return 'offline'
  if (!transcription.enabled) return 'pending'

  const ready = transcription.binary_exists
    && transcription.binary_executable
    && transcription.model_exists
    && transcription.ffmpeg_exists
    && transcription.ffmpeg_executable

  return ready ? 'online' : 'offline'
}

function transcriptionHealthDescription(health: AtlasHealth | null): string {
  const transcription = health?.checks?.transcription
  if (!transcription) return 'Whisper ainda não verificado'
  if (!transcription.enabled) return 'Transcrição desativada no servidor'

  const missing: string[] = []
  if (!transcription.binary_exists || !transcription.binary_executable) missing.push('whisper-cli')
  if (!transcription.model_exists) missing.push('modelo')
  if (!transcription.ffmpeg_exists || !transcription.ffmpeg_executable) missing.push('ffmpeg')

  if (missing.length === 0) {
    return `${transcription.engine ?? 'Whisper'} · ${transcription.language ?? 'auto'} · bin/model/ffmpeg ok`
  }

  return `Falta validar: ${missing.join(', ')}`
}

function transcriptionQueueStatus(health: AtlasHealth | null): ConnectionStatusKind {
  const jobs = health?.checks?.transcription_jobs
  if (!jobs) return 'offline'
  if (jobs.failed > 0) return 'pending'
  if (jobs.queued > 0 || jobs.processing > 0) return 'pending'
  return 'online'
}

function transcriptionQueueDescription(health: AtlasHealth | null): string {
  const jobs = health?.checks?.transcription_jobs
  const queue = health?.checks?.queue
  if (!jobs || !queue) return 'Fila ainda não verificada'
  return `${jobs.queued} aguardando · ${jobs.processing} processando · ${jobs.failed} falhas · ${queue.connection}/${queue.transcription_queue}`
}

function providerByKey(status: AiProvidersStatusResponse | null, provider: string): ProviderHealth | null {
  return status?.providers.find((item) => item.provider === provider) ?? null
}

function aiGatewayStatus(
  status: AiProvidersStatusResponse | null,
  error: string | null,
  loading: boolean,
): ConnectionStatusKind {
  if (loading) return 'pending'
  if (error) return 'offline'
  if (!status) return 'offline'

  const workerState = aiWorkerState(status)
  const hasQueue = status.queue.queued > 0 || status.queue.processing > 0
  if (hasQueue && workerState !== 'running') return 'offline'
  if (status.queue.failed > 0 || hasQueue) return 'pending'

  return 'online'
}

function aiGatewayDescription(status: AiProvidersStatusResponse | null, error: string | null): string {
  if (error) return error
  if (!status) return 'Status ainda não verificado'

  const total = status.queue.queued + status.queue.processing + status.queue.failed
  const workerState = aiWorkerState(status)
  if (status.queue.queued > 0 && workerState !== 'running') {
    return `Worker local parado · ${status.queue.queued} ${status.queue.queued === 1 ? 'item aguardando' : 'itens aguardando'}`
  }

  if (total === 0) {
    const hasFreshWorker = status.providers.some((provider) => providerHealthIsFresh(provider))
    if (workerState === 'running') return 'Worker local rodando; fila vazia'
    return hasFreshWorker
      ? 'Gateway responde; CLIs verificados, mas worker não está contínuo'
      : 'Gateway responde; health do worker local desatualizado'
  }

  if (workerState === 'running') {
    return `${status.queue.queued} na fila · ${status.queue.processing} processando · worker ativo`
  }

  return `${status.queue.queued} na fila · ${status.queue.processing} processando · ${status.queue.failed} falhas`
}

type AiWorkerState = 'running' | 'stopped' | 'stale' | 'unknown'

function aiWorkerState(status: AiProvidersStatusResponse): AiWorkerState {
  const workerEvent = status.recent_events.find((event) => event.event_type.startsWith('worker_'))
  if (!workerEvent) return 'unknown'
  if (workerEvent.event_type === 'worker_stopped') return 'stopped'

  const occurredAt = new Date(workerEvent.occurred_at).getTime()
  if (!Number.isFinite(occurredAt)) return 'unknown'
  return Date.now() - occurredAt <= AI_WORKER_FRESH_MS ? 'running' : 'stale'
}

function providerStatus(status: AiProvidersStatusResponse | null, providerKey: string): ConnectionStatusKind {
  const provider = providerByKey(status, providerKey)
  if (!provider) return 'offline'

  const recentEvent = recentProviderEvent(status, providerKey)
  const hasFreshSuccess = recentEvent?.event_type === 'job_succeeded' || recentEvent?.event_type === 'health_check'
  const hasFreshFailure = ['job_failed', 'timeout', 'auth_expired', 'rate_limited'].includes(recentEvent?.event_type ?? '')

  if (!providerHealthIsFresh(provider) && !hasFreshSuccess && !hasFreshFailure) return 'pending'
  if (hasFreshFailure) return recentEvent?.event_type === 'auth_expired' ? 'offline' : 'pending'
  if (provider.status === 'online' && provider.operational_pain_score === 0) return 'online'
  if (hasFreshSuccess) return 'online'
  if (provider.status === 'online' || provider.status === 'degraded') return 'pending'
  return 'offline'
}

function providerDescription(status: AiProvidersStatusResponse | null, providerKey: string): string {
  const provider = providerByKey(status, providerKey)
  if (!provider) return 'Sem health check registrado'

  const message = provider.message ? ` · ${provider.message}` : ''
  const recentEvent = recentProviderEvent(status, providerKey)
  if (recentEvent?.event_type === 'job_succeeded') {
    return `Último job ok · ${formatRelativeSync(recentEvent.occurred_at)}${message}`
  }
  if (recentEvent && ['job_failed', 'timeout', 'auth_expired', 'rate_limited'].includes(recentEvent.event_type)) {
    return `${recentEvent.message} · ${formatRelativeSync(recentEvent.occurred_at)}${message}`
  }

  if (!providerHealthIsFresh(provider)) {
    return `Health check desatualizado · ${formatRelativeSync(provider.checked_at)}${message}`
  }

  return `${providerPainLabel(provider.operational_pain_score)} · ${formatRelativeSync(provider.checked_at)}${message}`
}

function recentProviderEvent(status: AiProvidersStatusResponse | null, provider: string) {
  const event = status?.recent_events.find((item) => item.provider === provider)
  if (!event) return null

  const occurredAt = new Date(event.occurred_at).getTime()
  if (!Number.isFinite(occurredAt)) return null
  return Date.now() - occurredAt <= PROVIDER_HEALTH_FRESH_MS ? event : null
}

function providerHealthIsFresh(provider: ProviderHealth): boolean {
  const checkedAt = new Date(provider.checked_at).getTime()
  if (!Number.isFinite(checkedAt)) return false

  return Date.now() - checkedAt <= PROVIDER_HEALTH_FRESH_MS
}

function providerPainLabel(score: number): string {
  if (score <= 0) return 'Sem dor operacional'
  if (score === 1) return 'Dor operacional leve'
  if (score === 2) return 'Dor operacional moderada'
  if (score === 3) return 'Dor operacional alta'
  return 'Dor operacional crítica'
}

function lastAiEventDescription(status: AiProvidersStatusResponse | null): string {
  const event = status?.recent_events[0]
  if (!event) return 'Nenhum evento do worker registrado'

  return `${event.event_type} · ${event.message}`
}

function queueDescription(counts: {
  queuedCaptures: number
  queuedCheckins: number
  queuedBehaviors: number
  queuedBehaviorLogs: number
  queuedSignals: number
  queuedSnapshots: number
  queuedDigitalSessions: number
  queuedDigitalSnapshots: number
}): string {
  return `${counts.queuedCaptures} capturas · ${counts.queuedCheckins} check-ins · ${counts.queuedBehaviors} comportamentos · ${counts.queuedBehaviorLogs} logs · ${counts.queuedSignals} sinais · ${counts.queuedSnapshots} saúde · ${counts.queuedDigitalSessions} sessões digitais · ${counts.queuedDigitalSnapshots} snapshots digitais`
}

function firstQueueError(errors: Array<string | null | undefined>): string | null {
  return errors.find((error) => Boolean(error?.trim()))?.trim() ?? null
}

function humanAiError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback
  if (message.includes('route ai/') || message.includes('rota ai/')) {
    return 'Atlas AI não está carregado no servidor. Rebuild/restart o atlas-server.'
  }

  return message
}

function healthKitDescription(healthKit: {
  available: boolean
  enabled: boolean
  requestedTypeCount: number
  debugTrail: string[]
  historyBackfilled: boolean
  historyBackfilledAt: string | null
  backgroundConfiguredAt: string | null
}): string {
  if (!healthKit.available) return 'HealthKit indisponível neste aparelho'
  if (!healthKit.enabled) return `${healthKit.requestedTypeCount || 0} tipos de leitura aguardando permissão`
  return `${healthKit.requestedTypeCount || 0} tipos de leitura solicitados`
}

function screenTimeStatusKind(
  screenTime: ScreenTimeLocalStatus,
  syncing: boolean,
): ConnectionStatusKind {
  if (syncing) return 'pending'
  if (!screenTime.available || !screenTime.enabled) return 'offline'
  if (screenTime.lastError || screenTime.configuredBucketCount <= 0) return 'pending'
  return 'online'
}

function screenTimeDescription(screenTime: ScreenTimeLocalStatus): string {
  if (!screenTime.nativeModuleAvailable) {
    return screenTime.lastError ?? 'Modulo iOS nativo ausente neste build'
  }
  if (screenTime.entitlementRequired) {
    return 'Family Controls/DeviceActivity exige entitlement aprovado no build iOS'
  }
  if (!screenTime.available) {
    return screenTime.lastError ?? 'Rastreamento nativo pausado; Sensor 4 segue via Rize/backend'
  }
  if (!screenTime.enabled) {
    return 'Autorize o Tempo de Uso para medir buckets cognitivos'
  }
  if (screenTime.configuredBucketCount <= 0) {
    return 'Permissão ok; falta selecionar os buckets'
  }
  return `${screenTime.configuredBucketCount} buckets ativos · dados selecionados pelo operador`
}

function domainPrivacyLabel(value?: string | null): string {
  if (value === 'sensitive') return 'sensível'
  if (value === 'private') return 'privado'
  return 'normal'
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const { c } = useTheme()
  return (
    <View>
      <View style={styles.sectionHead}>
        <Label color={c.ink2}>{label}</Label>
      </View>
      <View style={[styles.sectionBody, { borderTopColor: c.border, borderBottomColor: c.border }]}>
        {children}
      </View>
    </View>
  )
}

function Row({
  name,
  desc,
  children,
  first,
}: {
  name: string
  desc?: string
  children: React.ReactNode
  first?: boolean
}) {
  const { c } = useTheme()
  return (
    <View
      style={[
        styles.row,
        !first && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={styles.rowMain}>
        <Sans weight="med" size={17} letterSpacing={-0.09} color={c.ink}>
          {name}
        </Sans>
        {desc && (
          <Sans size={13} lineHeight={18} color={c.ink2}>
            {desc}
          </Sans>
        )}
      </View>
      {children}
    </View>
  )
}

function ApiTextInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry,
  narrow,
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  keyboardType?: 'default' | 'number-pad'
  secureTextEntry?: boolean
  narrow?: boolean
}) {
  const { c } = useTheme()

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.ink3}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      selectionColor={c.prussian}
      style={[
        styles.apiInput,
        narrow && styles.apiInputNarrow,
        { color: c.ink, borderColor: c.border, backgroundColor: c.surface },
      ]}
    />
  )
}

function StatusBadge({ status }: { status: ConnectionStatusKind }) {
  const { c } = useTheme()
  const isOnline = status === 'online'
  const color = isOnline ? c.moss : status === 'pending' ? c.bronze : c.recRed
  const label = isOnline ? 'ONLINE' : status === 'pending' ? 'SYNC' : 'OFFLINE'

  return (
    <View style={[styles.statusBadge, { borderColor: color }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Mono size={11} letterSpacing={0.44} color={color}>
        {label}
      </Mono>
    </View>
  )
}

function MiniButton({
  label,
  disabled,
  onPress,
}: {
  label: string
  disabled?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniButton,
        {
          backgroundColor: pressed ? c.surface : 'transparent',
          borderColor: c.prussian,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <Sans weight="med" size={13} color={c.prussian} align="center">
        {label}
      </Sans>
    </Pressable>
  )
}

interface SegOption {
  key: string
  label: string
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string
  options: SegOption[]
  onChange: (k: string) => void
}) {
  const { c } = useTheme()
  return (
    <View style={[segStyles.track, { backgroundColor: c.surface, borderColor: c.border }]}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              segStyles.btn,
              on && {
                backgroundColor: c.bg,
                shadowColor: '#1C1916',
                shadowOpacity: 0.06,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
              },
            ]}
          >
            <Sans weight="med" size={13} color={on ? c.ink : c.ink2}>
              {o.label}
            </Sans>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  slot: { flex: 1 },
  sectionHead: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 6 },
  sectionBody: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  row: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowMain: { flex: 1, minWidth: 0 },
  apiInput: {
    width: 168,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
  },
  apiInputNarrow: {
    width: 82,
    textAlign: 'center',
  },
  apiActions: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    gap: 8,
  },
  domainDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  domainCreator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  healthError: {
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  healthDebug: {
    paddingHorizontal: 22,
    paddingTop: 8,
    gap: 4,
  },
  bucketGrid: {
    paddingHorizontal: 22,
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bucketChip: {
    width: '48%',
    minHeight: 58,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  queueError: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
  },
  miniButton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statusBadge: {
    minWidth: 88,
    minHeight: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
})

const segStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 0,
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
})
