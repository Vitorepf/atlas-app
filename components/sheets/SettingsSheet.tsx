import { useEffect, useRef, useState } from 'react'
import { Alert, InteractionManager, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Constants from 'expo-constants'
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio'
import { SideSheet } from './SideSheet'
import { ScreenTimeSelectionSheet } from '../ScreenTimeSelectionSheet'
import { CreateDomainPanel } from '../domains/CreateDomainPanel'
import { Frau, Mono, Sans } from '../../design/Type'
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
import { formatRelativeSync, localQueueCounts, useAtlasStore } from '../../lib/atlasStore'
import {
  SCREEN_TIME_BUCKETS,
  type ScreenTimeLocalStatus,
} from '../../lib/screenTime'
import { nowMs, recordPerformanceDuration } from '../../lib/performanceTelemetry'
import {
  type VoicePermission,
  activeAiJobDescription,
  activeAiJobTitle,
  activeAiJobValue,
  activeAiSessionsDescription,
  activeJobTime,
  activeStatusRank,
  aiBudgetDescription,
  aiGatewayDescription,
  aiGatewayStatus,
  aiPolicyProfilesDescription,
  aiQueueDescription,
  aiQueueHasWork,
  aiQueueValue,
  budgetPresetOptions,
  budgetValueForChoice,
  caffeinateRuntimeDescription,
  caffeinateRuntimeStatus,
  connectionStatusDescription,
  connectionStatusKind,
  contextPolicyPatchForPreset,
  databaseHealthDescription,
  databaseHealthStatus,
  defaultModelDescription,
  defaultModelValue,
  defaultProviderChoice,
  defaultProviderDescription,
  defaultProviderOptions,
  domainPrivacyLabel,
  effectivePolicyPreviewDescription,
  effectivePolicyPreviewReady,
  firstQueueError,
  flowApprovalDescription,
  flowAutonomyDescription,
  flowBackgroundDescription,
  flowContextPolicyDescription,
  flowContextPolicyPreset,
  flowExecutorDescription,
  flowExecutorPreference,
  flowGateMinimum,
  flowGatePolicyDescription,
  flowMemoryPolicyDescription,
  flowMemoryPolicyPreset,
  flowModelPolicyDescription,
  flowModelPolicyPreset,
  flowSkillPolicyDescription,
  flowSkillPolicyPreset,
  flowToolPolicyDescription,
  flowToolPolicyPreset,
  healthKitDescription,
  humanAiError,
  lastAiEventDescription,
  macAgentSupervisorDescription,
  macAgentSupervisorStatus,
  macBatteryValue,
  macConnectionStatus,
  macNextActionDescription,
  macNextActionStatus,
  macPowerDescription,
  macReadinessDescription,
  macReadinessStatus,
  macStatusDescription,
  maintenanceDescription,
  memoryPolicyPatchForPreset,
  modelPatchForChoice,
  modelPolicyByProvider,
  modelPolicyPatchForPreset,
  normalizeApiDrafts,
  powerHelperDescription,
  powerHelperStatus,
  providerAutomationDescription,
  providerBudgetChoice,
  providerBudgetDescription,
  providerCatalogRows,
  providerDescription,
  providerLabel,
  providerModelChoice,
  providerModelDescription,
  providerModelOptions,
  providerStatus,
  providerUsageDescription,
  providerUsageHasActivity,
  providerUsageValue,
  providerWorkerDescription,
  providerWorkerStatus,
  queueDescription,
  remoteModeActive,
  remoteModeDescription,
  runtimeSettingsDescription,
  screenTimeDescription,
  screenTimeStatusKind,
  selectedAiFlowDescription,
  skillPolicyPatchForPreset,
  statusAfterSync,
  statusKindFromMessage,
  storageHealthDescription,
  storageHealthStatus,
  toolPolicyPatchForPreset,
  transcriptionHealthDescription,
  transcriptionHealthStatus,
  transcriptionQueueDescription,
  transcriptionQueueStatus,
  voicePermissionDescription,
  voicePermissionStatusKind,
  wakeScheduleDescription,
  wakeScheduleStatus,
} from './settings/settingsStatus'
import { ApiAutoSaveBadge, MiniButton, Row, Section, Segmented, StatusBadge } from './settings/SettingsPrimitives'
import { ApiTextInput, SecretApiInput } from './settings/SettingsApiInputs'
import { ChoiceButton, EffectivePolicyPreviewPanel, PolicyFlowPicker } from './settings/SettingsPolicyPanels'
import { ActiveAiSessionsList, AiSessionsDashboard } from './settings/SettingsAiPanels'

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
            <ChoiceButton
              value={defaultProviderChoice(aiStatus)}
              options={defaultProviderOptions(aiStatus)}
              onChange={(provider) => {
                void saveAiRuntimeSettings({ default_provider: provider })
              }}
            />
          </Row>
          {providerCatalogRows(aiStatus).map((provider) => (
            <Row key={`model-${provider.provider}`} name={`Modelo ${provider.provider_label ?? providerLabel(provider.provider)}`} desc={providerModelDescription(aiStatus, provider.provider)}>
              <ChoiceButton
                value={providerModelChoice(aiStatus, provider.provider)}
                options={providerModelOptions(aiStatus, provider.provider)}
                onChange={(choice) => {
                  void saveAiRuntimeSettings({ providers: { [provider.provider]: modelPatchForChoice(aiStatus, provider.provider, choice) } })
                }}
              />
            </Row>
          ))}
          {providerCatalogRows(aiStatus).map((provider) => (
            <Row key={`auto-${provider.provider}`} name={`${provider.provider_label ?? providerLabel(provider.provider)} automático`} desc={providerAutomationDescription(aiStatus, provider.provider)}>
              <Segmented
                value={modelPolicyByProvider(aiStatus, provider.provider)?.allow_auto ? 'on' : 'off'}
                options={[
                  { key: 'off', label: 'OFF' },
                  { key: 'on', label: 'ON' },
                ]}
                onChange={(value) => {
                  void saveAiRuntimeSettings({ providers: { [provider.provider]: { allow_auto: value === 'on' } } })
                }}
              />
            </Row>
          ))}
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
          {providerCatalogRows(aiStatus).map((provider) => (
            <Row key={`budget-${provider.provider}`} name={`Limite ${provider.provider_label ?? providerLabel(provider.provider)}`} desc={providerBudgetDescription(aiStatus, provider.provider)}>
              <ChoiceButton
                value={providerBudgetChoice(aiStatus, provider.provider)}
                options={budgetPresetOptions()}
                onChange={(value) => {
                  void saveAiRuntimeSettings({ budget: { providers: { [provider.provider]: { max_visible_tokens: budgetValueForChoice(value) } } } })
                }}
              />
            </Row>
          ))}
          {providerCatalogRows(aiStatus).map((provider) => (
            <Row key={`worker-${provider.provider}`} name={`Worker ${provider.provider_label ?? providerLabel(provider.provider)}`} desc={providerWorkerDescription(aiStatus, provider.provider)}>
              <StatusBadge status={providerWorkerStatus(aiStatus, provider.provider)} />
            </Row>
          ))}
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
  queueError: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
  },
})
