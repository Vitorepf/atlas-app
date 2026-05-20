import { useEffect, useRef, useState } from 'react'
import { Alert, InteractionManager, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import Constants from 'expo-constants'
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio'
import { SideSheet } from './SideSheet'
import { ScreenTimeSelectionSheet } from '../ScreenTimeSelectionSheet'
import { CreateDomainPanel } from '../domains/CreateDomainPanel'
import { Frau, Label, Mono, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useShell } from '../AtlasShell'
import { useOverlays } from '../../lib/overlays'
import { domainColor } from '../../lib/domains'
import {
  type AiProvidersStatusResponse,
  type AtlasAiFlowProfile,
  type AtlasAiFlowProfilePatch,
  type AtlasAiPolicyPreviewResponse,
  type AtlasAiPolicyProfilesResponse,
  type AtlasMacStatusResponse,
  type AtlasAiActiveJob,
  type AtlasAiJob,
  type AtlasAiStatus,
  type AtlasHealth,
  bootstrapMobileMacAgent,
  cancelAiJob,
  cleanupMobileMacCaffeinate,
  createMobileMacMaintenanceWindow,
  deleteMobileMacMaintenanceWindow,
  getApiConfig,
  getAiProvidersStatus,
  getAiPolicyProfiles,
  getHealth,
  getMobileMacStatus,
  hydrateApiConfig,
  listAiJobs,
  listCaptures,
  previewAiPolicy,
  requestMobileMacSleepNow,
  setBackendHost,
  setBackendPort,
  setBackendToken,
  startMobileMacRemoteSession,
  stopMobileMacRemoteSession,
  updateAiFlowProfile,
  updateAiProviderSettings,
} from '../../lib/api/client'
import { copyToClipboard } from '../../lib/clipboard'
import { formatRelativeSync, localQueueCounts, useAtlasStore } from '../../lib/atlasStore'
import {
  SCREEN_TIME_BUCKETS,
  type ScreenTimeLocalStatus,
} from '../../lib/screenTime'
import { nowMs, recordPerformanceDuration } from '../../lib/performanceTelemetry'

type VoicePermission = Awaited<ReturnType<typeof getRecordingPermissionsAsync>>

export function SettingsSheet() {
  const open = useOverlays((s) => s.open)
  const close = useOverlays((s) => s.close)
  const openAtlasAi = useOverlays((s) => s.openAtlasAi)
  const visible = open === 'settings'
  const { c, mode, setMode } = useTheme()
  const { showToast } = useShell()
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
  const [aiPolicyProfiles, setAiPolicyProfiles] = useState<AtlasAiPolicyProfilesResponse | null>(null)
  const [aiPolicyPreview, setAiPolicyPreview] = useState<AtlasAiPolicyPreviewResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiPolicySaving, setAiPolicySaving] = useState(false)
  const [aiPolicyPreviewLoading, setAiPolicyPreviewLoading] = useState(false)
  const [selectedAiFlowId, setSelectedAiFlowId] = useState('programming.dev')
  const [aiError, setAiError] = useState<string | null>(null)
  const [activeAiJobs, setActiveAiJobs] = useState<AtlasAiJob[]>([])
  const [activeJobsLoading, setActiveJobsLoading] = useState(false)
  const [activeJobAction, setActiveJobAction] = useState<string | null>(null)
  const [aiSessionsPanelOpen, setAiSessionsPanelOpen] = useState(false)
  const [macStatus, setMacStatus] = useState<AtlasMacStatusResponse | null>(null)
  const [macLoading, setMacLoading] = useState(false)
  const [macAction, setMacAction] = useState<string | null>(null)
  const [macError, setMacError] = useState<string | null>(null)
  const [screenTimeSelectionBucket, setScreenTimeSelectionBucket] = useState<string | null>(null)
  const [apiAutoSave, setApiAutoSave] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [voicePermission, setVoicePermission] = useState<VoicePermission | null>(null)
  const [voicePermissionBusy, setVoicePermissionBusy] = useState(false)
  const [settingsWarmupReady, setSettingsWarmupReady] = useState(false)
  const settingsOpenedAtRef = useRef<number | null>(null)
  const settingsMetricRecordedRef = useRef(false)
  const apiDraftsRef = useRef({ hostDraft: '', portDraft: '', tokenDraft: '' })
  apiDraftsRef.current = { hostDraft, portDraft, tokenDraft }
  const apiBaselineRef = useRef<{ host: string; port: string; token: string } | null>(null)

  useEffect(() => {
    if (visible) {
      settingsOpenedAtRef.current = nowMs()
      settingsMetricRecordedRef.current = false
      return
    }
    setSettingsWarmupReady(false)
    setAiSessionsPanelOpen(false)
    settingsOpenedAtRef.current = null
    settingsMetricRecordedRef.current = false
  }, [visible])

  useEffect(() => {
    if (!visible) return

    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    const task = InteractionManager.runAfterInteractions(() => {
      timeout = setTimeout(() => {
        if (!cancelled) {
          setSettingsWarmupReady(true)
          if (!settingsMetricRecordedRef.current && settingsOpenedAtRef.current != null) {
            settingsMetricRecordedRef.current = true
            recordPerformanceDuration('settings_open_ms', settingsOpenedAtRef.current, {
              api_config_loaded: apiConfigLoaded,
            })
          }
        }
      }, 500)
    })

    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
      task.cancel()
    }
  }, [apiConfigLoaded, visible])

  useEffect(() => {
    if (!visible) return

    setApiConfigLoaded(false)
    setApiAutoSave('idle')
    apiBaselineRef.current = null
    void hydrateApiConfig().then(() => {
      const config = getApiConfig()
      const portStr = String(config.apiPort)
      setHostDraft(config.apiHost)
      setPortDraft(portStr)
      setTokenDraft(config.apiToken)
      apiBaselineRef.current = { host: config.apiHost, port: portStr, token: config.apiToken }
      setApiConfigLoaded(true)
    })
  }, [visible])

  useEffect(() => {
    if (!apiConfigLoaded) return
    const baseline = apiBaselineRef.current
    if (!baseline) return
    if (hostDraft === baseline.host && portDraft === baseline.port && tokenDraft === baseline.token) return

    setApiAutoSave('saving')
    const handle = setTimeout(() => {
      void persistApiDrafts(hostDraft, portDraft, tokenDraft).then((wrote) => {
        if (wrote) {
          apiBaselineRef.current = { host: hostDraft, port: portDraft, token: tokenDraft }
          setApiAutoSave('saved')
        } else {
          setApiAutoSave('idle')
        }
      })
    }, 500)

    return () => clearTimeout(handle)
  }, [apiConfigLoaded, hostDraft, portDraft, tokenDraft])

  useEffect(() => {
    if (visible) return
    const baseline = apiBaselineRef.current
    if (!baseline) return
    const { hostDraft: h, portDraft: p, tokenDraft: t } = apiDraftsRef.current
    if (h === baseline.host && p === baseline.port && t === baseline.token) return
    void persistApiDrafts(h, p, t)
  }, [visible])

  useEffect(() => {
    if (!visible || !apiConfigLoaded || !settingsWarmupReady) return
    void getHealth()
      .then(setServerHealth)
      .catch(() => setServerHealth(null))
    void refreshVoicePermission({ silent: true })
    void refreshAiStatus({ silent: true })
    void refreshMacStatus({ silent: true })
  }, [visible, apiConfigLoaded, settingsWarmupReady])

  useEffect(() => {
    if (!visible || !apiConfigLoaded || !settingsWarmupReady) return
    const interval = setInterval(() => {
      void refreshAiStatus({ silent: true })
      void refreshMacStatus({ silent: true })
    }, 10000)

    return () => clearInterval(interval)
  }, [apiConfigLoaded, settingsWarmupReady, visible])

  useEffect(() => {
    const flows = aiPolicyProfiles?.profile_registry.flows ?? []
    if (flows.length === 0 || flows.some((flow) => flow.id === selectedAiFlowId)) return

    setSelectedAiFlowId(flows.find((flow) => flow.id === 'programming.dev')?.id ?? flows[0].id)
  }, [aiPolicyProfiles, selectedAiFlowId])

  useEffect(() => {
    if (!visible || !apiConfigLoaded || !settingsWarmupReady || !selectedAiFlowId) return
    void refreshSelectedAiPolicyPreview({ silent: true })
  }, [visible, apiConfigLoaded, settingsWarmupReady, selectedAiFlowId, aiPolicyProfiles?.profile_registry.source])

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
  const selectedAiFlow = aiPolicyProfiles?.profile_registry.flows.find((flow) => flow.id === selectedAiFlowId) ?? null
  const canEditAiProfiles = aiPolicyProfiles?.profile_registry.source === 'database'

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
    const showActiveJobsLoading = !silent || activeAiJobs.length === 0
    if (!silent) {
      setAiLoading(true)
    }
    if (showActiveJobsLoading) {
      setActiveJobsLoading(true)
    }
    setAiError(null)

    try {
      await saveApiConfig()
      let statusError: unknown = null
      let jobsError: unknown = null
      let profilesError: unknown = null
      const [status, activeJobs, policyProfiles] = await Promise.all([
        getAiProvidersStatus().catch((error) => {
          statusError = error
          return null
        }),
        listActiveAiRuntimeJobs().catch((error) => {
          jobsError = error
          return null
        }),
        getAiPolicyProfiles().catch((error) => {
          profilesError = error
          return null
        }),
      ])
      if (status) {
        setAiStatus(status)
      }
      if (policyProfiles) {
        setAiPolicyProfiles(policyProfiles)
      }
      setActiveAiJobs(activeJobs ?? [])
      if (statusError || jobsError || profilesError) {
        setAiError(humanAiError(jobsError ?? statusError ?? profilesError, 'Falha ao ler Atlas'))
      }
    } catch (error) {
      setActiveAiJobs([])
      setAiError(humanAiError(error, 'Falha ao ler Atlas'))
    } finally {
      if (!silent) {
        setAiLoading(false)
      }
      if (showActiveJobsLoading) {
        setActiveJobsLoading(false)
      }
    }
  }

  const saveAiRuntimeSettings = async (patch: Parameters<typeof updateAiProviderSettings>[0]) => {
    setAiSaving(true)
    setAiError(null)

    try {
      await saveApiConfig()
      const status = await updateAiProviderSettings(patch)
      setAiStatus(status)
    } catch (error) {
      setAiError(humanAiError(error, 'Falha ao salvar Atlas'))
    } finally {
      setAiSaving(false)
    }
  }

  const saveSelectedAiFlowPolicy = async (patch: AtlasAiFlowProfilePatch) => {
    if (!selectedAiFlow) return
    setAiPolicySaving(true)
    setAiError(null)

    try {
      await saveApiConfig()
      const response = await updateAiFlowProfile(selectedAiFlow.id, patch)
      setAiPolicyProfiles({
        generated_at: new Date().toISOString(),
        profile_registry: response.profile_registry,
      })
      setAiPolicyPreview({
        generated_at: new Date().toISOString(),
        profile: {
          profile_id: response.flow_profile.id,
          domain: response.flow_profile.domain_id,
          flow: response.flow_profile.id,
        },
        effective_policy: response.effective_policy ?? {},
        policy_merge_receipt: {},
        legacy_policy: {},
      })
      showToast('Política do fluxo salva')
    } catch (error) {
      const message = humanAiError(error, 'Falha ao salvar política AI')
      setAiError(message)
      showToast(message)
    } finally {
      setAiPolicySaving(false)
    }
  }

  const refreshSelectedAiPolicyPreview = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!selectedAiFlowId) return
    if (!silent) setAiPolicyPreviewLoading(true)
    setAiError(null)

    try {
      await saveApiConfig()
      const preview = await previewAiPolicy({
        profile_id: selectedAiFlowId,
        surface: 'app',
      })
      setAiPolicyPreview(preview)
    } catch (error) {
      const message = humanAiError(error, 'Falha ao pré-visualizar política AI')
      setAiError(message)
      if (!silent) showToast(message)
    } finally {
      if (!silent) setAiPolicyPreviewLoading(false)
    }
  }

  const refreshMacStatus = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setMacLoading(true)
    setMacError(null)

    try {
      await saveApiConfig()
      setMacStatus(await getMobileMacStatus())
    } catch (error) {
      setMacError(humanAiError(error, 'Falha ao ler Mac Agent'))
    } finally {
      if (!silent) setMacLoading(false)
    }
  }

  const refreshVoicePermission = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      const permission = await getRecordingPermissionsAsync()
      setVoicePermission(permission)
      if (!silent) {
        showToast(permission.granted ? 'microfone liberado' : 'microfone ainda sem permissão')
      }
    } catch (error) {
      setVoicePermission(null)
      if (!silent) {
        showToast(error instanceof Error ? error.message : 'não foi possível verificar o microfone')
      }
    }
  }

  const requestVoicePermission = async () => {
    if (voicePermissionBusy) return
    setVoicePermissionBusy(true)

    try {
      const permission = await requestRecordingPermissionsAsync()
      setVoicePermission(permission)
      showToast(permission.granted ? 'voz liberada para o Atlas AI' : 'microfone não liberado')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'não foi possível pedir permissão de voz')
    } finally {
      setVoicePermissionBusy(false)
    }
  }

  const startRemoteMode = async (durationMinutes: number) => {
    setMacAction(`remote-${durationMinutes}`)
    setMacError(null)

    try {
      await saveApiConfig()
      const response = await startMobileMacRemoteSession({
        duration_minutes: durationMinutes,
        reason: `Modo remoto mobile ${Math.round(durationMinutes / 60)}h`,
      })
      setMacStatus(response.status)
      showToast('Modo remoto ativo')
    } catch (error) {
      const message = humanAiError(error, 'Falha ao ativar modo remoto')
      setMacError(message)
      showToast(message)
    } finally {
      setMacAction(null)
    }
  }

  const stopRemoteMode = async () => {
    const session = macStatus?.active_sessions.find((item) => item.kind === 'remote_manual' && item.status === 'active')
    if (!session) {
      showToast('Nenhuma sessão remota ativa')
      return
    }

    setMacAction('stop-remote')
    setMacError(null)

    try {
      await saveApiConfig()
      const response = await stopMobileMacRemoteSession(session.id)
      setMacStatus(response.status)
      showToast('Modo remoto encerrado')
    } catch (error) {
      const message = humanAiError(error, 'Falha ao encerrar modo remoto')
      setMacError(message)
      showToast(message)
    } finally {
      setMacAction(null)
    }
  }

  const confirmSleepNow = () => {
    Alert.alert(
      'Permitir repouso agora?',
      'O Atlas vai liberar sessões de vigília e pedir repouso ao macOS se não houver job ativo.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Permitir repouso',
          style: 'destructive',
          onPress: () => {
            void sleepNow()
          },
        },
      ],
    )
  }

  const sleepNow = async () => {
    setMacAction('sleep-now')
    setMacError(null)

    try {
      await saveApiConfig()
      const response = await requestMobileMacSleepNow()
      setMacStatus(response.status)
      showToast(response.ok ? 'Repouso liberado' : 'Repouso bloqueado por execução ativa')
    } catch (error) {
      const message = humanAiError(error, 'Falha ao liberar repouso')
      setMacError(message)
      showToast(message)
    } finally {
      setMacAction(null)
    }
  }

  const cleanupCaffeinate = async () => {
    setMacAction('cleanup-caffeinate')
    setMacError(null)

    try {
      await saveApiConfig()
      const response = await cleanupMobileMacCaffeinate()
      setMacStatus(response.status)
      showToast(
        response.cleanup.queued_for_host
          ? 'Limpeza enviada para o Mac Agent'
          : response.cleanup.removed > 0
          ? `${response.cleanup.removed} retenção órfã limpa`
          : 'Nenhuma retenção órfã encontrada',
      )
    } catch (error) {
      const message = humanAiError(error, 'Falha ao limpar caffeinate')
      setMacError(message)
      showToast(message)
    } finally {
      setMacAction(null)
    }
  }

  const bootstrapMacAgent = async () => {
    setMacAction('bootstrap')
    setMacError(null)

    try {
      await saveApiConfig()
      const response = await bootstrapMobileMacAgent({
        wake_time: '02:00',
        duration_minutes: 120,
        timezone: 'America/Sao_Paulo',
      })
      setMacStatus(response.status)
      showToast(response.complete ? 'Mac pronto para jobs de madrugada' : 'Mac preparado; helper root ainda pendente')
    } catch (error) {
      const message = humanAiError(error, 'Falha ao preparar Mac')
      setMacError(message)
      showToast(message)
    } finally {
      setMacAction(null)
    }
  }

  const createDefaultMaintenanceWindow = async () => {
    setMacAction('create-maintenance')
    setMacError(null)

    try {
      await saveApiConfig()
      await createMobileMacMaintenanceWindow({
        name: 'Janela Atlas',
        wake_time: '02:00',
        duration_minutes: 120,
        enabled: true,
      })
      await refreshMacStatus({ silent: true })
      showToast('Janela de manutenção criada')
    } catch (error) {
      const message = humanAiError(error, 'Falha ao criar manutenção')
      setMacError(message)
      showToast(message)
    } finally {
      setMacAction(null)
    }
  }

  const deleteFirstMaintenanceWindow = async () => {
    const windowId = macStatus?.maintenance_windows?.[0]?.id
    if (!windowId) {
      showToast('Nenhuma janela cadastrada')
      return
    }

    setMacAction('delete-maintenance')
    setMacError(null)

    try {
      await saveApiConfig()
      await deleteMobileMacMaintenanceWindow(windowId)
      await refreshMacStatus({ silent: true })
      showToast('Janela de manutenção removida')
    } catch (error) {
      const message = humanAiError(error, 'Falha ao remover manutenção')
      setMacError(message)
      showToast(message)
    } finally {
      setMacAction(null)
    }
  }

  const refreshAiSessionsPanel = async ({ silent = false }: { silent?: boolean } = {}) => {
    await refreshAiStatus({ silent })
  }

  const openAiSessionsPanel = () => {
    setAiSessionsPanelOpen(true)
    void refreshAiSessionsPanel()
  }

  const openActiveAiJob = (job: AtlasAiJob) => {
    const threadId = job.trace?.thread_id
    if (!threadId) {
      showToast('Execução sem conversa vinculada')
      return
    }

    openAtlasAi(threadId)
  }

  const cancelActiveAiJob = async (job: AtlasAiJob) => {
    setActiveJobAction(job.id)
    setAiError(null)

    try {
      await saveApiConfig()
      await cancelAiJob(job.id)
      setActiveAiJobs((current) => current.filter((item) => item.id !== job.id))
      await refreshAiStatus({ silent: true })
      showToast('Execução cancelada')
    } catch (error) {
      const message = humanAiError(error, 'Falha ao cancelar execução')
      setAiError(message)
      showToast(message)
    } finally {
      setActiveJobAction(null)
    }
  }

  const confirmCancelActiveAiJob = (job: AtlasAiJob) => {
    Alert.alert(
      'Cancelar execução?',
      activeAiJobTitle(job, aiStatus),
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar execução',
          style: 'destructive',
          onPress: () => {
            void cancelActiveAiJob(job)
          },
        },
      ],
    )
  }

  return (
    <>
    <SideSheet visible={visible}>
      {visible ? (
      <>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable
          onPress={aiSessionsPanelOpen ? () => setAiSessionsPanelOpen(false) : close}
          style={({ pressed }) => [styles.slot, { opacity: pressed ? 0.65 : 1 }]}
        >
          <Sans weight="med" size={15} color={c.ink}>
            {aiSessionsPanelOpen ? '← Ajustes' : '← Voltar'}
          </Sans>
        </Pressable>
        <Frau size={24} lineHeight={28} letterSpacing={-0.36} align="center" color={c.ink}>
          {aiSessionsPanelOpen ? 'Sessões AI' : 'Configurações'}
        </Frau>
        <View style={styles.slot} />
      </View>

      {aiSessionsPanelOpen ? (
        <AiSessionsDashboard
          jobs={activeAiJobs}
          status={aiStatus}
          jobsLoading={activeJobsLoading}
          busyJobId={activeJobAction}
          onRefresh={() => {
            void refreshAiSessionsPanel()
          }}
          onOpenJob={openActiveAiJob}
          onCancelJob={confirmCancelActiveAiJob}
        />
      ) : (
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
            <SecretApiInput
              value={tokenDraft}
              onChangeText={setTokenDraft}
              placeholder="token"
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
            <ApiAutoSaveBadge state={apiAutoSave} />
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

        <Section label="Mac Agent">
          <Row first name="Estado do Mac" desc={macStatusDescription(macStatus, macError, macLoading)}>
            <StatusBadge status={macConnectionStatus(macStatus, macError, macLoading)} />
          </Row>
          <Row name="Prontidão" desc={macReadinessDescription(macStatus)}>
            <StatusBadge status={macReadinessStatus(macStatus)} />
          </Row>
          <Row name="Próxima ação" desc={macNextActionDescription(macStatus)}>
            <StatusBadge status={macNextActionStatus(macStatus)} />
          </Row>
          <Row name="Supervisor" desc={macAgentSupervisorDescription(macStatus)}>
            <StatusBadge status={macAgentSupervisorStatus(macStatus)} />
          </Row>
          <Row name="Modo remoto" desc={remoteModeDescription(macStatus)}>
            <Mono size={12} letterSpacing={0.48} color={remoteModeActive(macStatus) ? c.bronze : c.ink2}>
              {remoteModeActive(macStatus) ? 'ativo' : 'idle'}
            </Mono>
          </Row>
          <Row name="Energia" desc={macPowerDescription(macStatus)}>
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>
              {macBatteryValue(macStatus)}
            </Mono>
          </Row>
          <Row name="Manutenção" desc={maintenanceDescription(macStatus)}>
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>
              {String(macStatus?.maintenance_windows?.length ?? 0)}
            </Mono>
          </Row>
          <Row name="Power helper" desc={powerHelperDescription(macStatus)}>
            <StatusBadge status={powerHelperStatus(macStatus)} />
          </Row>
          <Row name="Caffeinate" desc={caffeinateRuntimeDescription(macStatus)}>
            <StatusBadge status={caffeinateRuntimeStatus(macStatus)} />
          </Row>
          <Row name="Wake macOS" desc={wakeScheduleDescription(macStatus)}>
            <StatusBadge status={wakeScheduleStatus(macStatus)} />
          </Row>
          <View style={styles.apiActions}>
            <MiniButton
              label={macAction === 'remote-60' ? 'Ativando…' : 'Remoto 1h'}
              disabled={Boolean(macAction)}
              onPress={() => {
                void startRemoteMode(60)
              }}
            />
            <MiniButton
              label={macAction === 'remote-240' ? 'Ativando…' : 'Remoto 4h'}
              disabled={Boolean(macAction)}
              onPress={() => {
                void startRemoteMode(240)
              }}
            />
            <MiniButton
              label={macAction === 'remote-720' ? 'Ativando…' : 'Remoto 12h'}
              disabled={Boolean(macAction)}
              onPress={() => {
                void startRemoteMode(720)
              }}
            />
          </View>
          <View style={styles.apiActions}>
            <MiniButton
              label={macAction === 'stop-remote' ? 'Encerrando…' : 'Encerrar remoto'}
              disabled={Boolean(macAction) || !remoteModeActive(macStatus)}
              onPress={stopRemoteMode}
            />
            <MiniButton
              label={macAction === 'sleep-now' ? 'Liberando…' : 'Permitir repouso'}
              disabled={Boolean(macAction)}
              onPress={confirmSleepNow}
            />
            <MiniButton
              label={macAction === 'bootstrap' ? 'Preparando…' : 'Preparar Mac'}
              disabled={Boolean(macAction)}
              onPress={bootstrapMacAgent}
            />
            <MiniButton
              label={macLoading ? 'Atualizando…' : 'Atualizar Mac'}
              disabled={macLoading || Boolean(macAction)}
              onPress={() => {
                void refreshMacStatus()
              }}
            />
            <MiniButton
              label={macAction === 'cleanup-caffeinate' ? 'Limpando…' : 'Limpar órfãs'}
              disabled={Boolean(macAction) || !(macStatus?.caffeinate_runtime?.orphan_count)}
              onPress={cleanupCaffeinate}
            />
          </View>
          <View style={styles.apiActions}>
            <MiniButton
              label={macAction === 'create-maintenance' ? 'Criando…' : 'Criar 02:00'}
              disabled={Boolean(macAction)}
              onPress={createDefaultMaintenanceWindow}
            />
            <MiniButton
              label={macAction === 'delete-maintenance' ? 'Removendo…' : 'Remover janela'}
              disabled={Boolean(macAction) || !(macStatus?.maintenance_windows?.length)}
              onPress={deleteFirstMaintenanceWindow}
            />
          </View>
        </Section>

        <Section label="Atlas">
          <Row first name="Gateway" desc={aiGatewayDescription(aiStatus, aiError)}>
            <StatusBadge status={aiGatewayStatus(aiStatus, aiError, aiLoading)} />
          </Row>
          <Row name="Perfis AI" desc={aiPolicyProfilesDescription(aiPolicyProfiles)}>
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>
              {aiPolicyProfiles?.profile_registry.source ?? '-'}
            </Mono>
          </Row>
          <Row name="Provider padrão" desc={defaultProviderDescription(aiStatus)}>
            <Mono
              size={12}
              letterSpacing={0.48}
              color={(aiStatus?.default_provider ?? 'claude_cli') === 'claude_cli' ? c.moss : c.bronze}
            >
              {providerLabel(aiStatus?.default_provider ?? 'claude_cli')}
            </Mono>
          </Row>
          <Row name="Modelo padrão" desc={defaultModelDescription(aiStatus)}>
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>
              {defaultModelValue(aiStatus)}
            </Mono>
          </Row>
          <Row name="Default AI" desc={runtimeSettingsDescription(aiStatus)}>
            <Segmented
              value={
                (aiStatus?.default_provider ?? 'claude_cli') === 'codex_cli'
                  ? 'codex_cli'
                  : (aiStatus?.default_provider ?? 'claude_cli') === 'gemini_cli'
                    ? 'gemini_cli'
                    : 'claude_cli'
              }
              options={[
                { key: 'claude_cli', label: 'Claude' },
                { key: 'codex_cli', label: 'Codex' },
                { key: 'gemini_cli', label: 'Gemini' },
              ]}
              onChange={(provider) => {
                void saveAiRuntimeSettings({ default_provider: provider })
              }}
            />
          </Row>
          <Row name="Modelo Claude" desc={providerModelDescription(aiStatus, 'claude_cli')}>
            <Segmented
              value={providerModelChoice(aiStatus, 'claude_cli')}
              options={providerModelOptions('claude_cli')}
              onChange={(choice) => {
                void saveAiRuntimeSettings({ providers: { claude_cli: modelPatchForChoice('claude_cli', choice) } })
              }}
            />
          </Row>
          <Row name="Modelo Codex" desc={providerModelDescription(aiStatus, 'codex_cli')}>
            <Segmented
              value={providerModelChoice(aiStatus, 'codex_cli')}
              options={providerModelOptions('codex_cli')}
              onChange={(choice) => {
                void saveAiRuntimeSettings({ providers: { codex_cli: modelPatchForChoice('codex_cli', choice) } })
              }}
            />
          </Row>
          <Row name="Modelo Gemini" desc={providerModelDescription(aiStatus, 'gemini_cli')}>
            <Segmented
              value={providerModelChoice(aiStatus, 'gemini_cli')}
              options={providerModelOptions('gemini_cli')}
              onChange={(choice) => {
                void saveAiRuntimeSettings({ providers: { gemini_cli: modelPatchForChoice('gemini_cli', choice) } })
              }}
            />
          </Row>
          <Row name="Codex automático" desc={providerAutomationDescription(aiStatus, 'codex_cli')}>
            <Segmented
              value={modelPolicyByProvider(aiStatus, 'codex_cli')?.allow_auto ? 'on' : 'off'}
              options={[
                { key: 'off', label: 'OFF' },
                { key: 'on', label: 'ON' },
              ]}
              onChange={(value) => {
                void saveAiRuntimeSettings({ providers: { codex_cli: { allow_auto: value === 'on' } } })
              }}
            />
          </Row>
          <Row name="Gemini automático" desc={providerAutomationDescription(aiStatus, 'gemini_cli')}>
            <Segmented
              value={modelPolicyByProvider(aiStatus, 'gemini_cli')?.allow_auto ? 'on' : 'off'}
              options={[
                { key: 'off', label: 'OFF' },
                { key: 'on', label: 'ON' },
              ]}
              onChange={(value) => {
                void saveAiRuntimeSettings({ providers: { gemini_cli: { allow_auto: value === 'on' } } })
              }}
            />
          </Row>
          <Row name="Budget AI" desc={aiBudgetDescription(aiStatus)}>
            <Segmented
              value={aiStatus?.budget?.enabled ? 'on' : 'off'}
              options={[
                { key: 'off', label: 'OFF' },
                { key: 'on', label: 'ON' },
              ]}
              onChange={(value) => {
                void saveAiRuntimeSettings({ budget: { enabled: value === 'on', mode: 'block', window_hours: 24 } })
              }}
            />
          </Row>
          <Row name="Limite Claude" desc={providerBudgetDescription(aiStatus, 'claude_cli')}>
            <Segmented
              value={providerBudgetChoice(aiStatus, 'claude_cli')}
              options={budgetPresetOptions()}
              onChange={(value) => {
                void saveAiRuntimeSettings({ budget: { providers: { claude_cli: { max_visible_tokens: budgetValueForChoice(value) } } } })
              }}
            />
          </Row>
          <Row name="Limite Codex" desc={providerBudgetDescription(aiStatus, 'codex_cli')}>
            <Segmented
              value={providerBudgetChoice(aiStatus, 'codex_cli')}
              options={budgetPresetOptions()}
              onChange={(value) => {
                void saveAiRuntimeSettings({ budget: { providers: { codex_cli: { max_visible_tokens: budgetValueForChoice(value) } } } })
              }}
            />
          </Row>
          <Row name="Limite Gemini" desc={providerBudgetDescription(aiStatus, 'gemini_cli')}>
            <Segmented
              value={providerBudgetChoice(aiStatus, 'gemini_cli')}
              options={budgetPresetOptions()}
              onChange={(value) => {
                void saveAiRuntimeSettings({ budget: { providers: { gemini_cli: { max_visible_tokens: budgetValueForChoice(value) } } } })
              }}
            />
          </Row>
          <Row name="Worker Claude" desc={providerWorkerDescription(aiStatus, 'claude_cli')}>
            <StatusBadge status={providerWorkerStatus(aiStatus, 'claude_cli')} />
          </Row>
          <Row name="Worker Codex" desc={providerWorkerDescription(aiStatus, 'codex_cli')}>
            <StatusBadge status={providerWorkerStatus(aiStatus, 'codex_cli')} />
          </Row>
          <Row name="Worker Gemini" desc={providerWorkerDescription(aiStatus, 'gemini_cli')}>
            <StatusBadge status={providerWorkerStatus(aiStatus, 'gemini_cli')} />
          </Row>
          <Row name="Fila AI" desc={aiQueueDescription(aiStatus)}>
            <Mono size={12} letterSpacing={0.48} color={aiQueueHasWork(aiStatus) ? c.bronze : c.ink2}>
              {aiQueueValue(aiStatus)}
            </Mono>
          </Row>
          <Row name="Execução AI" desc={activeAiJobDescription(aiStatus)}>
            <Mono size={12} letterSpacing={0.48} color={activeAiJobValue(aiStatus) === 'nada' ? c.ink2 : c.bronze}>
              {activeAiJobValue(aiStatus)}
            </Mono>
          </Row>
          <Row name="Uso Claude 24h" desc={providerUsageDescription(aiStatus, 'claude_cli')}>
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>
              {providerUsageValue(aiStatus, 'claude_cli')}
            </Mono>
          </Row>
          <Row name="Uso Codex 24h" desc={providerUsageDescription(aiStatus, 'codex_cli')}>
            <Mono size={12} letterSpacing={0.48} color={providerUsageHasActivity(aiStatus, 'codex_cli') ? c.bronze : c.ink2}>
              {providerUsageValue(aiStatus, 'codex_cli')}
            </Mono>
          </Row>
          <Row name="Uso Gemini 24h" desc={providerUsageDescription(aiStatus, 'gemini_cli')}>
            <Mono size={12} letterSpacing={0.48} color={providerUsageHasActivity(aiStatus, 'gemini_cli') ? c.bronze : c.ink2}>
              {providerUsageValue(aiStatus, 'gemini_cli')}
            </Mono>
          </Row>
          <Row name="Claude CLI" desc={providerDescription(aiStatus, 'claude_cli')}>
            <StatusBadge status={providerStatus(aiStatus, 'claude_cli')} />
          </Row>
          <Row name="Codex CLI" desc={providerDescription(aiStatus, 'codex_cli')}>
            <StatusBadge status={providerStatus(aiStatus, 'codex_cli')} />
          </Row>
          <Row name="Gemini CLI" desc={providerDescription(aiStatus, 'gemini_cli')}>
            <StatusBadge status={providerStatus(aiStatus, 'gemini_cli')} />
          </Row>
          <Row name="Último evento" desc={lastAiEventDescription(aiStatus)}>
            <Mono size={12} letterSpacing={0.48} color={c.ink2}>
              {formatRelativeSync(aiStatus?.recent_events[0]?.occurred_at ?? null)}
            </Mono>
          </Row>
          <View style={styles.apiActions}>
            <MiniButton
              label={aiLoading || aiSaving ? 'Atualizando…' : 'Atualizar AI'}
              disabled={aiLoading || aiSaving}
              onPress={() => {
                void refreshAiStatus()
              }}
            />
          </View>
        </Section>

        <Section label="Políticas AI">
          <Row first name="Fluxo" desc={selectedAiFlowDescription(aiPolicyProfiles, selectedAiFlow)}>
            <Mono size={12} letterSpacing={0.48} color={canEditAiProfiles ? c.moss : c.bronze}>
              {selectedAiFlow?.id ?? '-'}
            </Mono>
          </Row>
          <PolicyFlowPicker
            profiles={aiPolicyProfiles}
            selectedFlowId={selectedAiFlowId}
            onSelect={setSelectedAiFlowId}
          />
          <Row name="Preview efetivo" desc={effectivePolicyPreviewDescription(aiPolicyPreview, aiPolicyPreviewLoading)}>
            <Mono size={12} letterSpacing={0.48} color={effectivePolicyPreviewReady(aiPolicyPreview) ? c.moss : c.ink2}>
              {effectivePolicyPreviewReady(aiPolicyPreview) ? 'pronto' : '-'}
            </Mono>
          </Row>
          <EffectivePolicyPreviewPanel preview={aiPolicyPreview} loading={aiPolicyPreviewLoading} />
          <Row name="Executor" desc={flowExecutorDescription(selectedAiFlow, canEditAiProfiles)}>
            <Segmented
              value={flowExecutorPreference(selectedAiFlow)}
              disabled={!canEditAiProfiles || aiPolicySaving || !selectedAiFlow}
              options={[
                { key: 'simple_provider_execution', label: 'Direto' },
                { key: 'dev_repair_executor', label: 'Repair' },
                { key: 'engineering_harness', label: 'Harness' },
              ]}
              onChange={(executor) => {
                void saveSelectedAiFlowPolicy({ execution_policy: { executor_preference: executor } })
              }}
            />
          </Row>
          <Row name="Autonomia" desc={flowAutonomyDescription(selectedAiFlow)}>
            <Segmented
              value={selectedAiFlow?.autonomy ?? 'medium'}
              disabled={!canEditAiProfiles || aiPolicySaving || !selectedAiFlow}
              options={[
                { key: 'low', label: 'Baixa' },
                { key: 'medium', label: 'Média' },
                { key: 'high', label: 'Alta' },
              ]}
              onChange={(autonomy) => {
                void saveSelectedAiFlowPolicy({ autonomy })
              }}
            />
          </Row>
          <Row name="Aprovação" desc={flowApprovalDescription(selectedAiFlow)}>
            <Segmented
              value={selectedAiFlow?.requires_human_approval_for_destructive === false ? 'off' : 'on'}
              disabled={!canEditAiProfiles || aiPolicySaving || !selectedAiFlow}
              options={[
                { key: 'on', label: 'ON' },
                { key: 'off', label: 'OFF' },
              ]}
              onChange={(value) => {
                void saveSelectedAiFlowPolicy({ requires_human_approval_for_destructive: value === 'on' })
              }}
            />
          </Row>
          <Row name="Background" desc={flowBackgroundDescription(selectedAiFlow)}>
            <Segmented
              value={selectedAiFlow?.background_allowed ? 'on' : 'off'}
              disabled={!canEditAiProfiles || aiPolicySaving || !selectedAiFlow}
              options={[
                { key: 'off', label: 'OFF' },
                { key: 'on', label: 'ON' },
              ]}
              onChange={(value) => {
                void saveSelectedAiFlowPolicy({ background_allowed: value === 'on' })
              }}
            />
          </Row>
          <Row name="Gate mínimo" desc={flowGatePolicyDescription(selectedAiFlow)}>
            <Segmented
              value={flowGateMinimum(selectedAiFlow)}
              disabled={!canEditAiProfiles || aiPolicySaving || !selectedAiFlow}
              options={[
                { key: 'standard', label: 'Padrão' },
                { key: 'strict', label: 'Rigor' },
                { key: 'release', label: 'Release' },
              ]}
              onChange={(minimum) => {
                void saveSelectedAiFlowPolicy({ gate_policy: { minimum_gate: minimum } })
              }}
            />
          </Row>
          <Row name="Modelo do fluxo" desc={flowModelPolicyDescription(selectedAiFlow)}>
            <Segmented
              value={flowModelPolicyPreset(selectedAiFlow)}
              disabled={!canEditAiProfiles || aiPolicySaving || !selectedAiFlow}
              options={[
                { key: 'balanced', label: 'Balanço' },
                { key: 'quality', label: 'Qualidade' },
                { key: 'cost_guarded', label: 'Custo' },
              ]}
              onChange={(preset) => {
                void saveSelectedAiFlowPolicy({ model_policy: modelPolicyPatchForPreset(preset) })
              }}
            />
          </Row>
          <Row name="Contexto" desc={flowContextPolicyDescription(selectedAiFlow)}>
            <Segmented
              value={flowContextPolicyPreset(selectedAiFlow)}
              disabled={!canEditAiProfiles || aiPolicySaving || !selectedAiFlow}
              options={[
                { key: 'light', label: 'Leve' },
                { key: 'focused', label: 'Foco' },
                { key: 'deep', label: 'Profundo' },
              ]}
              onChange={(preset) => {
                void saveSelectedAiFlowPolicy({ context_policy: contextPolicyPatchForPreset(preset) })
              }}
            />
          </Row>
          <Row name="Memória" desc={flowMemoryPolicyDescription(selectedAiFlow)}>
            <Segmented
              value={flowMemoryPolicyPreset(selectedAiFlow)}
              disabled={!canEditAiProfiles || aiPolicySaving || !selectedAiFlow}
              options={[
                { key: 'thread', label: 'Thread' },
                { key: 'project', label: 'Projeto' },
                { key: 'deep', label: 'Profunda' },
              ]}
              onChange={(preset) => {
                void saveSelectedAiFlowPolicy({ memory_policy: memoryPolicyPatchForPreset(preset) })
              }}
            />
          </Row>
          <Row name="Skills" desc={flowSkillPolicyDescription(selectedAiFlow)}>
            <Segmented
              value={flowSkillPolicyPreset(selectedAiFlow)}
              disabled={!canEditAiProfiles || aiPolicySaving || !selectedAiFlow}
              options={[
                { key: 'minimal', label: 'Mínima' },
                { key: 'domain', label: 'Domínio' },
                { key: 'council', label: 'Conselho' },
              ]}
              onChange={(preset) => {
                void saveSelectedAiFlowPolicy({ skill_policy: skillPolicyPatchForPreset(preset) })
              }}
            />
          </Row>
          <Row name="Ferramentas" desc={flowToolPolicyDescription(selectedAiFlow)}>
            <Segmented
              value={flowToolPolicyPreset(selectedAiFlow)}
              disabled={!canEditAiProfiles || aiPolicySaving || !selectedAiFlow}
              options={[
                { key: 'read_only', label: 'Leitura' },
                { key: 'workspace_write', label: 'Workspace' },
                { key: 'harness', label: 'Harness' },
              ]}
              onChange={(preset) => {
                void saveSelectedAiFlowPolicy({ tool_policy: toolPolicyPatchForPreset(preset) })
              }}
            />
          </Row>
          <View style={styles.apiActions}>
            <MiniButton
              label={aiPolicyPreviewLoading ? 'Calculando…' : 'Recalcular preview'}
              disabled={aiPolicyPreviewLoading || !selectedAiFlow}
              onPress={() => {
                void refreshSelectedAiPolicyPreview()
              }}
            />
          </View>
        </Section>

        <Section label="Sessões AI">
          <Row first name="Consumindo agora" desc={activeAiSessionsDescription(activeAiJobs, activeJobsLoading)}>
            <Mono size={12} letterSpacing={0.48} color={activeAiJobs.length > 0 ? c.bronze : c.ink2}>
              {activeJobsLoading ? '...' : String(activeAiJobs.length)}
            </Mono>
          </Row>
          <Row name="Painel de execuções" desc="Somente o que pode consumir token agora">
            <MiniButton
              label="Abrir painel"
              disabled={activeJobsLoading}
              onPress={openAiSessionsPanel}
            />
          </Row>
          <ActiveAiSessionsList
            jobs={activeAiJobs}
            status={aiStatus}
            loading={activeJobsLoading}
            busyJobId={activeJobAction}
            onOpen={openActiveAiJob}
            onCancel={confirmCancelActiveAiJob}
          />
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

        <Section label="Voz Atlas">
          <Row first name="Microfone" desc={voicePermissionDescription(voicePermission)}>
            <StatusBadge status={voicePermissionStatusKind(voicePermission, voicePermissionBusy)} />
          </Row>
          <Row name="Conversa em tempo real" desc="Atlas AI usa esta permissão para ouvir no modo de voz">
            <MiniButton
              label={voicePermissionBusy ? 'Abrindo…' : voicePermission?.granted ? 'Liberado' : 'Permitir Voz'}
              disabled={voicePermissionBusy || voicePermission?.granted === true}
              onPress={() => {
                void requestVoicePermission()
              }}
            />
          </Row>
          {voicePermission && !voicePermission.granted && voicePermission.canAskAgain === false ? (
            <View style={styles.healthError}>
              <Sans size={12} lineHeight={17} color={c.recRed}>
                Microfone bloqueado no iOS. Abra Ajustes do iPhone, encontre Atlas e habilite Microfone.
              </Sans>
            </View>
          ) : null}
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
      )}
      </>
      ) : null}
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

// Best-effort autosave: writes any field that has a valid value, skips
// blanks/invalid (so clearing one input doesn't wipe the persisted token).
// Throws nothing — used by the typing/closing autosave path.
async function persistApiDrafts(hostDraft: string, portDraft: string, tokenDraft: string): Promise<boolean> {
  const host = hostDraft.trim().replace(/\/+$/, '')
  const portN = Number(portDraft)
  const portValid = Number.isInteger(portN) && portN >= 1 && portN <= 65535
  const token = tokenDraft.trim()

  const writes: Promise<unknown>[] = []
  if (host) writes.push(setBackendHost(host))
  if (portValid) writes.push(setBackendPort(portN))
  if (token) writes.push(setBackendToken(token))

  if (writes.length === 0) return false
  try {
    await Promise.all(writes)
    return true
  } catch {
    return false
  }
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

async function listActiveAiRuntimeJobs(): Promise<AtlasAiJob[]> {
  const statuses: AtlasAiStatus[] = ['processing', 'queued', 'awaiting_user_choice']
  const responses = await Promise.all(statuses.map((status) => listAiJobs({ status, limit: 24 })))
  const byId = new Map<string, AtlasAiJob>()

  responses.forEach((response) => {
    response.jobs.forEach((job) => {
      byId.set(job.id, job)
    })
  })

  return [...byId.values()].sort((left, right) => {
    const statusDelta = activeStatusRank(left.status) - activeStatusRank(right.status)
    if (statusDelta !== 0) return statusDelta
    return activeJobTime(right) - activeJobTime(left)
  })
}

function activeStatusRank(status: string): number {
  if (status === 'processing') return 0
  if (status === 'awaiting_user_choice') return 1
  if (status === 'queued') return 2
  return 3
}

function activeJobTime(job: AtlasAiJob): number {
  const date = job.started_at ?? job.reserved_at ?? job.available_at ?? job.updated_at ?? job.created_at
  const value = date ? new Date(date).getTime() : 0
  return Number.isFinite(value) ? value : 0
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
  if (
    lower.includes('invalid or missing x-atlas-token')
    || lower.includes('unauthorized')
    || lower.includes('falha')
    || lower.includes('erro')
  ) return 'offline'
  if (lower.includes('pendente') || lower.includes('fila') || lower.includes('postgres indisponível')) return 'pending'
  if (/\bok\b/.test(lower) || lower.includes('completa')) return 'online'
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

function macConnectionStatus(
  status: AtlasMacStatusResponse | null,
  error: string | null,
  loading: boolean,
): ConnectionStatusKind {
  if (loading) return 'pending'
  if (error || !status) return 'offline'
  if (status.status === 'offline_or_sleeping' || status.status === 'not_installed') return 'offline'
  if (status.status === 'held_awake' || status.status === 'running_jobs') return 'pending'
  return 'online'
}

function macStatusDescription(
  status: AtlasMacStatusResponse | null,
  error: string | null,
  loading: boolean,
): string {
  if (loading) return 'Atualizando status do Mac Agent'
  if (error) return error
  if (!status) return 'Ainda não verificado neste aparelho'
  if (status.status === 'not_installed') return 'Tabelas do Mac Agent ainda não migradas'
  if (status.status === 'offline_or_sleeping') return 'Mac Agent offline, dormindo ou sem heartbeat recente'
  if (status.status === 'held_awake') return `${status.active_sessions.length} sessão ativa mantendo o Mac acordado`
  if (status.status === 'running_jobs') return 'Worker executando jobs no Mac'
  return 'Mac Agent online e sem retenção de energia'
}

function macReadinessStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  const readiness = status?.readiness
  if (!readiness) return 'offline'
  if (readiness.ready_for_background_jobs) return 'online'
  if (readiness.ready_for_remote) return 'pending'
  return 'offline'
}

function macReadinessDescription(status: AtlasMacStatusResponse | null): string {
  const readiness = status?.readiness
  if (!readiness) return 'Prontidão ainda não verificada'
  if (readiness.summary?.message) return readiness.summary.message
  if (readiness.ready_for_background_jobs) return 'Remoto, jobs e wake automático prontos'
  if (readiness.ready_for_remote) {
    const batteryBlocker = readiness.blockers.find((item) => item.code === 'battery_too_low_for_background_jobs')
    if (batteryBlocker) return batteryBlocker.message
    const blocker = readiness.blockers.find((item) => item.code === 'power_helper_not_ready' || item.code === 'atlas_wake_not_confirmed')
    return blocker?.message ?? 'Modo remoto pronto; wake automático pendente'
  }
  return readiness.blockers[0]?.message ?? 'Mac Agent bloqueado'
}

function macNextActionStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  const action = status?.readiness?.next_action
  if (!action) return 'offline'
  if (action.code === 'none') return 'online'
  if (action.severity === 'critical') return 'offline'
  return 'pending'
}

function macNextActionDescription(status: AtlasMacStatusResponse | null): string {
  const action = status?.readiness?.next_action
  if (!action) return 'Nenhuma ação calculada ainda'
  if (action.code === 'none') return action.message
  if (action.command) return `${action.message} · ${shortMacCommand(action.command)}`
  return action.message
}

function shortMacCommand(command: string): string {
  if (command.includes('install-power-helper-launch-daemon.sh')) return 'instalar Power Helper no Mac'
  if (command.includes('install-mac-agent-launch-agent.sh')) return 'instalar LaunchAgent'
  if (command.includes('cleanup-caffeinate')) return 'limpar retenções órfãs'
  if (command.includes('atlas:host doctor')) return 'rodar doctor'
  if (command.includes('atlas:host schedule-wake')) return 'programar wake'
  return command
}

function macAgentSupervisorStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  const supervisor = status?.mac_agent
  if (!supervisor) return 'offline'
  if (supervisor.ready) return 'online'
  if (supervisor.installed) return 'pending'
  return 'offline'
}

function macAgentSupervisorDescription(status: AtlasMacStatusResponse | null): string {
  const supervisor = status?.mac_agent
  if (!supervisor) return 'LaunchAgent ainda não verificado'
  if (supervisor.next_action?.code && supervisor.next_action.code !== 'ready') return supervisor.next_action.message
  if (supervisor.running && supervisor.pid) return `${supervisor.label} rodando · pid ${supervisor.pid}`
  if (supervisor.ready) return `${supervisor.label} carregado`
  if (supervisor.installed) return `${supervisor.label} instalado, mas não carregado`
  return 'Instale o LaunchAgent para manter o agente ativo'
}

function remoteModeActive(status: AtlasMacStatusResponse | null): boolean {
  return Boolean(status?.active_sessions.some((session) => session.kind === 'remote_manual' && session.status === 'active'))
}

function remoteModeDescription(status: AtlasMacStatusResponse | null): string {
  const session = status?.active_sessions.find((item) => item.kind === 'remote_manual' && item.status === 'active')
  if (!session) return 'Nenhum modo remoto segurando o Mac acordado'
  const caffeinate =
    session.caffeinate_alive === true
      ? 'caffeinate ok'
      : session.caffeinate_alive === false
        ? 'caffeinate reiniciando'
        : 'caffeinate não verificado'
  const expiry = session.expires_at ? `até ${formatRelativeSync(session.expires_at)}` : 'sem expiração registrada'
  return `Ativo ${expiry} · ${caffeinate}`
}

function macPowerDescription(status: AtlasMacStatusResponse | null): string {
  const host = status?.host
  if (!host) return 'Bateria e tomada ainda não verificadas'
  const power = host.on_ac_power === null ? 'fonte desconhecida' : host.on_ac_power ? 'na tomada' : 'na bateria'
  const sessions = host.active_power_sessions === 1 ? '1 sessão' : `${host.active_power_sessions} sessões`
  return `${power} · ${sessions} · ${host.active_ai_jobs} jobs ativos`
}

function macBatteryValue(status: AtlasMacStatusResponse | null): string {
  const battery = status?.host?.battery_percent
  if (battery === null || battery === undefined) return '-'
  return `${battery}%`
}

function maintenanceDescription(status: AtlasMacStatusResponse | null): string {
  const next = status?.maintenance_windows?.[0]
  if (!next) return 'Nenhuma janela cadastrada'
  if (next.metadata?.pmset_ok === false) return `${next.name} · wake pendente de helper root`
  return `${next.name} · ${next.wake_time} · ${next.duration_minutes}min`
}

function powerHelperStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  if (!status?.power_helper) return 'offline'
  if (status.power_helper.ready || (status.power_helper.installed && status.power_helper.last_success_fresh)) return 'online'
  if (status.power_helper.installed) return 'pending'
  return 'offline'
}

function powerHelperDescription(status: AtlasMacStatusResponse | null): string {
  const helper = status?.power_helper
  if (!helper) return 'Ainda não verificado'
  if (helper.next_action?.code && helper.next_action.code !== 'ready') return helper.next_action.message
  if (helper.installed && helper.last_success_fresh && helper.last_success_at) return `${helper.label} ok · ${formatRelativeSync(helper.last_success_at)}`
  if (helper.installed && helper.last_success_at) return `${helper.label} sem check recente · ${formatRelativeSync(helper.last_success_at)}`
  if (helper.installed && helper.running) return `${helper.label} rodando`
  if (helper.installed) return `${helper.label} instalado, sem check root recente`
  return 'Necessário para programar wake do macOS'
}

function caffeinateRuntimeStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  const runtime = status?.caffeinate_runtime
  if (!runtime?.available) return 'offline'
  if (runtime.orphan_count > 0) return 'pending'
  return 'online'
}

function caffeinateRuntimeDescription(status: AtlasMacStatusResponse | null): string {
  const runtime = status?.caffeinate_runtime
  if (!runtime) return 'Runtime de vigília ainda não verificado'
  if (!runtime.available) return 'caffeinate indisponível neste Mac'
  if (runtime.orphan_count > 0) return `${runtime.orphan_count} retenção órfã será limpa pelo agente`
  const active = runtime.active_labels.length === 1 ? '1 retenção ativa' : `${runtime.active_labels.length} retenções ativas`
  return `${active} · launchctl monitorado`
}

function wakeScheduleStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  if (!status?.wake_schedule?.available) return 'offline'
  if (status.wake_schedule.scheduled) return 'online'
  if ((status.maintenance_windows?.length ?? 0) > 0) return 'pending'
  return 'offline'
}

function wakeScheduleDescription(status: AtlasMacStatusResponse | null): string {
  const schedule = status?.wake_schedule
  if (!schedule?.available) return 'pmset schedule ainda não verificado'
  if (schedule.scheduled) return schedule.next_wake_at ? `Próximo wake ${formatRelativeSync(schedule.next_wake_at)}` : 'Wake programado no macOS'
  if (schedule.system_has_wakeorpoweron) return 'Existe wake do sistema, mas nenhum wake Atlas confirmado'
  if ((status?.maintenance_windows?.length ?? 0) > 0) return 'Janela cadastrada, mas wake ainda não programado'
  return 'Nenhum wake programado'
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

function providerLabel(provider: string | null | undefined): string {
  if (provider === 'claude_cli') return 'Claude CLI'
  if (provider === 'codex_cli') return 'Codex CLI'
  if (provider === 'gemini_cli') return 'Gemini CLI'
  if (provider === 'claude_codex') return 'Conselho'
  return provider ?? 'padrão'
}

function activeAiSessionsDescription(jobs: AtlasAiJob[], loading: boolean): string {
  if (loading && jobs.length === 0) return 'Verificando execuções que podem consumir'
  if (jobs.length === 0) return 'Nada consumindo agora'

  const processing = jobs.filter((job) => job.status === 'processing').length
  const queued = jobs.filter((job) => job.status === 'queued').length
  const choices = jobs.filter((job) => job.status === 'awaiting_user_choice').length
  const tokens = jobs.reduce((sum, job) => sum + estimateActiveJobTokens(job), 0)
  const parts = [
    processing > 0 ? `${processing} rodando` : null,
    queued > 0 ? `${queued} aguardando` : null,
    choices > 0 ? `${choices} pedindo escolha` : null,
    tokens > 0 ? `~${formatCompactNumber(tokens)} tokens estimados` : null,
  ].filter(Boolean)

  return parts.join(' · ') || `${jobs.length} execução ativa`
}

function activeAiJobTitle(job: AtlasAiJob, status: AiProvidersStatusResponse | null): string {
  const origin = activeAiJobOriginLabel(job)
  const resolvedProvider = activeAiJobProvider(job)
  const provider = providerLabel(resolvedProvider)
  const model = activeAiJobModelLabel(job, status)
  const runtime = model ? `${provider} · ${model}` : provider

  return `${origin} · ${runtime}`
}

function activeAiJobModelLabel(job: AtlasAiJob, status: AiProvidersStatusResponse | null): string {
  const metadata = objectRecord(job.metadata)
  const payload = objectRecord(job.payload)
  const traceMetadata = objectRecord(job.trace?.metadata)
  const explicit = firstText(
    metadata.model_label,
    payload.model_label,
    traceMetadata.model_label,
    job.model,
    job.trace?.model,
  )

  if (explicit) return explicit

  return providerModelLabel(status, activeAiJobProvider(job) ?? '', firstText(job.model, job.trace?.model))
}

function activeAiJobProvider(job: AtlasAiJob): string | null {
  return firstText(job.provider, job.trace?.provider)
}

function activeAiJobSubtitle(job: AtlasAiJob): string {
  const context = activeAiJobContextLabel(job)
  const elapsed = activeAiJobElapsed(job)
  const tokens = estimateActiveJobTokens(job)
  const metadata = objectRecord(job.metadata)
  const processPid = firstNumber(metadata.process_pid)
  const worker = job.worker_id ? ` · worker ${job.worker_id}` : ''
  const pid = processPid ? ` · pid ${processPid}` : ''
  const tokenText = tokens > 0 ? ` · ~${formatCompactNumber(tokens)} tokens` : ''

  return `${context} · ${elapsed}${tokenText}${pid}${worker}`
}

function activeAiJobOriginLabel(job: AtlasAiJob): string {
  const source = job.trace?.source_type
  const surface = activeAiJobSurface(job)
  const workflow = activeAiJobWorkflow(job)

  if (source === 'scheduled' || surface === 'atlas_cli_schedule' || workflow === 'scheduled') return 'Agendado'
  if (workflow === 'dev' && (surface === 'atlas_cli' || source === 'manual')) return 'Atlas dev CLI'
  if (workflow === 'dev' && (surface === 'atlas_ai_sheet' || source === 'app')) return 'Atlas dev app'
  if (workflow === 'dev') return 'Atlas dev'
  if (source === 'system' || surface === 'worker' || surface === 'server') return 'Sistema'
  if (surface === 'atlas_cli' || source === 'manual') return 'Terminal'
  if (surface === 'mobile' || surface === 'mobile_thread') return 'Mobile'
  if (surface === 'atlas_ai_sheet' || source === 'app') return 'App'

  return surface ? humanAiSurface(surface) : 'Atlas'
}

function activeAiJobContextLabel(job: AtlasAiJob): string {
  const thread = job.trace?.thread
  const session = job.trace?.session
  const surface = activeAiJobSurface(job)
  const workspace = firstText(thread?.workspace, job.client_id)
  const title = firstText(thread?.title)
  const parts = [
    surface ? humanAiSurface(surface) : activeAiJobOriginLabel(job),
    title && title !== surface ? title : null,
    workspace,
    session?.id ? `sessão ${shortId(session.id)}` : null,
  ].filter(Boolean)

  return parts.join(' · ') || 'Atlas'
}

function activeAiJobCanOpen(job: AtlasAiJob): boolean {
  return Boolean(job.trace?.thread_id)
}

function activeAiJobSurface(job: AtlasAiJob): string | null {
  const payload = objectRecord(job.payload)
  const metadata = objectRecord(job.metadata)
  const traceMetadata = objectRecord(job.trace?.metadata)

  return firstText(
    job.trace?.thread?.surface,
    payload.app_surface,
    payload.surface,
    metadata.app_surface,
    metadata.surface,
    traceMetadata.app_surface,
    traceMetadata.surface,
  )
}

function activeAiJobWorkflow(job: AtlasAiJob): string | null {
  const payload = objectRecord(job.payload)
  const metadata = objectRecord(job.metadata)
  const traceMetadata = objectRecord(job.trace?.metadata)

  return firstText(
    payload.atlas_workflow_mode,
    metadata.atlas_workflow_mode,
    traceMetadata.atlas_workflow_mode,
  )
}

function humanAiSurface(surface: string): string {
  if (surface === 'atlas_ai_sheet') return 'App chat'
  if (surface === 'atlas_cli') return 'Terminal'
  if (surface === 'atlas_cli_schedule') return 'Scheduler CLI'
  if (surface === 'mobile_thread') return 'Mobile thread'
  if (surface === 'mobile') return 'Mobile'
  if (surface === 'worker') return 'Worker'
  if (surface === 'server') return 'Servidor'

  return surface.replace(/_/g, ' ')
}

function shortId(value: string): string {
  return value.length <= 8 ? value : value.slice(0, 8)
}

interface AiRuntimeModelGroup {
  key: string
  provider: string | null
  modelLabel: string
  activeJobs: number
  tokens: number
  origins: string[]
  originSet: Set<string>
}

function aiRuntimeModelGroups(
  jobs: AtlasAiJob[],
  status: AiProvidersStatusResponse | null,
): AiRuntimeModelGroup[] {
  const groups = new Map<string, AiRuntimeModelGroup>()

  const ensure = (provider: string | null, modelLabel: string): AiRuntimeModelGroup => {
    const key = `${provider ?? 'default'}::${modelLabel}`
    const existing = groups.get(key)
    if (existing) return existing

    const group: AiRuntimeModelGroup = {
      key,
      provider,
      modelLabel,
      activeJobs: 0,
      tokens: 0,
      origins: [],
      originSet: new Set<string>(),
    }
    groups.set(key, group)
    return group
  }

  const addOrigin = (group: AiRuntimeModelGroup, origin: string) => {
    if (group.originSet.has(origin)) return
    group.originSet.add(origin)
    group.origins.push(origin)
  }

  jobs.forEach((job) => {
    const provider = activeAiJobProvider(job)
    const group = ensure(provider, activeAiJobModelLabel(job, status))
    group.activeJobs += 1
    group.tokens += estimateActiveJobTokens(job)
    addOrigin(group, activeAiJobOriginLabel(job))
  })

  return [...groups.values()]
    .map((group) => ({ ...group, origins: group.origins.length ? group.origins : ['Atlas'] }))
    .sort((left, right) => {
      const activeDelta = right.activeJobs - left.activeJobs
      if (activeDelta !== 0) return activeDelta
      return providerLabel(left.provider).localeCompare(providerLabel(right.provider))
    })
}

function activeAiJobElapsed(job: AtlasAiJob): string {
  const date = job.started_at ?? job.reserved_at ?? job.available_at ?? job.updated_at ?? job.created_at
  if (!date) return 'tempo desconhecido'
  const elapsedMs = Math.max(0, Date.now() - new Date(date).getTime())
  if (!Number.isFinite(elapsedMs)) return formatRelativeSync(date)
  const seconds = Math.floor(elapsedMs / 1000)
  if (seconds < 60) return `${Math.max(1, seconds)}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m${seconds % 60 ? `${seconds % 60}s` : ''}`
  const hours = Math.floor(minutes / 60)
  return `${hours}h${minutes % 60 ? `${minutes % 60}m` : ''}`
}

function activeAiJobPrompt(job: AtlasAiJob): string {
  const input = firstText(job.trace?.operator_input, job.input_text)
  if (!input) return ''
  const normalized = input.replace(/\s+/g, ' ').trim()
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized
}

function activeAiJobStatusLabel(status: string): string {
  if (status === 'processing') return 'RODANDO'
  if (status === 'queued') return 'FILA'
  if (status === 'awaiting_user_choice') return 'ESCOLHA'
  return status.toUpperCase()
}

function estimateActiveJobTokens(job: AtlasAiJob): number {
  const metadata = objectRecord(job.metadata)
  const payload = objectRecord(job.payload)
  const traceMetadata = objectRecord(job.trace?.metadata)
  const direct = firstNumber(
    metadata.visible_tokens,
    metadata.estimated_tokens,
    metadata.token_estimate,
    payload.visible_tokens,
    payload.estimated_tokens,
    payload.token_estimate,
    traceMetadata.visible_tokens,
    traceMetadata.estimated_tokens,
    traceMetadata.token_estimate,
  )
  if (direct != null) return direct

  const input = firstText(job.input_text, job.trace?.operator_input) ?? ''
  const output = firstText(job.result_text, job.trace?.response_text) ?? ''

  return Math.ceil((input.length + output.length) / 4)
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
      return String(value).trim()
    }
  }

  return null
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
    if (Number.isFinite(number) && number > 0) return Math.round(number)
  }

  return null
}

function defaultProviderDescription(status: AiProvidersStatusResponse | null): string {
  if (!status) return 'Ainda não verificado'
  const model = status.default_model
  const label = model?.model_label || model?.model || 'modelo padrão do CLI'
  const tier = model?.model_tier ? ` · tier ${model.model_tier}` : ''
  return `${providerLabel(status.default_provider ?? 'claude_cli')} será usado quando nenhum provider for escolhido · ${label}${tier}`
}

function modelPolicyByProvider(status: AiProvidersStatusResponse | null, provider: string) {
  return status?.model_policy?.providers.find((item) => item.provider === provider)
    ?? status?.providers.find((item) => item.provider === provider)
    ?? null
}

function defaultModelValue(status: AiProvidersStatusResponse | null): string {
  const model = status?.default_model
  if (!model) return '-'
  return model.model_label || model.model || 'CLI default'
}

function defaultModelDescription(status: AiProvidersStatusResponse | null): string {
  if (!status?.default_model) return 'Modelo ainda não verificado'
  const model = status.default_model
  const id = model.model ? `id ${model.model}` : 'sem id explícito'
  const source = model.model_source ? ` · origem ${model.model_source}` : ''
  const tier = model.model_tier ? ` · tier ${model.model_tier}` : ''
  return `${id}${tier}${source}`
}

function runtimeSettingsDescription(status: AiProvidersStatusResponse | null): string {
  if (!status) return 'Ainda não carregado'
  const source = status.model_policy?.source ?? status.runtime_settings?.source ?? 'config'
  const updated = status.model_policy?.updated_at ?? status.runtime_settings?.updated_at
  const when = updated ? ` · atualizado ${formatRelativeSync(updated)}` : ''
  return source === 'database'
    ? `Persistido no Atlas DB${when}`
    : `Usando .env/config como fallback${when}`
}

function aiPolicyProfilesDescription(profiles: AtlasAiPolicyProfilesResponse | null): string {
  if (!profiles) return 'Perfis ainda não carregados'
  const domains = profiles.profile_registry.domains.length
  const flows = profiles.profile_registry.flows.length
  const source = profiles.profile_registry.source === 'database' ? 'Atlas DB' : 'fallback local'
  return `${domains} domínios · ${flows} fluxos · ${source}`
}

function selectedAiFlowDescription(
  profiles: AtlasAiPolicyProfilesResponse | null,
  flow: AtlasAiFlowProfile | null,
): string {
  if (!profiles) return 'Catálogo de perfis ainda não carregado'
  if (!flow) return 'Selecione um fluxo para editar'
  const domain = profiles.profile_registry.domains.find((item) => item.id === flow.domain_id)
  const source = profiles.profile_registry.source === 'database'
    ? 'editável no Atlas DB'
    : 'fallback local; rode migrations para salvar'
  return `${domain?.label ?? flow.domain_id} · ${flow.label} · ${source}`
}

function effectivePolicyPreviewReady(preview: AtlasAiPolicyPreviewResponse | null): boolean {
  return Boolean(preview?.effective_policy && Object.keys(preview.effective_policy).length > 0)
}

function effectivePolicyPreviewDescription(
  preview: AtlasAiPolicyPreviewResponse | null,
  loading: boolean,
): string {
  if (loading) return 'Recalculando merge de perfil, runtime e sessão'
  if (!effectivePolicyPreviewReady(preview)) return 'Preview ainda não calculado'
  const policy = objectRecord(preview?.effective_policy)
  const runtime = objectRecord(policy.runtime_policy)
  const policies = objectRecord(policy.policies)
  const contracts = objectRecord(policy.operational_contracts)
  const modelGraph = objectRecord(contracts.model_graph)
  const authority = firstText(policy.execution_authority) ?? 'sem autoridade'
  const provider = firstText(runtime.default_provider) ?? '-'
  const executor = firstText(objectRecord(policy.execution_policy).executor_preference) ?? '-'
  const modelPreset = firstText(modelGraph.preset, objectRecord(policies.model_policy).preset, objectRecord(policies.model_policy).default) ?? 'default'
  return `${authority} · ${provider} · ${executor} · ${firstText(modelGraph.graph) ?? 'single'} · modelo ${modelPreset}`
}

function effectivePolicyMetricRows(preview: AtlasAiPolicyPreviewResponse | null): Array<{ label: string; value: string; desc: string }> {
  const policy = objectRecord(preview?.effective_policy)
  if (Object.keys(policy).length === 0) return []

  const runtime = objectRecord(policy.runtime_policy)
  const execution = objectRecord(policy.execution_policy)
  const contracts = objectRecord(policy.operational_contracts)
  const modelGraph = objectRecord(contracts.model_graph)
  const context = objectRecord(contracts.context)
  const memory = objectRecord(contracts.memory)
  const skills = objectRecord(contracts.skills)
  const tools = objectRecord(contracts.tools)
  const gates = objectRecord(contracts.gates)

  return [
    {
      label: 'authority',
      value: firstText(policy.execution_authority) ?? '-',
      desc: firstText(policy.profile_id) ?? firstText(preview?.profile?.profile_id) ?? '-',
    },
    {
      label: 'provider',
      value: providerLabel(firstText(runtime.default_provider)),
      desc: arrayText(modelGraph.fallback_order) || arrayText(runtime.fallback_order) || 'fallback pelo runtime',
    },
    {
      label: 'graph',
      value: firstText(modelGraph.graph) ?? '-',
      desc: `${firstText(modelGraph.preset) ?? 'preset'} · ${modelGraphNodeText(modelGraph.nodes)}`,
    },
    {
      label: 'executor',
      value: firstText(execution.executor_preference) ?? '-',
      desc: `max ${firstText(execution.max_iterations) ?? '1'} · ${truthyText(execution.quality_required, 'quality')}`,
    },
    {
      label: 'context',
      value: firstText(context.depth) ?? '-',
      desc: truthyText(context.require_context_pack, 'context pack'),
    },
    {
      label: 'memory',
      value: firstText(memory.scope) ?? '-',
      desc: arrayText(memory.recall) || truthyText(memory.record_decisions, 'record decisions'),
    },
    {
      label: 'skills',
      value: firstText(skills.mode) ?? '-',
      desc: arrayText(skills.required_bundles) || truthyText(skills.require_skill_trace, 'trace'),
    },
    {
      label: 'tools',
      value: firstText(tools.mode) ?? '-',
      desc: truthyText(tools.workspace_write, 'workspace write'),
    },
    {
      label: 'gates',
      value: firstText(gates.minimum_gate) ?? '-',
      desc: arrayText(gates.required_gates) || truthyText(gates.evidence_required, 'evidence'),
    },
  ]
}

function modelGraphNodeText(value: unknown): string {
  if (!Array.isArray(value)) return 'sem nós'
  const roles = value
    .map((item) => objectRecord(item))
    .map((item) => firstText(item.role, item.id))
    .filter(Boolean)
    .slice(0, 3)
  return roles.length > 0 ? roles.join(', ') : 'sem nós'
}

function arrayText(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 4).join(', ')
}

function truthyText(value: unknown, label: string): string {
  return value === true || value === 'true' || value === 1 ? label : 'não'
}

function flowExecutorPreference(flow: AtlasAiFlowProfile | null): string {
  const execution = objectRecord(flow?.execution_policy)
  return firstText(execution.executor_preference) ?? 'simple_provider_execution'
}

function flowExecutorDescription(flow: AtlasAiFlowProfile | null, editable: boolean): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const executor = flowExecutorPreference(flow)
  const mode = editable ? 'salva no perfil do fluxo' : 'somente leitura enquanto catálogo estiver em fallback'
  if (executor === 'engineering_harness') return `Harness completo · ${mode}`
  if (executor === 'dev_repair_executor') return `Execução com repair loop · ${mode}`
  return `Execução direta por provider · ${mode}`
}

function flowAutonomyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  if (flow.autonomy === 'high') return 'Pode planejar fluxo longo, múltiplos passos e gates mais caros'
  if (flow.autonomy === 'low') return 'Conservador; evita trabalho em background e ações arriscadas'
  return 'Equilíbrio entre velocidade, qualidade e custo'
}

function flowApprovalDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  return flow.requires_human_approval_for_destructive === false
    ? 'Ações destrutivas não exigem aprovação pelo perfil'
    : 'Ações destrutivas exigem aprovação humana'
}

function flowBackgroundDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  return flow.background_allowed
    ? 'Fluxo pode ser usado por automações quando política permitir'
    : 'Fluxo limitado a sessão/manual'
}

function flowGateMinimum(flow: AtlasAiFlowProfile | null): string {
  const gate = objectRecord(flow?.gate_policy)
  const minimum = firstText(gate.minimum_gate)
  return ['standard', 'strict', 'release'].includes(minimum ?? '') ? minimum as string : 'standard'
}

function flowGatePolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const minimum = flowGateMinimum(flow)
  if (minimum === 'release') return 'Exige padrão de release antes de considerar concluído'
  if (minimum === 'strict') return 'Exige evidência e verificação mais forte'
  return 'Gate padrão do domínio e do executor'
}

function flowModelPolicyPreset(flow: AtlasAiFlowProfile | null): string {
  const policy = objectRecord(flow?.model_policy)
  const preset = firstText(policy.preset, policy.default, policy.mode)
  return ['balanced', 'quality', 'cost_guarded'].includes(preset ?? '') ? preset as string : 'balanced'
}

function flowModelPolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const preset = flowModelPolicyPreset(flow)
  if (preset === 'quality') return 'Prefere modelo mais forte, fallback e conselho quando útil'
  if (preset === 'cost_guarded') return 'Prefere modelo diário e limita escalada automática'
  return 'Equilibra qualidade, custo e disponibilidade'
}

function modelPolicyPatchForPreset(preset: string): Record<string, unknown> {
  if (preset === 'quality') {
    return {
      preset,
      default: 'quality',
      escalation: 'allow_premium_when_needed',
      fallback: 'quality_then_available',
    }
  }
  if (preset === 'cost_guarded') {
    return {
      preset,
      default: 'daily',
      escalation: 'manual_or_gate_triggered',
      fallback: 'daily_available_first',
    }
  }

  return {
    preset: 'balanced',
    default: 'balanced',
    escalation: 'auto_when_confidence_or_complexity_requires',
    fallback: 'available_first',
  }
}

function flowContextPolicyPreset(flow: AtlasAiFlowProfile | null): string {
  const policy = objectRecord(flow?.context_policy)
  const preset = firstText(policy.preset, policy.depth)
  return ['light', 'focused', 'deep'].includes(preset ?? '') ? preset as string : 'focused'
}

function flowContextPolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const preset = flowContextPolicyPreset(flow)
  if (preset === 'deep') return 'Contexto longo, memória e evidências antes de executar'
  if (preset === 'light') return 'Contexto mínimo para respostas rápidas'
  return 'Contexto focado no fluxo e no workspace atual'
}

function contextPolicyPatchForPreset(preset: string): Record<string, unknown> {
  if (preset === 'deep') {
    return {
      preset,
      depth: 'deep',
      include_memory: true,
      include_recent_traces: true,
      require_context_pack: true,
    }
  }
  if (preset === 'light') {
    return {
      preset,
      depth: 'light',
      include_memory: false,
      include_recent_traces: false,
      require_context_pack: false,
    }
  }

  return {
    preset: 'focused',
    depth: 'focused',
    include_memory: true,
    include_recent_traces: true,
    require_context_pack: false,
  }
}

function flowMemoryPolicyPreset(flow: AtlasAiFlowProfile | null): string {
  const policy = objectRecord(flow?.memory_policy)
  const preset = firstText(policy.preset, policy.scope)
  return ['thread', 'project', 'deep'].includes(preset ?? '') ? preset as string : 'project'
}

function flowMemoryPolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const preset = flowMemoryPolicyPreset(flow)
  if (preset === 'deep') return 'Usa memória semântica, projeto e decisões canônicas'
  if (preset === 'thread') return 'Limita memória ao contexto da conversa'
  return 'Usa memória do projeto e thread atual'
}

function memoryPolicyPatchForPreset(preset: string): Record<string, unknown> {
  if (preset === 'deep') {
    return {
      preset,
      scope: 'deep',
      recall: ['thread', 'project', 'semantic', 'decisions'],
      record_decisions: true,
    }
  }
  if (preset === 'thread') {
    return {
      preset,
      scope: 'thread',
      recall: ['thread'],
      record_decisions: false,
    }
  }

  return {
    preset: 'project',
    scope: 'project',
    recall: ['thread', 'project'],
    record_decisions: true,
  }
}

function flowSkillPolicyPreset(flow: AtlasAiFlowProfile | null): string {
  const policy = objectRecord(flow?.skill_policy)
  const preset = firstText(policy.preset, policy.mode)
  return ['minimal', 'domain', 'council'].includes(preset ?? '') ? preset as string : 'domain'
}

function flowSkillPolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const preset = flowSkillPolicyPreset(flow)
  if (preset === 'council') return 'Permite múltiplas skills/vozes quando o fluxo exigir'
  if (preset === 'minimal') return 'Ativa apenas skills essenciais'
  return 'Ativa skills específicas do domínio'
}

function skillPolicyPatchForPreset(preset: string): Record<string, unknown> {
  if (preset === 'council') {
    return {
      preset,
      mode: 'council',
      allow_multi_skill: true,
      require_skill_trace: true,
    }
  }
  if (preset === 'minimal') {
    return {
      preset,
      mode: 'minimal',
      allow_multi_skill: false,
      require_skill_trace: false,
    }
  }

  return {
    preset: 'domain',
    mode: 'domain',
    allow_multi_skill: true,
    require_skill_trace: true,
  }
}

function flowToolPolicyPreset(flow: AtlasAiFlowProfile | null): string {
  const policy = objectRecord(flow?.tool_policy)
  const preset = firstText(policy.preset, policy.mode)
  return ['read_only', 'workspace_write', 'harness'].includes(preset ?? '') ? preset as string : 'workspace_write'
}

function flowToolPolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const preset = flowToolPolicyPreset(flow)
  if (preset === 'harness') return 'Permite ferramentas completas com gates e evidência'
  if (preset === 'read_only') return 'Ferramentas limitadas a leitura/diagnóstico'
  return 'Permite escrita no workspace com aprovação para destrutivo'
}

function toolPolicyPatchForPreset(preset: string): Record<string, unknown> {
  if (preset === 'harness') {
    return {
      preset,
      mode: 'harness',
      workspace_write: true,
      destructive_requires_approval: true,
      require_evidence_packet: true,
    }
  }
  if (preset === 'read_only') {
    return {
      preset,
      mode: 'read_only',
      workspace_write: false,
      destructive_requires_approval: true,
      require_evidence_packet: false,
    }
  }

  return {
    preset: 'workspace_write',
    mode: 'workspace_write',
    workspace_write: true,
    destructive_requires_approval: true,
    require_evidence_packet: true,
  }
}

function providerModelDescription(status: AiProvidersStatusResponse | null, provider: string): string {
  const policy = modelPolicyByProvider(status, provider)
  if (!policy) return 'Modelo ainda não verificado'
  const label = policy.model_label || policy.model || 'CLI default'
  const tier = policy.model_tier ? ` · tier ${policy.model_tier}` : ''
  return `${label}${tier} · id ${policy.model ?? 'default'}`
}

const CLAUDE_MODEL_CHOICES = {
  default: { model: 'claude-sonnet-4-6', model_label: 'Claude Sonnet 4.6', model_tier: 'daily' },
  premium: { model: 'claude-opus-4-7', model_label: 'Claude Opus 4.7', model_tier: 'premium' },
  fallback: { model: 'claude-haiku-4-5', model_label: 'Claude Haiku 4.5', model_tier: 'daily' },
} as const

const CODEX_MODEL_CHOICES = {
  default: { model: 'gpt-5.3-codex-spark', model_label: 'GPT-5.3-Codex-Spark', model_tier: 'daily' },
  premium: { model: 'gpt-5.5', model_label: 'GPT-5.5', model_tier: 'premium' },
  fallback: { model: 'gpt-5.4-mini', model_label: 'GPT-5.4-Mini', model_tier: 'daily' },
} as const

const GEMINI_MODEL_CHOICE = {
  model: 'gemini-3.1-pro-preview',
  model_label: 'Gemini 3.1 Pro Preview',
  model_tier: 'premium',
} as const

function providerModelChoice(status: AiProvidersStatusResponse | null, provider: string): string {
  const model = modelPolicyByProvider(status, provider)?.model
  if (provider === 'claude_cli') {
    if (model === CLAUDE_MODEL_CHOICES.premium.model) return 'premium'
    if (model === CLAUDE_MODEL_CHOICES.fallback.model) return 'fallback'
    return 'default'
  }
  if (provider === 'codex_cli') {
    if (model === CODEX_MODEL_CHOICES.premium.model) return 'premium'
    if (model === CODEX_MODEL_CHOICES.fallback.model) return 'fallback'
    return 'default'
  }
  if (provider === 'gemini_cli') return 'default'
  return 'default'
}

function providerModelOptions(provider: string): SegOption[] {
  if (provider === 'gemini_cli') {
    return [{ key: 'default', label: '3.1 Pro' }]
  }

  if (provider === 'claude_cli') {
    return [
      { key: 'default', label: 'Sonnet' },
      { key: 'premium', label: 'Opus' },
      { key: 'fallback', label: 'Haiku' },
    ]
  }

  return [
    { key: 'default', label: 'Spark' },
    { key: 'premium', label: '5.5' },
    { key: 'fallback', label: 'Mini' },
  ]
}

function modelPatchForChoice(provider: string, choice: string) {
  if (provider === 'gemini_cli') {
    return modelPatch(GEMINI_MODEL_CHOICE)
  }

  if (provider === 'claude_cli') {
    const model = choice === 'premium'
      ? CLAUDE_MODEL_CHOICES.premium
      : choice === 'fallback'
        ? CLAUDE_MODEL_CHOICES.fallback
        : CLAUDE_MODEL_CHOICES.default
    return modelPatch(model)
  }

  const model = choice === 'premium'
    ? CODEX_MODEL_CHOICES.premium
    : choice === 'fallback'
      ? CODEX_MODEL_CHOICES.fallback
      : CODEX_MODEL_CHOICES.default
  return modelPatch(model)
}

function modelPatch(model: { model: string; model_label: string; model_tier: string }) {
  return {
    model: model.model,
    model_identity: model.model,
    model_label: model.model_label,
    model_tier: model.model_tier,
  }
}

function providerModelLabel(status: AiProvidersStatusResponse | null, provider: string, fallbackModel?: string | null): string {
  const policy = modelPolicyByProvider(status, provider)
  if (fallbackModel && policy?.model === fallbackModel) return policy.model_label || fallbackModel
  return policy?.model_label || fallbackModel || policy?.model || 'CLI default'
}

function providerAutomationStatus(status: AiProvidersStatusResponse | null, provider: string): ConnectionStatusKind {
  const policy = modelPolicyByProvider(status, provider)
  if (!policy) return 'offline'
  return policy.allow_auto ? 'pending' : 'online'
}

function providerAutomationDescription(status: AiProvidersStatusResponse | null, provider: string): string {
  const policy = modelPolicyByProvider(status, provider)
  if (!policy) return 'Política de modelo ainda não verificada'
  const manual = policy.allow_manual ? 'manual permitido' : 'manual bloqueado'
  const automatic = policy.allow_auto ? 'automático permitido' : 'automático bloqueado'
  const model = policy.model_label || policy.model || 'CLI default'
  return `${automatic} · ${manual} · default ${model}`
}

function workerByProvider(status: AiProvidersStatusResponse | null, provider: string) {
  return status?.workers?.find((item) => item.provider === provider) ?? null
}

function providerWorkerStatus(status: AiProvidersStatusResponse | null, provider: string): ConnectionStatusKind {
  const worker = workerByProvider(status, provider)
  if (!worker) return 'offline'
  if (worker.status === 'running') return 'online'
  if (worker.status === 'stale') return 'pending'
  return 'offline'
}

function providerWorkerDescription(status: AiProvidersStatusResponse | null, provider: string): string {
  const worker = workerByProvider(status, provider)
  if (!worker) return 'Sem evento de worker registrado'

  const when = formatRelativeSync(worker.occurred_at)
  if (worker.status === 'running') return `${worker.event_type ?? 'worker'} · rodando · ${when}`
  if (worker.status === 'stale') return `${worker.event_type ?? 'worker'} · visto recentemente · ${when}`
  if (worker.status === 'stopped') return `${worker.event_type ?? 'worker'} · parado · ${when}`
  return worker.message ? `${worker.message} · ${when}` : `Sem heartbeat recente · ${when}`
}

function aiQueueHasWork(status: AiProvidersStatusResponse | null): boolean {
  return !!status && (status.queue.queued > 0 || status.queue.processing > 0 || (status.queue.awaiting_user_choice ?? 0) > 0 || status.queue.failed > 0)
}

function aiQueueValue(status: AiProvidersStatusResponse | null): string {
  if (!status) return '-'
  return `${status.queue.queued}/${status.queue.processing}/${status.queue.awaiting_user_choice ?? 0}/${status.queue.failed}`
}

function aiQueueDescription(status: AiProvidersStatusResponse | null): string {
  if (!status) return 'Fila ainda não verificada'
  const active = (status.queue.by_provider ?? [])
    .filter((item) => item.queued + item.processing + (item.awaiting_user_choice ?? 0) + item.failed > 0)
    .map((item) => `${providerLabel(item.provider)} ${item.queued}/${item.processing}/${item.awaiting_user_choice ?? 0}/${item.failed}`)

  if (active.length === 0) return '0 aguardando · 0 processando · 0 escolha · 0 falhas'
  return active.join(' · ')
}

function activeAiJob(status: AiProvidersStatusResponse | null) {
  return status?.active_jobs?.find((job) => job.status === 'processing')
    ?? null
}

function activeAiJobValue(status: AiProvidersStatusResponse | null): string {
  const job = activeAiJob(status)
  if (!job) return 'nada'
  return activeAiJobShortLabel(job)
}

function activeAiJobDescription(status: AiProvidersStatusResponse | null): string {
  if (!status) return 'Jobs ativos ainda não verificados'
  const job = activeAiJob(status)
  if (!job) {
    const waiting = status.active_jobs?.find((item) => item.status === 'queued' || item.status === 'awaiting_user_choice')
    if (!waiting) return 'Nada processando agora'
    const waitingStage = activeAiJobStageLabel(waiting)
    const waitingDependency = activeAiJobDependencyLabel(waiting)
    return `Nada processando · ${activeAiJobShortLabel(waiting)} ${waiting.status}${waitingStage}${waitingDependency} · atualizado ${formatRelativeSync(waiting.updated_at)}`
  }
  const model = job.model_label || providerModelLabel(status, job.provider ?? '', job.model)
  const tier = job.model_tier ? ` · tier ${job.model_tier}` : ''
  const worker = job.worker_id ? ` · ${job.worker_id}` : ''
  const stage = activeAiJobStageLabel(job)
  const dependency = activeAiJobDependencyLabel(job)
  return `${job.status}${stage}${dependency} · ${model}${tier}${worker} · atualizado ${formatRelativeSync(job.updated_at)}`
}

function activeAiJobShortLabel(job: AtlasAiActiveJob): string {
  const provider = providerLabel(job.provider)
  const stage = job.atlas_decide_stage ?? job.atlas_decide_execution?.atlas_decide_stage ?? null

  if (stage === 'context_scout') return `${provider} scout`
  if (stage === 'primary_executor') return `${provider} executor`

  return provider
}

function activeAiJobStageLabel(job: AtlasAiActiveJob): string {
  const stage = job.atlas_decide_stage ?? job.atlas_decide_execution?.atlas_decide_stage ?? null
  if (stage === 'context_scout') return ' · Atlas Decide scout'
  if (stage === 'primary_executor') return ' · Atlas Decide executor'
  if (stage) return ` · ${stage}`
  return ''
}

function activeAiJobDependencyLabel(job: AtlasAiActiveJob): string {
  const dependency = job.dependency_state ?? job.atlas_decide_execution?.dependency_state ?? null
  if (!dependency || dependency === 'none' || dependency === 'source') return ''
  return ` · dependência ${dependency}`
}

function usageByProvider(status: AiProvidersStatusResponse | null, provider: string) {
  return status?.usage_24h?.by_provider.find((item) => item.provider === provider) ?? null
}

function providerUsageHasActivity(status: AiProvidersStatusResponse | null, provider: string): boolean {
  const usage = usageByProvider(status, provider)
  return !!usage && usage.traces > 0
}

function providerUsageValue(status: AiProvidersStatusResponse | null, provider: string): string {
  if (!status?.usage_24h?.available) return 'sem dados'
  const usage = usageByProvider(status, provider)
  if (!usage) return '0 tok'
  const tokens = usage.visible_tokens || usage.estimated_tokens || usage.total_tokens
  return `${formatCompactNumber(tokens)} tok`
}

function providerUsageDescription(status: AiProvidersStatusResponse | null, provider: string): string {
  if (!status?.usage_24h?.available) return 'Telemetria de tokens ainda não disponível'
  const usage = usageByProvider(status, provider)
  if (!usage) return '0 execuções nas últimas 24h'

  const failures = usage.failed_traces > 0 ? ` · ${usage.failed_traces} falhas` : ''
  const cost = usage.cost_usd_estimate > 0
    ? ` · ~US$ ${usage.cost_usd_estimate.toFixed(4)}`
    : usage.unknown_cost_count > 0
      ? ` · ${usage.unknown_cost_count} sem custo calculado`
      : ''

  const modelUsage = (status.usage_24h.by_model ?? [])
    .filter((item) => item.provider === provider)
    .filter((item) => item.traces > 0)
    .map((item) => `${providerModelLabel(status, provider, item.model)} ${formatCompactNumber(item.visible_tokens || item.estimated_tokens || item.total_tokens)} tok`)
    .slice(0, 2)
    .join(' · ')
  const models = modelUsage ? ` · ${modelUsage}` : ''

  return `${usage.traces} execuções${failures}${cost}${models} · atualizado ${formatRelativeSync(usage.last_computed_at)}`
}

function aiBudgetDescription(status: AiProvidersStatusResponse | null): string {
  const budget = status?.budget
  if (!budget) return 'Budget ainda não carregado'
  if (!budget.available) return 'Tabela de telemetria ainda não disponível'

  const mode = budget.enabled
    ? budget.mode === 'block' ? 'bloqueia no limite' : 'monitora'
    : 'desligado'
  const used = formatCompactNumber(budget.totals.visible_tokens)
  const max = budget.totals.max_visible_tokens ? `/${formatCompactNumber(budget.totals.max_visible_tokens)}` : ''
  return `${mode} · janela ${budget.window_hours}h · ${used}${max} tok visíveis`
}

function budgetByProvider(status: AiProvidersStatusResponse | null, provider: string) {
  return status?.budget?.providers.find((item) => item.provider === provider) ?? null
}

function providerBudgetDescription(status: AiProvidersStatusResponse | null, provider: string): string {
  const budget = budgetByProvider(status, provider)
  if (!status?.budget?.available) return 'Sem telemetria para medir limite'
  if (!budget) return 'Sem budget configurado para provider'

  const used = formatCompactNumber(budget.visible_tokens)
  const max = budget.max_visible_tokens ? formatCompactNumber(budget.max_visible_tokens) : 'sem limite'
  const remaining = budget.remaining_visible_tokens == null ? '' : ` · resta ${formatCompactNumber(budget.remaining_visible_tokens)}`
  const state = budget.status === 'blocked' ? 'bloqueado' : budget.status === 'warning' ? 'atenção' : 'ok'
  return `${state} · ${used}/${max} tok em ${status.budget.window_hours}h${remaining}`
}

function budgetPresetOptions(): SegOption[] {
  return [
    { key: 'none', label: 'Sem' },
    { key: '50k', label: '50k' },
    { key: '100k', label: '100k' },
    { key: '250k', label: '250k' },
  ]
}

function providerBudgetChoice(status: AiProvidersStatusResponse | null, provider: string): string {
  const max = budgetByProvider(status, provider)?.max_visible_tokens ?? null
  if (max === 50_000) return '50k'
  if (max === 100_000) return '100k'
  if (max === 250_000) return '250k'
  return 'none'
}

function budgetValueForChoice(choice: string): number | null {
  if (choice === '50k') return 50_000
  if (choice === '100k') return 100_000
  if (choice === '250k') return 250_000
  return null
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1_000_000) return `${trimFixed(value / 1_000_000)}M`
  if (value >= 1_000) return `${trimFixed(value / 1_000)}k`
  return String(Math.round(value))
}

function trimFixed(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
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
  if (!workerEvent.occurred_at) return 'unknown'

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

  const model = providerModelLabel(status, providerKey, provider.model)
  const tier = provider.model_tier ? `/${provider.model_tier}` : ''
  const message = provider.message ? ` · ${provider.message}` : ''
  const modelText = ` · modelo ${model}${tier}`
  const recentEvent = recentProviderEvent(status, providerKey)
  if (recentEvent?.event_type === 'job_succeeded') {
    return `Último job ok · ${formatRelativeSync(recentEvent.occurred_at)}${modelText}${message}`
  }
  if (recentEvent && ['job_failed', 'timeout', 'auth_expired', 'rate_limited'].includes(recentEvent.event_type)) {
    return `${recentEvent.message} · ${formatRelativeSync(recentEvent.occurred_at)}${modelText}${message}`
  }

  if (!providerHealthIsFresh(provider)) {
    return `Health check desatualizado · ${formatRelativeSync(provider.checked_at)}${modelText}${message}`
  }

  return `${providerPainLabel(provider.operational_pain_score)} · ${formatRelativeSync(provider.checked_at)}${modelText}${message}`
}

function recentProviderEvent(status: AiProvidersStatusResponse | null, provider: string) {
  const event = status?.recent_events.find((item) => item.provider === provider)
  if (!event) return null
  if (!event.occurred_at) return null

  const occurredAt = new Date(event.occurred_at).getTime()
  if (!Number.isFinite(occurredAt)) return null
  return Date.now() - occurredAt <= PROVIDER_HEALTH_FRESH_MS ? event : null
}

function providerHealthIsFresh(provider: ProviderHealth): boolean {
  if (!provider.checked_at) return false

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
    return 'Atlas não está carregado no servidor. Rebuild/restart o atlas-server.'
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

function voicePermissionStatusKind(permission: VoicePermission | null, busy: boolean): ConnectionStatusKind {
  if (busy) return 'pending'
  if (!permission) return 'pending'
  return permission.granted ? 'online' : 'offline'
}

function voicePermissionDescription(permission: VoicePermission | null): string {
  if (!permission) return 'Toque para verificar a permissão do microfone'
  if (permission.granted) return 'Microfone liberado para conversa por voz'
  if (permission.canAskAgain === false) return 'Bloqueado nos Ajustes do iPhone'
  return 'Aguardando permissão do iOS'
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

function PolicyFlowPicker({
  profiles,
  selectedFlowId,
  onSelect,
}: {
  profiles: AtlasAiPolicyProfilesResponse | null
  selectedFlowId: string
  onSelect: (flowId: string) => void
}) {
  const { c } = useTheme()
  const flows = policyFlowOptions(profiles)

  if (flows.length === 0) {
    return (
      <View style={styles.profileFlowEmpty}>
        <Sans size={12} lineHeight={17} color={c.ink2}>
          Catálogo de perfis indisponível.
        </Sans>
      </View>
    )
  }

  return (
    <View style={styles.profileFlowGrid}>
      {flows.map((flow) => {
        const selected = flow.id === selectedFlowId
        return (
          <Pressable
            key={flow.id}
            onPress={() => onSelect(flow.id)}
            style={({ pressed }) => [
              styles.profileFlowChip,
              {
                borderColor: selected ? c.prussian : c.border,
                backgroundColor: selected ? c.surface : pressed ? c.surface : 'transparent',
              },
            ]}
          >
            <Mono size={10} letterSpacing={0.34} color={selected ? c.prussian : c.ink2}>
              {flow.id}
            </Mono>
            <Sans size={11} lineHeight={14} color={c.ink2}>
              {flow.runtime ?? flow.orchestrator ?? flow.autonomy ?? 'policy'}
            </Sans>
          </Pressable>
        )
      })}
    </View>
  )
}

function EffectivePolicyPreviewPanel({
  preview,
  loading,
}: {
  preview: AtlasAiPolicyPreviewResponse | null
  loading: boolean
}) {
  const { c } = useTheme()
  const rows = effectivePolicyMetricRows(preview)

  if (loading || rows.length === 0) {
    return (
      <View style={styles.policyPreviewEmpty}>
        <Sans size={12} lineHeight={17} color={c.ink2}>
          {loading ? 'Calculando política efetiva...' : 'Sem preview efetivo para este fluxo.'}
        </Sans>
      </View>
    )
  }

  return (
    <View style={styles.policyPreviewGrid}>
      {rows.map((row) => (
        <View key={row.label} style={[styles.policyPreviewMetric, { borderColor: c.border }]}>
          <Mono size={9.5} letterSpacing={0.28} color={c.ink2}>
            {row.label}
          </Mono>
          <Sans weight="med" size={13} lineHeight={17} color={c.ink}>
            {row.value}
          </Sans>
          <Sans size={11} lineHeight={14} color={c.ink2}>
            {row.desc}
          </Sans>
        </View>
      ))}
    </View>
  )
}

function policyFlowOptions(profiles: AtlasAiPolicyProfilesResponse | null): AtlasAiFlowProfile[] {
  const flows = profiles?.profile_registry.flows ?? []
  const priority = [
    'programming.dev',
    'programming.forge',
    'research.quick',
    'research.super',
    'finance.research',
    'personal_development.reflect',
    'background.safe',
  ]

  return [...flows]
    .sort((left, right) => {
      const leftRank = priority.indexOf(left.id)
      const rightRank = priority.indexOf(right.id)
      if (leftRank !== -1 || rightRank !== -1) {
        return (leftRank === -1 ? 999 : leftRank) - (rightRank === -1 ? 999 : rightRank)
      }
      return left.id.localeCompare(right.id)
    })
    .slice(0, 8)
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
      spellCheck={false}
      autoComplete="off"
      textContentType="none"
      importantForAutofill="no"
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

function SecretApiInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder: string
}) {
  const { c } = useTheme()
  const { showToast } = useShell()
  const [revealed, setRevealed] = useState(false)
  const canCopy = value.trim().length > 0

  const handleCopy = () => {
    if (!canCopy) return
    void copyToClipboard(value, () => showToast('token copiado', { durationMs: 1600 }))
  }

  return (
    <View style={styles.secretInputRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        secureTextEntry={!revealed}
        selectionColor={c.prussian}
        style={[styles.apiInput, styles.secretInputField, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
      />
      <Pressable
        onPress={() => setRevealed((v) => !v)}
        hitSlop={6}
        style={({ pressed }) => [
          styles.secretInputAction,
          { borderColor: c.border, backgroundColor: pressed ? c.premium : c.surface },
        ]}
      >
        <Mono size={10} letterSpacing={0.4} color={c.ink2}>
          {revealed ? 'ocultar' : 'ver'}
        </Mono>
      </Pressable>
      <Pressable
        onPress={handleCopy}
        disabled={!canCopy}
        hitSlop={6}
        style={({ pressed }) => [
          styles.secretInputAction,
          {
            borderColor: c.border,
            backgroundColor: pressed && canCopy ? c.premium : c.surface,
            opacity: canCopy ? 1 : 0.4,
          },
        ]}
      >
        <Mono size={10} letterSpacing={0.4} color={c.ink2}>
          copiar
        </Mono>
      </Pressable>
    </View>
  )
}

function ApiAutoSaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  const { c } = useTheme()
  if (state === 'idle') return null
  return (
    <View style={styles.autoSaveBadge}>
      <Mono size={10} letterSpacing={0.4} color={c.ink2}>
        {state === 'saving' ? 'salvando…' : 'salvo'}
      </Mono>
    </View>
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
      <Sans weight="med" size={13} lineHeight={17} color={c.prussian} align="center" numberOfLines={2}>
        {label}
      </Sans>
    </Pressable>
  )
}

function AiSessionsDashboard({
  jobs,
  status,
  jobsLoading,
  busyJobId,
  onRefresh,
  onOpenJob,
  onCancelJob,
}: {
  jobs: AtlasAiJob[]
  status: AiProvidersStatusResponse | null
  jobsLoading: boolean
  busyJobId: string | null
  onRefresh: () => void
  onOpenJob: (job: AtlasAiJob) => void
  onCancelJob: (job: AtlasAiJob) => void
}) {
  const { c } = useTheme()
  const runningThreadCount = new Set(
    jobs.map((job) => job.trace?.thread_id).filter((id): id is string => typeof id === 'string'),
  ).size

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      <Section label="Controle">
        <Row first name="Atualização" desc="Somente execuções que podem consumir token">
          <MiniButton label={jobsLoading ? 'Atualizando...' : 'Atualizar'} disabled={jobsLoading} onPress={onRefresh} />
        </Row>
        <Row name="Consumindo agora" desc={activeAiSessionsDescription(jobs, jobsLoading)}>
          <Mono size={12} letterSpacing={0.48} color={jobs.length > 0 ? c.bronze : c.ink2}>
            {jobsLoading ? '...' : String(jobs.length)}
          </Mono>
        </Row>
        <Row name="Conversas em execução" desc="Conversas só aparecem aqui se tiverem job em fila, rodando ou aguardando escolha">
          <Mono size={12} letterSpacing={0.48} color={jobs.length > 0 ? c.bronze : c.ink2}>
            {jobsLoading ? '...' : String(runningThreadCount)}
          </Mono>
        </Row>
      </Section>

      <Section label="Modelos consumindo">
        <AiRuntimeModelSummary jobs={jobs} status={status} loading={jobsLoading} />
      </Section>

      <Section label="Execuções consumindo">
        <ActiveAiSessionsList
          jobs={jobs}
          status={status}
          loading={jobsLoading}
          busyJobId={busyJobId}
          onOpen={onOpenJob}
          onCancel={onCancelJob}
        />
      </Section>
    </ScrollView>
  )
}

function AiRuntimeModelSummary({
  jobs,
  status,
  loading,
}: {
  jobs: AtlasAiJob[]
  status: AiProvidersStatusResponse | null
  loading: boolean
}) {
  const { c } = useTheme()
  const groups = aiRuntimeModelGroups(jobs, status)

  if (groups.length === 0) {
    return (
      <View style={styles.activeJobEmpty}>
        <Sans size={13} lineHeight={18} color={c.ink2}>
          {loading ? 'Montando visão por modelo...' : 'Nenhum modelo consumindo agora'}
        </Sans>
      </View>
    )
  }

  return (
    <View style={styles.activeJobList}>
      {groups.map((group, index) => (
        <View
          key={group.key}
          style={[
            styles.modelGroupItem,
            index > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <View style={styles.activeJobHeader}>
            <View style={styles.activeJobTitleBlock}>
              <Sans weight="med" size={15} lineHeight={19} color={c.ink}>
                {providerLabel(group.provider)} · {group.modelLabel}
              </Sans>
              <Sans size={12} lineHeight={16} color={c.ink2}>
                {group.origins.join(' · ')}
              </Sans>
            </View>
            <Mono size={10.5} letterSpacing={0.36} color={group.activeJobs > 0 ? c.bronze : c.ink2}>
              CONSUMINDO
            </Mono>
          </View>
          <View style={styles.modelMetricRow}>
            <ModelMetric label="execuções" value={String(group.activeJobs)} />
            <ModelMetric label="origens" value={String(group.origins.length)} />
            <ModelMetric label="tokens ativos" value={`~${formatCompactNumber(group.tokens)}`} />
          </View>
        </View>
      ))}
    </View>
  )
}

function ModelMetric({ label, value }: { label: string; value: string }) {
  const { c } = useTheme()

  return (
    <View style={styles.modelMetric}>
      <Mono size={9.5} letterSpacing={0.35} color={c.ink2}>
        {label.toUpperCase()}
      </Mono>
      <Sans weight="med" size={13} lineHeight={17} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

function ActiveAiSessionsList({
  jobs,
  status,
  loading,
  busyJobId,
  onOpen,
  onCancel,
}: {
  jobs: AtlasAiJob[]
  status: AiProvidersStatusResponse | null
  loading: boolean
  busyJobId: string | null
  onOpen: (job: AtlasAiJob) => void
  onCancel: (job: AtlasAiJob) => void
}) {
  const { c } = useTheme()

  if (jobs.length === 0) {
    return (
      <View style={styles.activeJobEmpty}>
        <Sans size={13} lineHeight={18} color={c.ink2}>
          {loading ? 'Verificando execuções ativas...' : 'Nada rodando agora'}
        </Sans>
      </View>
    )
  }

  return (
    <View style={styles.activeJobList}>
      {jobs.map((job, index) => {
        const title = activeAiJobTitle(job, status)
        const subtitle = activeAiJobSubtitle(job)
        const prompt = activeAiJobPrompt(job)
        const canOpen = activeAiJobCanOpen(job)
        const busy = busyJobId === job.id
        const statusColor = job.status === 'processing'
          ? c.bronze
          : job.status === 'queued'
            ? c.prussian
            : c.ink2

        return (
          <View
            key={job.id}
            style={[
              styles.activeJobItem,
              index > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <View style={styles.activeJobHeader}>
              <View style={styles.activeJobTitleBlock}>
                <Sans weight="med" size={15} lineHeight={19} color={c.ink}>
                  {title}
                </Sans>
                <Sans size={12} lineHeight={16} color={c.ink2}>
                  {subtitle}
                </Sans>
              </View>
              <Mono size={10.5} letterSpacing={0.36} color={statusColor}>
                {activeAiJobStatusLabel(job.status)}
              </Mono>
            </View>
            {prompt ? (
              <Sans size={12} lineHeight={17} color={c.ink2}>
                {prompt}
              </Sans>
            ) : null}
            <View style={styles.activeJobActions}>
              <RuntimeButton label={canOpen ? 'Entrar' : 'Sem conversa'} disabled={!canOpen || busy} onPress={() => onOpen(job)} />
              <RuntimeButton label={busy ? 'Cancelando...' : 'Cancelar'} disabled={busy} danger onPress={() => onCancel(job)} />
            </View>
          </View>
        )
      })}
    </View>
  )
}

function RuntimeButton({
  label,
  disabled,
  danger,
  onPress,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  const color = danger ? c.recRed : c.prussian

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.runtimeButton,
        {
          borderColor: color,
          backgroundColor: pressed ? c.surface : 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Sans weight="med" size={12} color={color} align="center">
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
  disabled,
  onChange,
}: {
  value: string
  options: SegOption[]
  disabled?: boolean
  onChange: (k: string) => void
}) {
  const { c, name } = useTheme()
  return (
    <View style={[segStyles.track, { backgroundColor: c.surface, borderColor: c.border }]}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <Pressable
            key={o.key}
            disabled={disabled}
            onPress={() => onChange(o.key)}
            style={[
              segStyles.btn,
              disabled && { opacity: 0.45 },
              on && {
                backgroundColor: c.bg,
                shadowColor: name === 'dark' ? '#000' : '#1A1612',
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
  secretInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secretInputField: {
    width: 96,
  },
  secretInputAction: {
    minHeight: 28,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoSaveBadge: {
    alignSelf: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  apiActions: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  profileFlowGrid: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileFlowChip: {
    width: '48%',
    minHeight: 58,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  profileFlowEmpty: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
  },
  policyPreviewGrid: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  policyPreviewMetric: {
    width: '48%',
    minHeight: 74,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 3,
  },
  policyPreviewEmpty: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
  },
  queueError: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
  },
  activeJobEmpty: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
  },
  activeJobList: {
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  activeJobItem: {
    paddingVertical: 12,
    gap: 8,
  },
  activeJobHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  activeJobTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  activeJobActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modelGroupItem: {
    paddingVertical: 12,
    gap: 10,
  },
  modelMetricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modelMetric: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  runtimeButton: {
    flex: 1,
    minHeight: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniButton: {
    flex: 1,
    minWidth: 104,
    minHeight: 42,
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
