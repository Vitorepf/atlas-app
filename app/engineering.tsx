import { Alert, Image, RefreshControl, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { CodexReveal } from '../components/CodexReveal'
import { Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import { memoryEngineeringRunReviewParams } from '../lib/memoryReviewNavigation'
import {
  applyEngineeringRunOperatorAction,
  calibrateEngineeringBenchmarkSuite,
  calibrateEngineeringHarnessability,
  configureAtlasToolAuthorityPolicy,
  ensureDefaultEngineeringBenchmarkSuite,
  evaluateAtlasToolGate,
  fetchAtlasStructureMotherAudit,
  approveAtlasTool,
  fetchAtlasToolsAuthority,
  fetchAtlasToolsAuthorityPolicies,
  fetchAtlasToolsDoctor,
  fetchEngineeringCodeAudit,
  fetchEngineeringCodeModule,
  fetchEngineeringCodeModules,
  fetchEngineeringCodeSymbols,
  fetchEngineeringBenchmarkRun,
  fetchEngineeringBenchmarkSuite,
  fetchEngineeringBenchmarkTrends,
  fetchEngineeringHarnessabilityCalibration,
  fetchEngineeringKnowledge,
  fetchEngineeringKnowledgeItem,
  fetchEngineeringRunPatchDiff,
  fetchEngineeringTestRunArtifactContent,
  listAtlasToolEvidence,
  listAtlasToolPolicies,
  listEngineeringTestRunArtifacts,
  listEngineeringBenchmarkSuites,
  indexEngineeringCodeKnowledge,
  replayAtlasMobilePush,
  replayEngineeringRun,
  replayEngineeringRunAttempt,
  revokeAtlasToolAuthorityPolicy,
  revokeAtlasToolApproval,
  runAtlasToolRecipe,
  promoteEngineeringRunToBenchmarkCase,
  runEngineeringBenchmarkSuite,
  runEngineeringApiContract,
  syncEngineeringKnowledge,
  type AtlasEngineeringAttemptComparisonRow,
  type AtlasEngineeringBenchmarkResultSummary,
  type AtlasEngineeringBenchmarkRunResponse,
  type AtlasEngineeringBenchmarkRunSummary,
  type AtlasEngineeringBenchmarkSuiteResponse,
  type AtlasEngineeringBenchmarkSuiteSummary,
  type AtlasEngineeringBenchmarkTrendsResponse,
  type AtlasMobilePushReplayResponse,
  type AtlasStructureMotherAuditAction,
  type AtlasStructureMotherAuditResponse,
  type AtlasEngineeringCodeAuditResponse,
  type AtlasEngineeringCodeModuleResponse,
  type AtlasEngineeringCodeModulesResponse,
  type AtlasEngineeringCodeSymbolsResponse,
  type AtlasEngineeringKnowledgeItemDetail,
  type AtlasEngineeringKnowledgeResponse,
  type AtlasEngineeringTestArtifactContentResponse,
  type AtlasEngineeringTestArtifactFile,
  type AtlasEngineeringRunSummary,
  type AtlasEngineeringTestRunSummary,
  type AtlasToolAuthorityPolicy,
  type AtlasToolsAuthorityResponse,
  type AtlasToolsAuthorityPoliciesResponse,
  type AtlasToolsDoctorResponse,
  type AtlasToolsEvidenceResponse,
  type AtlasToolsGateResponse,
  type AtlasToolsPoliciesResponse,
} from '../lib/api/client'
import {
  buildToolRuntimeGateFilters,
  buildEngineeringToolAuthoritySummary,
  buildEngineeringToolAuthorityPolicySummary,
  buildEngineeringToolRuntimeSummary,
  toolAuthorityGroupLine,
  toolAuthorityPolicyLine,
  toolRuntimeEvidenceLine,
  toolRuntimeGateIssueLine,
  toolRuntimeGateLine,
  toolRuntimeGateModeLine,
  toolApprovalPolicyLine,
  toolRuntimeRiskLine,
  type EngineeringToolGateMode,
  type EngineeringToolRuntimeSummary,
} from '../lib/engineeringToolRuntime'
import {
  engineeringCodeAuditDriftLine,
  engineeringCodeAuditStatusLabel,
  engineeringCodeModuleCoverageLine,
  engineeringCodeModuleMetaLine,
  engineeringCodeSymbolMetaLine,
  engineeringCodeValuesLine,
  engineeringKnowledgeBodyPreview,
  engineeringKnowledgeMetaLine,
  engineeringKnowledgeValuesLine,
} from '../lib/engineeringKnowledge'

export default function EngineeringScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const [suites, setSuites] = useState<AtlasEngineeringBenchmarkSuiteSummary[]>([])
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null)
  const [suiteDetail, setSuiteDetail] = useState<AtlasEngineeringBenchmarkSuiteResponse | null>(null)
  const [trends, setTrends] = useState<AtlasEngineeringBenchmarkTrendsResponse | null>(null)
  const [structureAudit, setStructureAudit] = useState<AtlasStructureMotherAuditResponse | null>(null)
  const [pushReplay, setPushReplay] = useState<AtlasMobilePushReplayResponse | null>(null)
  const [selectedRun, setSelectedRun] = useState<AtlasEngineeringBenchmarkRunResponse | null>(null)
  const [selectedEngineeringRunId, setSelectedEngineeringRunId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState('')
  const [testCommand, setTestCommand] = useState('')
  const [model, setModel] = useState('')
  const [modelPolicy, setModelPolicy] = useState<'fixed' | 'balanced' | 'best-quality' | 'fastest' | 'cheapest'>('fixed')
  const [visualE2e, setVisualE2e] = useState<'auto' | 'off' | 'required'>('auto')
  const [qualityScan, setQualityScan] = useState<'off' | 'auto' | 'required'>('auto')
  const [qualityProfile, setQualityProfile] = useState<'fast' | 'standard' | 'release'>('standard')
  const [runMode, setRunMode] = useState<'sensors' | 'host' | 'docker'>('sensors')
  const [sandboxMode, setSandboxMode] = useState<'workspace' | 'worktree' | 'docker'>('workspace')
  const [dockerNetwork, setDockerNetwork] = useState<'profile' | 'none' | 'bridge'>('profile')
  const [dockerService, setDockerService] = useState('')
  const [providerDockerService, setProviderDockerService] = useState('backend')
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [structureAuditLoading, setStructureAuditLoading] = useState(false)
  const [pushReplayRunning, setPushReplayRunning] = useState<'dry_run' | 'apply' | null>(null)
  const [running, setRunning] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [harnessCalibration, setHarnessCalibration] = useState<Record<string, unknown> | null>(null)
  const [calibratingHarness, setCalibratingHarness] = useState(false)
  const [knowledge, setKnowledge] = useState<AtlasEngineeringKnowledgeResponse | null>(null)
  const [codeKnowledge, setCodeKnowledge] = useState<AtlasEngineeringCodeModulesResponse | null>(null)
  const [codeSymbols, setCodeSymbols] = useState<AtlasEngineeringCodeSymbolsResponse | null>(null)
  const [codeAudit, setCodeAudit] = useState<AtlasEngineeringCodeAuditResponse | null>(null)
  const [selectedCodeModule, setSelectedCodeModule] = useState<AtlasEngineeringCodeModuleResponse | null>(null)
  const [selectedKnowledgeItem, setSelectedKnowledgeItem] = useState<AtlasEngineeringKnowledgeItemDetail | null>(null)
  const [knowledgeDetailLoading, setKnowledgeDetailLoading] = useState(false)
  const [codeDetailLoading, setCodeDetailLoading] = useState(false)
  const [syncingKnowledge, setSyncingKnowledge] = useState(false)
  const [indexingCodeKnowledge, setIndexingCodeKnowledge] = useState(false)
  const [auditingCodeKnowledge, setAuditingCodeKnowledge] = useState(false)
  const [toolRuntime, setToolRuntime] = useState<AtlasToolsDoctorResponse | null>(null)
  const [toolAuthority, setToolAuthority] = useState<AtlasToolsAuthorityResponse | null>(null)
  const [toolAuthorityPolicies, setToolAuthorityPolicies] = useState<AtlasToolsAuthorityPoliciesResponse | null>(null)
  const [toolEvidence, setToolEvidence] = useState<AtlasToolsEvidenceResponse | null>(null)
  const [toolGate, setToolGate] = useState<AtlasToolsGateResponse | null>(null)
  const [toolPolicies, setToolPolicies] = useState<AtlasToolsPoliciesResponse | null>(null)
  const [toolGateMode, setToolGateMode] = useState<EngineeringToolGateMode>('observe')
  const [toolRuntimeLoading, setToolRuntimeLoading] = useState(false)
  const [toolActionRunning, setToolActionRunning] = useState<string | null>(null)
  const [apiContractRunning, setApiContractRunning] = useState(false)
  const [codeLayerFilter, setCodeLayerFilter] = useState('')
  const [codeDocsStatusFilter, setCodeDocsStatusFilter] = useState('')
  const [codeSymbolTypeFilter, setCodeSymbolTypeFilter] = useState('')

  const selectedSuiteSummary = useMemo(
    () => suites.find((suite) => suite.slug === selectedSuite || suite.id === selectedSuite) ?? null,
    [selectedSuite, suites],
  )
  const latestRun = selectedRun?.benchmark_run ?? suiteDetail?.latest_runs[0] ?? selectedSuiteSummary?.latest_run ?? null
  const selectedCalibration = suiteDetail?.suite.rollout_calibration ?? selectedSuiteSummary?.rollout_calibration ?? null
  const aggregate = useMemo(() => aggregateSuites(suites), [suites])
  const engineeringRuns = useMemo(
    () => (selectedRun?.results ?? [])
      .map((result) => result.engineering_run)
      .filter((run): run is AtlasEngineeringRunSummary => Boolean(run?.id)),
    [selectedRun],
  )
  const selectedEngineeringRun = useMemo(
    () => engineeringRuns.find((run) => run.id === selectedEngineeringRunId) ?? engineeringRuns[0] ?? null,
    [engineeringRuns, selectedEngineeringRunId],
  )
  const selectedCodeModuleSlug = selectedCodeModule?.module.slug ?? null
  const toolRuntimeSummary = useMemo(
    () => buildEngineeringToolRuntimeSummary(toolRuntime?.tools ?? [], toolEvidence?.data ?? []),
    [toolEvidence, toolRuntime],
  )
  const toolAuthoritySummary = useMemo(
    () => buildEngineeringToolAuthoritySummary(toolAuthority),
    [toolAuthority],
  )
  const toolAuthorityPolicySummary = useMemo(
    () => buildEngineeringToolAuthorityPolicySummary(toolAuthorityPolicies),
    [toolAuthorityPolicies],
  )

  const loadSuites = useCallback(async () => {
    setLoading(true)
    try {
      const response = await listEngineeringBenchmarkSuites({ status: 'active' })
      setSuites(response.suites)
      setSelectedSuite((current) => current ?? response.suites[0]?.slug ?? null)
    } catch {
      setSuites([])
      showToast('Não consegui carregar benchmarks')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const loadSuite = useCallback(async (suite: string | null) => {
    if (!suite) {
      setSuiteDetail(null)
      setTrends(null)
      setSelectedRun(null)
      return
    }

    setDetailLoading(true)
    try {
      const [response, trendResponse] = await Promise.all([
        fetchEngineeringBenchmarkSuite(suite),
        fetchEngineeringBenchmarkTrends(suite, { limit: 30 }),
      ])
      setSuiteDetail(response)
      setTrends(trendResponse)
      const runId = response.latest_runs[0]?.id
      if (runId) {
        const runResponse = await fetchEngineeringBenchmarkRun(runId)
        setSelectedRun(runResponse)
      } else {
        setSelectedRun(null)
      }
    } catch {
      setSuiteDetail(null)
      setTrends(null)
      setSelectedRun(null)
      showToast('Não consegui abrir a suite')
    } finally {
      setDetailLoading(false)
    }
  }, [showToast])

  const loadStructureAudit = useCallback(async (workspaceInput = '') => {
    setStructureAuditLoading(true)
    try {
      const resolvedWorkspace = workspaceInput.trim()
      const response = await fetchAtlasStructureMotherAudit({
        hours: 720,
        workspace: resolvedWorkspace || null,
      })
      setStructureAudit(response)
    } catch {
      setStructureAudit(null)
      showToast('Não consegui carregar estrutura mãe')
    } finally {
      setStructureAuditLoading(false)
    }
  }, [showToast])

  const replayPendingMobilePush = useCallback(async (apply: boolean) => {
    if (apply && (!pushReplay?.push_replay.dry_run || pushReplay.push_replay.candidate_count <= 0)) {
      showToast('Rode o dry-run e revise os candidatos antes de aplicar')
      return
    }

    const run = async () => {
      setPushReplayRunning(apply ? 'apply' : 'dry_run')
      try {
        const response = await replayAtlasMobilePush({
          limit: 50,
          apply,
          confirm_external_dispatch: apply,
          reason: apply ? 'Engineering app operator confirmed pending push replay' : null,
        })
        setPushReplay(response)
        await loadStructureAudit(workspace)
        showToast(apply
          ? `${response.push_replay.dispatched_count} push reprocessado(s)`
          : `${response.push_replay.candidate_count} push pendente(s) no dry-run`)
      } catch {
        showToast(apply ? 'Replay de push não foi aplicado' : 'Dry-run de push falhou')
      } finally {
        setPushReplayRunning(null)
      }
    }

    if (!apply) {
      await run()
      return
    }

    Alert.alert(
      'Disparar push pendente?',
      'Isso pode enviar notificações reais para dispositivos registrados. Use apenas depois de revisar o dry-run.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Disparar', style: 'destructive', onPress: () => { void run() } },
      ],
    )
  }, [loadStructureAudit, pushReplay, showToast, workspace])

  const loadHarnessCalibration = useCallback(async () => {
    try {
      const response = await fetchEngineeringHarnessabilityCalibration()
      setHarnessCalibration(response.harnessability_calibration)
    } catch {
      setHarnessCalibration(null)
    }
  }, [])

  const loadToolRuntime = useCallback(async (workspaceInput = '', gateMode: EngineeringToolGateMode = 'observe') => {
    setToolRuntimeLoading(true)
    try {
      const resolvedWorkspace = workspaceInput.trim()
      const [
        doctorResponse,
        authorityResponse,
        authorityPoliciesResponse,
        evidenceResponse,
        gateResponse,
        policiesResponse,
      ] = await Promise.all([
        fetchAtlasToolsDoctor({ workspace: resolvedWorkspace || null }),
        fetchAtlasToolsAuthority(),
        fetchAtlasToolsAuthorityPolicies({ workspace: resolvedWorkspace || null }),
        listAtlasToolEvidence({ workspace: resolvedWorkspace || null, limit: 8 }),
        evaluateAtlasToolGate(buildToolRuntimeGateFilters({
          workspace: resolvedWorkspace,
          mode: gateMode,
          limit: 8,
        })),
        listAtlasToolPolicies({ workspace: resolvedWorkspace || null, limit: 8 }),
      ])
      setToolRuntime(doctorResponse)
      setToolAuthority(authorityResponse)
      setToolAuthorityPolicies(authorityPoliciesResponse)
      setToolEvidence(evidenceResponse)
      setToolGate(gateResponse)
      setToolPolicies(policiesResponse)
    } catch {
      setToolRuntime(null)
      setToolAuthority(null)
      setToolAuthorityPolicies(null)
      setToolEvidence(null)
      setToolGate(null)
      setToolPolicies(null)
      showToast('Não consegui carregar Tool Runtime')
    } finally {
      setToolRuntimeLoading(false)
    }
  }, [showToast])

  const runApiContract = useCallback(async () => {
    const resolvedWorkspace = workspace.trim()
    if (!resolvedWorkspace) {
      showToast('Informe o workspace antes de rodar API Contract')
      return
    }

    setApiContractRunning(true)
    try {
      const response = await runEngineeringApiContract({
        workspace: resolvedWorkspace,
        strict: toolGateMode === 'release',
        run_context_type: 'engineering_dashboard',
        run_context_id: 'api-contract',
      })
      showToast(`API Contract ${response.status} · ${response.summary.finding_count} findings`)
      await loadToolRuntime(resolvedWorkspace, toolGateMode)
    } catch {
      showToast('API Contract falhou antes de registrar evidência')
    } finally {
      setApiContractRunning(false)
    }
  }, [loadToolRuntime, showToast, toolGateMode, workspace])

  const approveToolFromApp = useCallback(async (tool: {
    slug: string
    executionTier?: string | null
    risks?: string[]
  }) => {
    const resolvedWorkspace = workspace.trim()
    if (!resolvedWorkspace) {
      showToast('Informe o workspace antes de aprovar ferramenta')
      return
    }

    const actionKey = `approve:${tool.slug}`
    setToolActionRunning(actionKey)
    try {
      await approveAtlasTool(tool.slug, {
        workspace: resolvedWorkspace,
        scope_type: 'workspace',
        reason: 'Engineering app operator approval',
        ttl_hours: 2,
        network_allowed: false,
        max_execution_tier: tool.executionTier || 'T1',
        sandbox_mode: tool.risks?.includes('writes_workspace') ? 'worktree' : 'workspace',
        privacy_level: 'standard',
        task_type: 'manual',
        requires_provider_safe: false,
      })
      showToast(`${tool.slug} aprovado por 2h`)
      await loadToolRuntime(resolvedWorkspace, toolGateMode)
    } catch {
      showToast('Não consegui aprovar a ferramenta')
    } finally {
      setToolActionRunning(null)
    }
  }, [loadToolRuntime, showToast, toolGateMode, workspace])

  const revokeToolFromApp = useCallback(async (toolSlug: string) => {
    const resolvedWorkspace = workspace.trim()
    if (!resolvedWorkspace) {
      showToast('Informe o workspace antes de revogar approval')
      return
    }

    const actionKey = `revoke:${toolSlug}`
    setToolActionRunning(actionKey)
    try {
      await revokeAtlasToolApproval(toolSlug, {
        workspace: resolvedWorkspace,
        scope_type: 'workspace',
      })
      showToast(`${toolSlug} revogado`)
      await loadToolRuntime(resolvedWorkspace, toolGateMode)
    } catch {
      showToast('Não consegui revogar a approval')
    } finally {
      setToolActionRunning(null)
    }
  }, [loadToolRuntime, showToast, toolGateMode, workspace])

  const dryRunToolFromApp = useCallback(async (tool: {
    slug: string
    binary: string
    executionTier?: string | null
    safeCommands?: Array<{
      name: string
      category?: string
      command: string[]
      dry_run_default: boolean
      recommended_surface?: string
      creates_evidence?: boolean
      blocking_capable?: boolean
      network_allowed: boolean
      max_execution_tier?: string | null
      sandbox_mode?: string | null
      privacy_level?: string | null
      task_type?: string | null
      requires_provider_safe?: boolean
    }>
  }) => {
    const resolvedWorkspace = workspace.trim()
    if (!resolvedWorkspace) {
      showToast('Informe o workspace antes de rodar dry-run')
      return
    }

    const actionKey = `dry-run:${tool.slug}`
    setToolActionRunning(actionKey)
    try {
      const recipe = tool.safeCommands?.find((command) => command.dry_run_default) ?? tool.safeCommands?.[0]
      const response = await runAtlasToolRecipe(tool.slug, recipe?.name ?? 'version', {
        workspace: resolvedWorkspace,
        dry_run: recipe?.dry_run_default ?? true,
        output_limit: 12000,
      })
      showToast(`Dry-run ${response.data.status}`)
      await loadToolRuntime(resolvedWorkspace, toolGateMode)
    } catch {
      showToast('Não consegui registrar dry-run')
    } finally {
      setToolActionRunning(null)
    }
  }, [loadToolRuntime, showToast, toolGateMode, workspace])

  const hardenAuthorityPolicyFromApp = useCallback(async (policy: AtlasToolAuthorityPolicy) => {
    const resolvedWorkspace = workspace.trim()
    if (!resolvedWorkspace) {
      showToast('Informe o workspace antes de ajustar policy')
      return
    }

    const actionKey = `authority-harden:${policy.authority_group}`
    setToolActionRunning(actionKey)
    try {
      await configureAtlasToolAuthorityPolicy(policy.authority_group, {
        workspace: resolvedWorkspace,
        scope_type: 'workspace',
        policy: `${policy.authority_group}_workspace_medium_blocks`,
        block_severities: ['critical', 'high', 'medium'],
        warn_severities: ['low'],
        block_reason: `workspace_${policy.authority_group}_medium_blocks`,
        warn_reason: `workspace_${policy.authority_group}_low_warns`,
        description: 'Workspace override from Engineering app: medium findings block and low findings warn.',
      })
      showToast(`${policy.authority_group}: medium agora bloqueia`)
      await loadToolRuntime(resolvedWorkspace, toolGateMode)
    } catch {
      showToast('Não consegui ajustar authority policy')
    } finally {
      setToolActionRunning(null)
    }
  }, [loadToolRuntime, showToast, toolGateMode, workspace])

  const revokeAuthorityPolicyFromApp = useCallback(async (policy: AtlasToolAuthorityPolicy) => {
    const resolvedWorkspace = workspace.trim()
    if (!resolvedWorkspace) {
      showToast('Informe o workspace antes de revogar policy')
      return
    }

    const actionKey = `authority-revoke:${policy.authority_group}`
    setToolActionRunning(actionKey)
    try {
      await revokeAtlasToolAuthorityPolicy(policy.authority_group, {
        workspace: resolvedWorkspace,
        scope_type: 'workspace',
      })
      showToast(`${policy.authority_group}: override revogado`)
      await loadToolRuntime(resolvedWorkspace, toolGateMode)
    } catch {
      showToast('Não consegui revogar authority policy')
    } finally {
      setToolActionRunning(null)
    }
  }, [loadToolRuntime, showToast, toolGateMode, workspace])

  const loadKnowledge = useCallback(async () => {
    try {
      const response = await fetchEngineeringKnowledge({ limit: 8 })
      setKnowledge(response)
    } catch {
      setKnowledge(null)
    }
  }, [])

  const loadCodeKnowledge = useCallback(async () => {
    try {
      const response = await fetchEngineeringCodeModules({
        limit: 12,
        layer: codeLayerFilter || undefined,
        docs_status: codeDocsStatusFilter || undefined,
      })
      setCodeKnowledge(response)
    } catch {
      setCodeKnowledge(null)
    }
  }, [codeDocsStatusFilter, codeLayerFilter])

  const loadCodeSymbols = useCallback(async () => {
    try {
      const response = await fetchEngineeringCodeSymbols({
        limit: 16,
        module: selectedCodeModuleSlug ?? undefined,
        symbol_type: codeSymbolTypeFilter || undefined,
      })
      setCodeSymbols(response)
    } catch {
      setCodeSymbols(null)
    }
  }, [codeSymbolTypeFilter, selectedCodeModuleSlug])

  const auditCodeKnowledge = useCallback(async (showResultToast = true) => {
    if (auditingCodeKnowledge) return null

    setAuditingCodeKnowledge(true)
    try {
      const response = await fetchEngineeringCodeAudit({ limit: 12 })
      setCodeAudit(response)
      if (showResultToast) {
        showToast(response.status === 'fresh' ? 'Code intelligence fresh' : 'Drift detectado no código')
      }

      return response
    } catch {
      if (showResultToast) showToast('Não consegui auditar code intelligence')

      return null
    } finally {
      setAuditingCodeKnowledge(false)
    }
  }, [auditingCodeKnowledge, showToast])

  const openKnowledgeItem = useCallback(async (item: string) => {
    setKnowledgeDetailLoading(true)
    try {
      const response = await fetchEngineeringKnowledgeItem(item)
      setSelectedKnowledgeItem(response.knowledge_item)
    } catch {
      showToast('Não consegui abrir knowledge item')
    } finally {
      setKnowledgeDetailLoading(false)
    }
  }, [showToast])

  const openCodeModule = useCallback(async (module: string) => {
    setCodeDetailLoading(true)
    try {
      const [detailResponse, symbolsResponse] = await Promise.all([
        fetchEngineeringCodeModule(module),
        fetchEngineeringCodeSymbols({
          limit: 16,
          module,
          symbol_type: codeSymbolTypeFilter || undefined,
        }),
      ])
      setSelectedCodeModule(detailResponse)
      setCodeSymbols(symbolsResponse)
    } catch {
      showToast('Não consegui abrir módulo de código')
    } finally {
      setCodeDetailLoading(false)
    }
  }, [codeSymbolTypeFilter, showToast])

  useEffect(() => {
    void loadSuites()
    void loadStructureAudit()
    void loadHarnessCalibration()
    void loadToolRuntime()
    void loadKnowledge()
  }, [loadSuites, loadStructureAudit, loadHarnessCalibration, loadKnowledge, loadToolRuntime])

  useEffect(() => {
    void loadCodeKnowledge()
  }, [loadCodeKnowledge])

  useEffect(() => {
    void loadCodeSymbols()
  }, [loadCodeSymbols])

  useEffect(() => {
    void loadSuite(selectedSuite)
  }, [loadSuite, selectedSuite])

  useEffect(() => {
    setSelectedEngineeringRunId((current) => (
      current && engineeringRuns.some((run) => run.id === current)
        ? current
        : engineeringRuns[0]?.id ?? null
    ))
  }, [engineeringRuns])

  const refresh = async () => {
    await Promise.all([
      loadSuites(),
      loadSuite(selectedSuite),
      loadStructureAudit(workspace),
      loadHarnessCalibration(),
      loadToolRuntime(workspace, toolGateMode),
      loadKnowledge(),
      loadCodeKnowledge(),
      loadCodeSymbols(),
    ])
  }

  const runSelectedSuite = async () => {
    if (!selectedSuite || running) return
    const resolvedWorkspace = workspace.trim()
    if (!resolvedWorkspace) {
      showToast('Informe o workspace')
      return
    }

    setRunning(true)
    try {
      const response = await runEngineeringBenchmarkSuite(selectedSuite, {
        workspace: resolvedWorkspace,
        model: model.trim() || null,
        model_policy: model.trim() ? 'fixed' : modelPolicy,
        no_provider: runMode === 'sensors',
        auto_test: true,
        test_command: testCommand.trim() || null,
        visual_e2e: visualE2e,
        quality_scan: qualityScan,
        quality_profile: qualityProfile,
        quality_changed_only: true,
        sandbox: sandboxMode,
        docker_service: sandboxMode === 'docker' ? (dockerService.trim() || null) : null,
        docker_cache: sandboxMode === 'docker' ? 'auto' : null,
        docker_network: sandboxMode === 'docker' ? dockerNetwork : null,
        docker_artifact_paths: sandboxMode === 'docker' ? ['coverage', 'test-results', 'playwright-report', 'reports', 'junit.xml'] : null,
        provider_runtime: runMode === 'docker' ? 'docker' : 'host',
        provider_docker_service: runMode === 'docker' ? (providerDockerService.trim() || 'backend') : null,
        max_attempts: 1,
        release_gate_profile: 'release',
      })
      setSelectedRun(response)
      await loadSuites()
      await loadSuite(selectedSuite)
      showToast(response.benchmark_run.status === 'passed' ? 'Benchmark passou' : 'Benchmark falhou')
    } catch {
      showToast('Não consegui executar benchmark')
    } finally {
      setRunning(false)
    }
  }

  const createDefaultSuite = async () => {
    if (seeding) return

    setSeeding(true)
    try {
      const response = await ensureDefaultEngineeringBenchmarkSuite()
      setSelectedSuite(response.suite.slug)
      await loadSuites()
      await loadSuite(response.suite.slug)
      showToast('Suite padrão criada')
    } catch {
      showToast('Não consegui criar a suite padrão')
    } finally {
      setSeeding(false)
    }
  }

  const calibrateSelectedSuite = async () => {
    if (!selectedSuite || calibrating) return

    setCalibrating(true)
    try {
      const response = await calibrateEngineeringBenchmarkSuite(selectedSuite, { limit: 200 })
      setSuiteDetail(response)
      await loadSuites()
      await loadSuite(selectedSuite)
      showToast('Calibração atualizada')
    } catch {
      showToast('Não consegui calibrar a suite')
    } finally {
      setCalibrating(false)
    }
  }

  const calibrateHarnessability = async () => {
    if (calibratingHarness) return

    setCalibratingHarness(true)
    try {
      const response = await calibrateEngineeringHarnessability({ limit: 300 })
      setHarnessCalibration(response.harnessability_calibration)
      showToast('Harnessability atualizado')
    } catch {
      showToast('Não consegui calibrar harnessability')
    } finally {
      setCalibratingHarness(false)
    }
  }

  const syncKnowledgeBase = async () => {
    if (syncingKnowledge) return

    setSyncingKnowledge(true)
    try {
      const response = await syncEngineeringKnowledge({ prune: true })
      await loadKnowledge()
      setSelectedKnowledgeItem(null)
      const changed = response.summary.created + response.summary.updated + response.summary.archived
      showToast(changed > 0 ? 'Knowledge base sincronizada' : 'Knowledge base atualizada')
    } catch {
      showToast('Não consegui sincronizar knowledge base')
    } finally {
      setSyncingKnowledge(false)
    }
  }

  const indexCodeKnowledge = async () => {
    if (indexingCodeKnowledge) return

    setIndexingCodeKnowledge(true)
    try {
      const response = await indexEngineeringCodeKnowledge({ prune: true })
      await Promise.all([
        loadCodeKnowledge(),
        loadCodeSymbols(),
      ])
      if (selectedCodeModuleSlug) {
        const detailResponse = await fetchEngineeringCodeModule(selectedCodeModuleSlug)
        setSelectedCodeModule(detailResponse)
      }
      await auditCodeKnowledge(false)
      showToast(`${response.summary.module_count} módulos indexados`)
    } catch {
      showToast('Não consegui indexar code intelligence')
    } finally {
      setIndexingCodeKnowledge(false)
    }
  }

  return (
    <Screen
      topExtra={22}
      refreshControl={<RefreshControl refreshing={loading || detailLoading} onRefresh={() => { void refresh() }} />}
    >
      <CodexReveal index={0}>
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label>Engineering Harness</Label>
            <Sans weight="sb" size={23} lineHeight={29} color={c.ink}>
              Atlas-Bench
            </Sans>
            <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
              Laboratório interno de qualidade, regressão, gates e promoção de cases.
            </Mono>
          </View>
          <StatusPill status={aggregate.status} />
        </View>
      </CodexReveal>

      <CodexReveal index={1}>
        <View style={styles.metrics}>
          <Metric label="suites" value={String(suites.length)} />
          <Metric label="pass rate" value={aggregate.passRate == null ? '-' : `${aggregate.passRate}%`} tone={aggregate.status} />
          <Metric label="score" value={aggregate.averageScore == null ? '-' : String(aggregate.averageScore)} />
        </View>
      </CodexReveal>

      <CodexReveal index={2}>
        <BenchMissionCard
          aggregate={aggregate}
          latestRun={latestRun}
          suitesCount={suites.length}
          onOpenRivals={() => router.push('/rivals')}
        />
      </CodexReveal>

      <CodexReveal index={3}>
        <StructureMotherActionPlanCard
          audit={structureAudit}
          pushReplay={pushReplay}
          loading={structureAuditLoading}
          pushReplayRunning={pushReplayRunning}
          onRefresh={() => { void loadStructureAudit(workspace) }}
          onOpenInbox={() => router.push('/inbox')}
          onOpenRivals={() => router.push('/rivals')}
          onReplayPush={(apply) => { void replayPendingMobilePush(apply) }}
        />
      </CodexReveal>

      <CodexReveal index={4}>
        <HarnessabilityCalibrationCard
          calibration={harnessCalibration}
          calibrating={calibratingHarness}
          onCalibrate={() => { void calibrateHarnessability() }}
        />
      </CodexReveal>

      <KnowledgeBaseCard
        knowledge={knowledge}
        codeKnowledge={codeKnowledge}
        codeSymbols={codeSymbols}
        codeAudit={codeAudit}
        selectedItem={selectedKnowledgeItem}
        selectedCodeModule={selectedCodeModule}
        detailLoading={knowledgeDetailLoading}
        codeDetailLoading={codeDetailLoading}
        syncing={syncingKnowledge}
        indexingCode={indexingCodeKnowledge}
        auditingCode={auditingCodeKnowledge}
        codeLayerFilter={codeLayerFilter}
        codeDocsStatusFilter={codeDocsStatusFilter}
        codeSymbolTypeFilter={codeSymbolTypeFilter}
        onOpenItem={(item) => { void openKnowledgeItem(item) }}
        onCloseItem={() => setSelectedKnowledgeItem(null)}
        onOpenCodeModule={(module) => { void openCodeModule(module) }}
        onCloseCodeModule={() => setSelectedCodeModule(null)}
        onChangeCodeLayer={setCodeLayerFilter}
        onChangeCodeDocsStatus={setCodeDocsStatusFilter}
        onChangeCodeSymbolType={setCodeSymbolTypeFilter}
        onSync={() => { void syncKnowledgeBase() }}
        onIndexCode={() => { void indexCodeKnowledge() }}
        onAuditCode={() => { void auditCodeKnowledge() }}
      />

      <ToolRuntimeCard
        runtime={toolRuntime}
        authority={toolAuthority}
        authorityPolicies={toolAuthorityPolicies}
        evidence={toolEvidence}
        gate={toolGate}
        policies={toolPolicies}
        gateMode={toolGateMode}
        summary={toolRuntimeSummary}
        authoritySummary={toolAuthoritySummary}
        authorityPolicySummary={toolAuthorityPolicySummary}
        loading={toolRuntimeLoading}
        actionRunning={toolActionRunning}
        apiContractRunning={apiContractRunning}
        onGateModeChange={(mode) => {
          setToolGateMode(mode)
          void loadToolRuntime(workspace, mode)
        }}
        onRefresh={() => { void loadToolRuntime(workspace, toolGateMode) }}
        onApproveTool={(tool) => { void approveToolFromApp(tool) }}
        onRevokeTool={(toolSlug) => { void revokeToolFromApp(toolSlug) }}
        onDryRunTool={(tool) => { void dryRunToolFromApp(tool) }}
        onHardenAuthorityPolicy={(policy) => { void hardenAuthorityPolicyFromApp(policy) }}
        onRevokeAuthorityPolicy={(policy) => { void revokeAuthorityPolicyFromApp(policy) }}
        onRunApiContract={() => { void runApiContract() }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suiteRail}>
        {suites.map((suite) => (
          <SuiteButton
            key={suite.id}
            suite={suite}
            active={suite.slug === selectedSuite || suite.id === selectedSuite}
            onPress={() => setSelectedSuite(suite.slug)}
          />
        ))}
      </ScrollView>

      {suites.length === 0 && !loading ? (
        <View style={[styles.emptyState, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Sans weight="sb" size={14} lineHeight={20} color={c.ink}>
            Nenhuma suite ativa
          </Sans>
          <Sans size={12.5} lineHeight={18} color={c.ink2}>
            Crie suites pela API ou CLI para acompanhar regressões do runner.
          </Sans>
          <Pressable
            disabled={seeding}
            onPress={() => { void createDefaultSuite() }}
            style={({ pressed }) => [
              styles.seedButton,
              {
                borderColor: c.border,
                backgroundColor: seeding ? c.bg : c.premium,
                opacity: pressed && !seeding ? 0.84 : 1,
              },
            ]}
          >
            <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
              {seeding ? 'Criando' : 'Criar suite padrão'}
            </Sans>
          </Pressable>
        </View>
      ) : null}

      {suiteDetail ? (
        <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
          <View style={styles.panelTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label>Suite</Label>
              <Sans weight="sb" size={16} lineHeight={22} color={c.ink} numberOfLines={2}>
                {suiteDetail.suite.name}
              </Sans>
              <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
                {suiteDetail.suite.slug}
              </Mono>
            </View>
            <StatusPill status={latestRun?.status ?? suiteDetail.suite.status} />
          </View>

          <View style={styles.metricsCompact}>
            <Metric label="cases" value={String(suiteDetail.cases.length)} />
            <Metric label="runs" value={String(suiteDetail.latest_runs.length)} />
            <Metric label="último" value={latestRun?.pass_rate == null ? '-' : `${latestRun.pass_rate}%`} tone={latestRun?.status} />
          </View>

          <View style={styles.formBlock}>
            <Label>Workspace</Label>
            <TextInput
              value={workspace}
              onChangeText={setWorkspace}
              placeholder="/path/do/repo"
              placeholderTextColor={c.ink3}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
            />
            <Label>Teste</Label>
            <TextInput
              value={testCommand}
              onChangeText={setTestCommand}
              placeholder="php artisan test ..."
              placeholderTextColor={c.ink3}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
            />
            <Label>Visual/E2E</Label>
            <Segmented
              value={visualE2e}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'off', label: 'Off' },
                { value: 'required', label: 'Obrigatório' },
              ]}
              onChange={(value) => setVisualE2e(value as 'auto' | 'off' | 'required')}
            />
            <Label>Quality scan</Label>
            <Segmented
              value={qualityScan}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'auto', label: 'Auto' },
                { value: 'required', label: 'Obrigatório' },
              ]}
              onChange={(value) => setQualityScan(value as 'off' | 'auto' | 'required')}
            />
            {qualityScan !== 'off' ? (
              <>
                <Label>Perfil quality</Label>
                <Segmented
                  value={qualityProfile}
                  options={[
                    { value: 'fast', label: 'Rápido' },
                    { value: 'standard', label: 'Padrão' },
                    { value: 'release', label: 'Release' },
                  ]}
                  onChange={(value) => setQualityProfile(value as 'fast' | 'standard' | 'release')}
                />
              </>
            ) : null}
            <Label>Runtime de execução</Label>
            <Segmented
              value={runMode}
              options={[
                { value: 'sensors', label: 'Sensores' },
                { value: 'host', label: 'Host' },
                { value: 'docker', label: 'Docker' },
              ]}
              onChange={(value) => setRunMode(value as 'sensors' | 'host' | 'docker')}
            />
            <Label>Modelo do runner Atlas</Label>
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder="modelo usado pelo runner interno"
              placeholderTextColor={c.ink3}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
            />
            <Label>Política de modelo</Label>
            <Segmented
              value={modelPolicy}
              options={[
                { value: 'fixed', label: 'Fixo' },
                { value: 'balanced', label: 'Auto' },
                { value: 'best-quality', label: 'Qualidade' },
                { value: 'fastest', label: 'Rápido' },
                { value: 'cheapest', label: 'Custo' },
              ]}
              onChange={(value) => setModelPolicy(value as 'fixed' | 'balanced' | 'best-quality' | 'fastest' | 'cheapest')}
            />
            <Label>Sandbox</Label>
            <Segmented
              value={sandboxMode}
              options={[
                { value: 'workspace', label: 'Workspace' },
                { value: 'worktree', label: 'Worktree' },
                { value: 'docker', label: 'Docker' },
              ]}
              onChange={(value) => setSandboxMode(value as 'workspace' | 'worktree' | 'docker')}
            />
            {sandboxMode === 'docker' ? (
              <>
                <TextInput
                  value={dockerService}
                  onChangeText={setDockerService}
                  placeholder="service do repo"
                  placeholderTextColor={c.ink3}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
                />
                <Label>Rede Docker</Label>
                <Segmented
                  value={dockerNetwork}
                  options={[
                    { value: 'profile', label: 'Perfil' },
                    { value: 'none', label: 'Sem rede' },
                    { value: 'bridge', label: 'Bridge' },
                  ]}
                  onChange={(value) => setDockerNetwork(value as 'profile' | 'none' | 'bridge')}
                />
              </>
            ) : null}
            {runMode === 'docker' ? (
              <TextInput
                value={providerDockerService}
                onChangeText={setProviderDockerService}
                placeholder="backend"
                placeholderTextColor={c.ink3}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
              />
            ) : null}
            <View style={styles.buttonRow}>
              <Pressable
                disabled={running}
                onPress={() => { void runSelectedSuite() }}
                style={({ pressed }) => [
                  styles.runButton,
                  {
                    backgroundColor: running ? c.ink3 : c.prussian,
                    transform: [{ scale: pressed && !running ? 0.98 : 1 }],
                  },
                ]}
              >
                <Sans weight="sb" size={13} lineHeight={18} color={c.onInk}>
                  {running ? 'Executando' : 'Rodar Bench interno'}
                </Sans>
              </Pressable>
              <Pressable
                disabled={calibrating}
                onPress={() => { void calibrateSelectedSuite() }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: c.border,
                    backgroundColor: calibrating ? c.bg : c.surface,
                    opacity: pressed && !calibrating ? 0.82 : 1,
                  },
                ]}
              >
                <Sans weight="sb" size={13} lineHeight={18} color={c.ink}>
                  {calibrating ? 'Calibrando' : 'Calibrar'}
                </Sans>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {selectedCalibration ? <CalibrationCard calibration={selectedCalibration} /> : null}

      {latestRun ? <RunCard run={latestRun} /> : null}

      {trends?.runs?.length ? <TrendList runs={trends.runs} /> : null}

      {selectedRun?.results?.length ? (
        <View style={styles.resultsList}>
          <View style={styles.sectionHead}>
            <Label>Resultados</Label>
            <Mono size={10.5} lineHeight={14} color={c.ink2}>
              {selectedRun.results.filter((result) => result.passed).length}/{selectedRun.results.length}
            </Mono>
          </View>
          {selectedRun.results.map((result) => (
            <ResultRow
              key={result.id}
              result={result}
              active={Boolean(result.engineering_run?.id && result.engineering_run.id === selectedEngineeringRun?.id)}
              onPress={result.engineering_run?.id ? () => setSelectedEngineeringRunId(result.engineering_run?.id ?? null) : undefined}
            />
          ))}
        </View>
      ) : null}

      {selectedEngineeringRun ? <EngineeringRunDetail run={selectedEngineeringRun} workspace={workspace} model={model} modelPolicy={modelPolicy} qualityScan={qualityScan} qualityProfile={qualityProfile} /> : null}

      {suiteDetail?.cases?.length ? (
        <View style={styles.resultsList}>
          <View style={styles.sectionHead}>
            <Label>Cases</Label>
            <Mono size={10.5} lineHeight={14} color={c.ink2}>
              {suiteDetail.cases.length}
            </Mono>
          </View>
          {suiteDetail.cases.slice(0, 12).map((benchmarkCase) => (
            <View key={benchmarkCase.id} style={[styles.caseRow, { borderColor: c.border }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Sans weight="med" size={12.5} lineHeight={18} color={c.ink} numberOfLines={1}>
                  {benchmarkCase.title}
                </Sans>
                <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
                  {benchmarkCase.case_code} · {benchmarkCase.corpus_tier ?? 'smoke'} · {benchmarkCase.risk_profile ?? 'medium'} · min {benchmarkCase.min_score} · {benchmarkCase.expected_decision ?? 'resolved'}
                </Mono>
              </View>
              <StatusPill status={benchmarkCase.status} compact />
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  )
}

function SuiteButton({
  suite,
  active,
  onPress,
}: {
  suite: AtlasEngineeringBenchmarkSuiteSummary
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()
  const latest = suite.latest_run

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.suiteButton,
        {
          borderColor: active ? c.bronze : c.border,
          backgroundColor: active ? c.premium : c.surface,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink} numberOfLines={1}>
        {suite.name}
      </Sans>
      <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
        {suite.cases_count} cases · {latest?.pass_rate == null ? '-' : `${latest.pass_rate}%`}
      </Mono>
    </Pressable>
  )
}

function BenchMissionCard({
  aggregate,
  latestRun,
  onOpenRivals,
  suitesCount,
}: {
  aggregate: { status: string; passRate: number | null; averageScore: number | null }
  latestRun: AtlasEngineeringBenchmarkRunSummary | null
  onOpenRivals: () => void
  suitesCount: number
}) {
  const c = usePalette()
  const qualityDebtValue = latestRun ? qualityDebt(latestRun) : null
  const failedTests = latestRun?.failed_test_count ?? 0
  const failedControls = (latestRun?.failed_control_count ?? 0) + (latestRun?.blocked_control_count ?? 0)
  const decision = latestRun
    ? latestRun.release_gate_status === 'passed'
      ? 'Bench interno saudável para esta suite.'
      : 'Bench encontrou dívida interna antes de qualquer claim.'
    : 'Sem run interno recente para medir regressão.'

  return (
    <View style={[styles.panel, { borderColor: statusColor(aggregate.status, c), backgroundColor: c.surface }]}>
      <View style={styles.panelTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Atlas-Bench</Label>
          <Sans weight="sb" size={17} lineHeight={23} color={c.ink}>
            Qualidade interna, regressão e release gates
          </Sans>
          <Sans size={12} lineHeight={17} color={c.ink2}>
            Bench não compara Atlas contra rivais. Ele mede se o próprio Atlas está correto, repetível, auditável e pronto para evoluir.
          </Sans>
        </View>
        <StatusPill status={aggregate.status} />
      </View>

      <View style={styles.metricsCompact}>
        <Metric label="suites" value={String(suitesCount)} />
        <Metric label="pass rate" value={aggregate.passRate == null ? '-' : `${aggregate.passRate}%`} tone={aggregate.status} />
        <Metric label="score" value={aggregate.averageScore == null ? '-' : String(aggregate.averageScore)} />
      </View>
      <View style={styles.metricsCompact}>
        <Metric label="dívida" value={qualityDebtValue == null ? '-' : String(qualityDebtValue)} tone={qualityDebtValue ? 'warning' : 'passed'} />
        <Metric label="testes falhos" value={String(failedTests)} tone={failedTests ? 'failed' : 'passed'} />
        <Metric label="controles" value={String(failedControls)} tone={failedControls ? 'failed' : 'passed'} />
      </View>

      <View style={[styles.gateBox, { borderColor: c.border, backgroundColor: c.bg }]}>
        <Label>Como usar</Label>
        <Sans size={11.8} lineHeight={17} color={c.ink2}>
          Use Atlas-Bench para validar mudanças do Atlas, detectar regressões, calibrar harnessability, promover runs reais para cases e bloquear release quando gates internos falham.
        </Sans>
        <Sans weight="sb" size={12.2} lineHeight={17} color={statusColor(latestRun?.release_gate_status ?? aggregate.status, c)}>
          {decision}
        </Sans>
      </View>

      <View style={styles.rivalsActions}>
        <Pressable
          onPress={onOpenRivals}
          style={({ pressed }) => [
            styles.inlineButton,
            {
              borderColor: c.border,
              backgroundColor: pressed ? c.premium : c.surface,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
            Abrir Atlas Rivals
          </Sans>
        </Pressable>
        <Sans size={11.2} lineHeight={16} color={c.ink2} style={{ flex: 1 }}>
          Rivals é a arena comparativa contra provedores; Bench é o laboratório interno.
        </Sans>
      </View>
    </View>
  )
}

function StructureMotherActionPlanCard({
  audit,
  pushReplay,
  loading,
  pushReplayRunning,
  onRefresh,
  onOpenInbox,
  onOpenRivals,
  onReplayPush,
}: {
  audit: AtlasStructureMotherAuditResponse | null
  pushReplay: AtlasMobilePushReplayResponse | null
  loading: boolean
  pushReplayRunning: 'dry_run' | 'apply' | null
  onRefresh: () => void
  onOpenInbox: () => void
  onOpenRivals: () => void
  onReplayPush: (apply: boolean) => void
}) {
  const c = usePalette()
  const report = audit?.structure_mother_audit
  const summary = report?.summary
  const plan = report?.operator_action_plan
  const actionSummary = plan?.action_summary
  const actions = plan?.actions ?? []
  const blockers = report?.blockers ?? []
  const status = report?.status ?? (loading ? 'running' : 'missing')
  const pushAction = actions.find((action) => action.id === 'replay_pending_mobile_push_dispatches')
  const criticalAction = actions.find((action) => action.id === 'review_critical_proactive_insights')
  const rivalsAction = actions.find((action) => action.id === 'record_real_rivals_review_when_due')
  const diagnostics = objectValue(pushAction?.diagnostics)

  return (
    <View style={[styles.panel, { borderColor: statusColor(status, c), backgroundColor: c.surface }]}>
      <View style={styles.panelTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Estrutura mãe</Label>
          <Sans weight="sb" size={16} lineHeight={22} color={c.ink}>
            Plano operacional
          </Sans>
          <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
            {report?.generated_at ? dateLabel(report.generated_at) : (loading ? 'carregando' : 'sem auditoria')}
          </Mono>
        </View>
        <View style={styles.statusStack}>
          <StatusPill status={status} />
          <StatusPill status={report?.completion_gate.update_goal_allowed ? 'release_ready' : 'blocked'} compact />
        </View>
      </View>

      <View style={styles.metricsCompact}>
        <Metric label="módulos prontos" value={`${summary?.ready_count ?? 0}/${summary?.module_count ?? 8}`} tone={summary?.ready_count === summary?.module_count ? 'passed' : 'warning'} />
        <Metric label="bloqueios" value={String(summary?.operational_blocker_count ?? blockers.length)} tone={blockers.length ? 'blocked' : 'passed'} />
        <Metric label="ações" value={String(plan?.action_count ?? actions.length)} tone={actions.length ? 'warning' : 'passed'} />
      </View>
      <View style={styles.metricsCompact}>
        <Metric label="insights" value={String(numberValue(criticalAction?.critical_item_count) ?? numberValue(criticalAction?.critical_active_count) ?? 0)} tone={criticalAction ? 'blocked' : 'passed'} />
        <Metric label="agora" value={String(actionSummary?.actionable_now_count ?? actions.filter((action) => action.actionable_now === true).length)} tone={(actionSummary?.actionable_now_count ?? 0) > 0 ? 'warning' : 'passed'} />
        <Metric label="calendário" value={String(actionSummary?.calendar_wait_count ?? (rivalsAction ? 1 : 0))} tone={(actionSummary?.calendar_wait_count ?? 0) > 0 ? 'pending' : 'passed'} />
      </View>
      {pushAction ? (
        <View style={styles.metricsCompact}>
          <Metric label="push pendente" value={String(numberValue(diagnostics.push_token_device_count) ?? '-')} tone="warning" />
          <Metric label="efeito externo" value={String(actionSummary?.external_effect_action_count ?? 1)} tone="warning" />
          <Metric label="próximo prazo" value={actionSummary?.next_calendar_due_at ? dateLabel(actionSummary.next_calendar_due_at) : '-'} tone={rivalsAction ? 'pending' : 'passed'} />
        </View>
      ) : null}

      {actions.length ? (
        <View style={styles.auditSection}>
          <View style={styles.sectionHead}>
            <Label>Ações pendentes</Label>
            <Mono size={10.5} lineHeight={14} color={c.ink2}>{actions.length}</Mono>
          </View>
          {actions.slice(0, 5).map((action) => (
            <StructureMotherActionRow
              key={action.id}
              action={action}
              pushReplayRunning={pushReplayRunning}
              canApplyPushReplay={Boolean(pushReplay?.push_replay.dry_run && pushReplay.push_replay.candidate_count > 0)}
              onOpenInbox={onOpenInbox}
              onOpenRivals={onOpenRivals}
              onReplayPush={onReplayPush}
            />
          ))}
        </View>
      ) : (
        <View style={[styles.gateBox, { borderColor: c.moss, backgroundColor: c.bg }]}>
          <Sans size={11.5} lineHeight={16} color={c.ink2}>
            Sem ação humana pendente nesta auditoria.
          </Sans>
        </View>
      )}

      {blockers.length ? (
        <View style={[styles.gateBox, { borderColor: c.bronze, backgroundColor: c.bg }]}>
          <Label>Bloqueios reais</Label>
          {blockers.slice(0, 6).map((blocker) => (
            <Mono key={`${blocker.module_id}:${blocker.blocker}`} size={10.3} lineHeight={14} letterSpacing={0.1} color={c.bronze}>
              {blocker.module}: {blocker.blocker}
            </Mono>
          ))}
        </View>
      ) : null}

      {pushReplay ? (
        <View style={[styles.gateBox, { borderColor: pushReplay.push_replay.dry_run ? c.bronze : c.moss, backgroundColor: c.bg }]}>
          <Label>Replay push</Label>
          <Mono size={10.4} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
            {pushReplay.push_replay.dry_run ? 'dry-run' : 'aplicado'} · candidatos {pushReplay.push_replay.candidate_count} · enviados {pushReplay.push_replay.dispatched_count}
          </Mono>
        </View>
      ) : null}

      <View style={styles.rivalsActions}>
        <Pressable
          onPress={onOpenInbox}
          style={({ pressed }) => [
            styles.inlineButton,
            {
              borderColor: c.border,
              backgroundColor: pressed ? c.premium : c.surface,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
            Inbox crítico
          </Sans>
        </Pressable>
        <Pressable
          onPress={onRefresh}
          disabled={loading}
          style={({ pressed }) => [
            styles.inlineButton,
            {
              borderColor: c.border,
              backgroundColor: loading ? c.bg : c.surface,
              opacity: pressed && !loading ? 0.82 : 1,
            },
          ]}
        >
          <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
            {loading ? 'Auditando' : 'Atualizar'}
          </Sans>
        </Pressable>
      </View>
    </View>
  )
}

function StructureMotherActionRow({
  action,
  pushReplayRunning,
  canApplyPushReplay,
  onOpenInbox,
  onOpenRivals,
  onReplayPush,
}: {
  action: AtlasStructureMotherAuditAction
  pushReplayRunning: 'dry_run' | 'apply' | null
  canApplyPushReplay: boolean
  onOpenInbox: () => void
  onOpenRivals: () => void
  onReplayPush: (apply: boolean) => void
}) {
  const c = usePalette()
  const command = action.dry_run_command ?? action.list_command ?? action.list_missing_command ?? action.record_command ?? null
  const metaParts = [
    action.type,
    action.due_at ?? action.review_due_at ?? action.current_due_at ? `vence ${dateLabel(action.due_at ?? action.review_due_at ?? action.current_due_at)}` : null,
    action.operator_required ? 'humano obrigatório' : null,
  ].filter(Boolean)
  const target = action.id === 'review_critical_proactive_insights'
    ? 'inbox'
    : (action.id === 'record_real_rivals_review_when_due' ? 'rivals' : null)

  return (
    <View style={[styles.auditRow, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={12.2} lineHeight={17} color={c.ink} numberOfLines={1}>
          {structureActionTitle(action)}
        </Sans>
        <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
          {metaParts.join(' · ') || action.id}
        </Mono>
        {command ? (
          <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
            {command}
          </Mono>
        ) : null}
      </View>
      <View style={styles.rowActions}>
        <StatusPill status={action.status} compact />
        {action.id === 'replay_pending_mobile_push_dispatches' ? (
          <>
            <Pressable
              disabled={Boolean(pushReplayRunning)}
              onPress={() => onReplayPush(false)}
              style={({ pressed }) => [
                styles.inlineButtonTiny,
                {
                  borderColor: c.border,
                  backgroundColor: pushReplayRunning === 'dry_run' ? c.bg : (pressed ? c.premium : c.surface),
                  opacity: pushReplayRunning ? 0.55 : 1,
                },
              ]}
            >
              <Sans weight="sb" size={10.5} lineHeight={14} color={c.ink}>
                {pushReplayRunning === 'dry_run' ? 'Checando' : 'Dry-run'}
              </Sans>
            </Pressable>
            <Pressable
              disabled={Boolean(pushReplayRunning) || !canApplyPushReplay}
              onPress={() => onReplayPush(true)}
              style={({ pressed }) => [
                styles.inlineButtonTiny,
                {
                  borderColor: c.recRed,
                  backgroundColor: pushReplayRunning === 'apply' ? c.bg : (pressed ? c.premium : c.surface),
                  opacity: pushReplayRunning || !canApplyPushReplay ? 0.45 : 1,
                },
              ]}
            >
              <Sans weight="sb" size={10.5} lineHeight={14} color={c.recRed}>
                {pushReplayRunning === 'apply' ? 'Enviando' : 'Aplicar'}
              </Sans>
            </Pressable>
          </>
        ) : null}
        {target ? (
          <Pressable
            onPress={target === 'inbox' ? onOpenInbox : onOpenRivals}
            style={({ pressed }) => [
              styles.inlineButtonTiny,
              {
                borderColor: c.border,
                backgroundColor: pressed ? c.premium : c.surface,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            <Sans weight="sb" size={10.5} lineHeight={14} color={c.ink}>
              Abrir
            </Sans>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

function structureActionTitle(action: AtlasStructureMotherAuditAction): string {
  switch (action.id) {
    case 'review_critical_proactive_insights':
      return `Revisar ${numberValue(action.critical_item_count) ?? numberValue(action.critical_active_count) ?? 0} insights críticos`
    case 'replay_pending_mobile_push_dispatches':
      return 'Reprocessar push pendente'
    case 'record_real_rivals_review_when_due':
      return 'Registrar revisão real do Rivals'
    case 'configure_missing_provider_cost_rates':
      return `Configurar ${action.missing_rate_count ?? 0} custos de provider`
    default:
      return action.id.replaceAll('_', ' ')
  }
}

function CalibrationCard({ calibration }: { calibration: Record<string, unknown> }) {
  const c = usePalette()
  const policy = objectValue(calibration.recommended_policy)
  const status = textValue(calibration.status, 'unknown')
  const confidence = textValue(calibration.confidence, 'none')
  const totalOutcomes = numberValue(calibration.total_outcomes)
  const badRate = numberValue(calibration.bad_outcome_rate)
  const quarantineCandidates = Array.isArray(calibration.quarantine_candidates) ? calibration.quarantine_candidates.length : 0
  const riskOverrides = Array.isArray(calibration.risk_overrides) ? calibration.risk_overrides.length : 0

  return (
    <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.panelTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Calibração</Label>
          <Sans weight="sb" size={15} lineHeight={21} color={c.ink}>
            {statusLabel(status)} · {confidence}
          </Sans>
          <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
            {dateLabel(textValue(calibration.generated_at, null))}
          </Mono>
        </View>
        <StatusPill status={status} />
      </View>
      <View style={styles.metricsCompact}>
        <Metric label="outcomes" value={totalOutcomes == null ? '-' : String(totalOutcomes)} tone={status} />
        <Metric label="bad rate" value={badRate == null ? '-' : `${badRate}%`} tone={badRate && badRate > 0 ? 'warning' : 'passed'} />
        <Metric label="overrides" value={String(riskOverrides)} tone={riskOverrides > 0 ? 'warning' : 'passed'} />
        <Metric label="quarentena" value={String(quarantineCandidates)} tone={quarantineCandidates > 0 ? 'warning' : 'passed'} />
      </View>
      <View style={styles.metricsCompact}>
        <Metric label="passou gate" value={statusLabel(textValue(policy.default_status_after_passed_gate, 'unknown'))} tone={textValue(policy.default_status_after_passed_gate, null)} />
        <Metric label="aviso gate" value={statusLabel(textValue(policy.default_status_after_warning_gate, 'unknown'))} tone={textValue(policy.default_status_after_warning_gate, null)} />
        <Metric label="sla outcome" value={`${numberValue(policy.outcome_required_within_hours) ?? '-'}h`} />
        <Metric label="min saudável" value={String(numberValue(policy.healthy_outcome_min_score) ?? '-')} />
      </View>
    </View>
  )
}

function KnowledgeBaseCard({
  knowledge,
  codeKnowledge,
  codeSymbols,
  codeAudit,
  selectedItem,
  selectedCodeModule,
  detailLoading,
  codeDetailLoading,
  syncing,
  indexingCode,
  auditingCode,
  codeLayerFilter,
  codeDocsStatusFilter,
  codeSymbolTypeFilter,
  onOpenItem,
  onCloseItem,
  onOpenCodeModule,
  onCloseCodeModule,
  onChangeCodeLayer,
  onChangeCodeDocsStatus,
  onChangeCodeSymbolType,
  onSync,
  onIndexCode,
  onAuditCode,
}: {
  knowledge: AtlasEngineeringKnowledgeResponse | null
  codeKnowledge: AtlasEngineeringCodeModulesResponse | null
  codeSymbols: AtlasEngineeringCodeSymbolsResponse | null
  codeAudit: AtlasEngineeringCodeAuditResponse | null
  selectedItem: AtlasEngineeringKnowledgeItemDetail | null
  selectedCodeModule: AtlasEngineeringCodeModuleResponse | null
  detailLoading: boolean
  codeDetailLoading: boolean
  syncing: boolean
  indexingCode: boolean
  auditingCode: boolean
  codeLayerFilter: string
  codeDocsStatusFilter: string
  codeSymbolTypeFilter: string
  onOpenItem: (item: string) => void
  onCloseItem: () => void
  onOpenCodeModule: (module: string) => void
  onCloseCodeModule: () => void
  onChangeCodeLayer: (value: string) => void
  onChangeCodeDocsStatus: (value: string) => void
  onChangeCodeSymbolType: (value: string) => void
  onSync: () => void
  onIndexCode: () => void
  onAuditCode: () => void
}) {
  const c = usePalette()
  const summary = knowledge?.summary
  const codeSummary = codeKnowledge?.summary
  const items = knowledge?.items ?? []
  const modules = codeKnowledge?.modules ?? []
  const symbols = codeSymbols?.symbols ?? []
  const categories = summary?.categories ?? {}
  const status = summary?.status ?? 'unknown'
  const codeStatus = codeSummary?.status ?? 'unknown'
  const auditStatus = codeAudit?.status ?? 'not_audited'
  const auditDrift = codeAudit?.summary.drift
  const auditModuleDrift = auditDrift
    ? auditDrift.modules.missing_in_index + auditDrift.modules.removed_from_workspace + auditDrift.modules.changed
    : null
  const auditSymbolDrift = auditDrift
    ? auditDrift.symbols.added + auditDrift.symbols.removed
    : null
  const auditDocLinkDrift = auditDrift
    ? auditDrift.doc_links.missing_targets + auditDrift.doc_links.stale_target_hashes
    : null

  return (
    <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.panelTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Engineering knowledge</Label>
          <Sans weight="sb" size={15} lineHeight={21} color={c.ink}>
            {statusLabel(status)} · {summary?.active ?? 0}/{summary?.total ?? 0}
          </Sans>
          <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
            {summary?.docs_root ?? 'docs/engineering-knowledge-base'}
          </Mono>
        </View>
        <View style={{ gap: 8 }}>
          <Pressable
            disabled={syncing}
            onPress={onSync}
            style={({ pressed }) => [
              styles.inlineButton,
              {
                borderColor: c.border,
                backgroundColor: syncing ? c.bg : c.surface,
                opacity: pressed && !syncing ? 0.82 : 1,
              },
            ]}
          >
            <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
              {syncing ? 'Sync' : 'Sincronizar'}
            </Sans>
          </Pressable>
          <Pressable
            disabled={indexingCode}
            onPress={onIndexCode}
            style={({ pressed }) => [
              styles.inlineButton,
              {
                borderColor: c.border,
                backgroundColor: indexingCode ? c.bg : c.surface,
                opacity: pressed && !indexingCode ? 0.82 : 1,
              },
            ]}
          >
            <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
              {indexingCode ? 'Indexando' : 'Indexar código'}
            </Sans>
          </Pressable>
        </View>
      </View>
      <View style={styles.metricsCompact}>
        <Metric label="docs" value={String(summary?.canonical_doc_count ?? 0)} tone={status} />
        <Metric label="ativos" value={String(summary?.active ?? 0)} tone={status} />
        <Metric label="categorias" value={String(Object.keys(categories).length)} />
        <Metric label="indexado" value={summary?.last_indexed_at ? 'sim' : '-'} tone={summary?.last_indexed_at ? 'passed' : 'warning'} />
      </View>
      <View style={styles.metricsCompact}>
        <Metric label="módulos" value={String(codeSummary?.module_count ?? 0)} tone={codeStatus} />
        <Metric label="símbolos" value={String(codeSummary?.symbol_count ?? 0)} tone={codeStatus} />
        <Metric label="rotas" value={String(codeSummary?.route_count ?? 0)} />
        <Metric label="doc links" value={String(codeSummary?.doc_link_count ?? 0)} tone={(codeSummary?.doc_link_count ?? 0) > 0 ? 'passed' : 'warning'} />
      </View>
      <View style={[styles.gateBox, { borderColor: statusColor(auditStatus, c), backgroundColor: c.bg }]}>
        <View style={styles.panelTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label>Code audit</Label>
            <Sans weight="sb" size={13.5} lineHeight={19} color={c.ink} numberOfLines={1}>
              {engineeringCodeAuditStatusLabel(codeAudit)}
            </Sans>
            <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
              {engineeringCodeAuditDriftLine(codeAudit)}
            </Mono>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <StatusPill status={auditStatus} compact />
            <Pressable
              disabled={auditingCode}
              onPress={onAuditCode}
              style={({ pressed }) => [
                styles.inlineButton,
                {
                  borderColor: c.border,
                  backgroundColor: auditingCode ? c.surface : c.premium,
                  opacity: pressed && !auditingCode ? 0.82 : 1,
                },
              ]}
            >
              <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
                {auditingCode ? 'Auditando' : 'Auditar'}
              </Sans>
            </Pressable>
          </View>
        </View>
        <View style={styles.metricsCompact}>
          <Metric label="drift" value={String(auditDrift?.total ?? '-')} tone={auditStatus} />
          <Metric label="módulos" value={auditModuleDrift == null ? '-' : String(auditModuleDrift)} tone={auditModuleDrift ? 'warning' : auditStatus} />
          <Metric label="símbolos" value={auditSymbolDrift == null ? '-' : String(auditSymbolDrift)} tone={auditSymbolDrift ? 'warning' : auditStatus} />
          <Metric label="doc links" value={auditDocLinkDrift == null ? '-' : String(auditDocLinkDrift)} tone={auditDocLinkDrift ? 'warning' : auditStatus} />
        </View>
        {codeAudit ? (
          <Mono size={9.5} lineHeight={13} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
            {dateLabel(codeAudit.generated_at)} · {codeAudit.workspace}
          </Mono>
        ) : null}
      </View>
      <View style={styles.filterBlock}>
        <FilterChips
          label="Layer"
          value={codeLayerFilter}
          options={[
            { value: '', label: 'todos' },
            { value: 'service', label: 'service' },
            { value: 'api', label: 'api' },
            { value: 'model', label: 'model' },
            { value: 'cli', label: 'cli' },
            { value: 'database', label: 'db' },
            { value: 'test', label: 'test' },
            { value: 'documentation', label: 'docs' },
          ]}
          onChange={onChangeCodeLayer}
        />
        <FilterChips
          label="Docs"
          value={codeDocsStatusFilter}
          options={[
            { value: '', label: 'todos' },
            { value: 'documented', label: 'documented' },
            { value: 'module_documented', label: 'module' },
            { value: 'undocumented', label: 'sem doc' },
          ]}
          onChange={onChangeCodeDocsStatus}
        />
        <FilterChips
          label="Símbolos"
          value={codeSymbolTypeFilter}
          options={[
            { value: '', label: 'todos' },
            { value: 'route', label: 'route' },
            { value: 'cli_command', label: 'cli' },
            { value: 'class', label: 'class' },
            { value: 'method', label: 'method' },
            { value: 'migration_table', label: 'migration' },
            { value: 'test_method', label: 'test' },
            { value: 'doc_heading', label: 'doc' },
          ]}
          onChange={onChangeCodeSymbolType}
        />
      </View>
      {items.length ? (
        <View style={styles.auditSection}>
          {items.slice(0, 4).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onOpenItem(item.slug)}
              style={({ pressed }) => [
                styles.auditRow,
                {
                  borderColor: c.border,
                  backgroundColor: selectedItem?.id === item.id ? c.premium : c.bg,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Sans weight="med" size={12.5} lineHeight={18} color={c.ink} numberOfLines={1}>
                  {item.title}
                </Sans>
                <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
                  {engineeringKnowledgeMetaLine(item)}
                </Mono>
              </View>
              <StatusPill status={item.status} compact />
            </Pressable>
          ))}
        </View>
      ) : null}
      {modules.length ? (
        <View style={styles.auditSection}>
          <View style={styles.sectionHead}>
            <Label>Code modules</Label>
            <Mono size={10.5} lineHeight={14} color={c.ink2}>
              {modules.length}
            </Mono>
          </View>
          {modules.slice(0, 8).map((module) => (
            <Pressable
              key={module.id}
              onPress={() => onOpenCodeModule(module.slug)}
              style={({ pressed }) => [
                styles.auditRow,
                {
                  borderColor: selectedCodeModule?.module.id === module.id ? c.bronze : c.border,
                  backgroundColor: selectedCodeModule?.module.id === module.id ? c.premium : c.bg,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Sans weight="med" size={12.5} lineHeight={18} color={c.ink} numberOfLines={1}>
                  {module.name}
                </Sans>
                <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
                  {engineeringCodeModuleMetaLine(module)}
                </Mono>
                <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
                  {engineeringCodeModuleCoverageLine(module)}
                </Mono>
              </View>
              <StatusPill status={module.docs_status} compact />
            </Pressable>
          ))}
        </View>
      ) : null}
      {symbols.length ? (
        <View style={styles.auditSection}>
          <View style={styles.sectionHead}>
            <Label>Símbolos</Label>
            <Mono size={10.5} lineHeight={14} color={c.ink2}>
              {symbols.length}
            </Mono>
          </View>
          {symbols.slice(0, 8).map((symbol) => (
            <View key={symbol.id} style={[styles.auditRow, { borderColor: c.border, backgroundColor: c.bg }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Sans weight="med" size={12.2} lineHeight={17} color={c.ink} numberOfLines={1}>
                  {symbol.symbol_name}
                </Sans>
                <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
                  {engineeringCodeSymbolMetaLine(symbol)}
                </Mono>
              </View>
              <StatusPill status={symbol.docs_status} compact />
            </View>
          ))}
        </View>
      ) : null}
      {detailLoading ? (
        <View style={[styles.gateBox, { borderColor: c.border, backgroundColor: c.bg }]}>
          <Sans weight="med" size={12.5} lineHeight={18} color={c.ink}>
            Carregando detalhe
          </Sans>
        </View>
      ) : null}
      {codeDetailLoading ? (
        <View style={[styles.gateBox, { borderColor: c.border, backgroundColor: c.bg }]}>
          <Sans weight="med" size={12.5} lineHeight={18} color={c.ink}>
            Carregando módulo
          </Sans>
        </View>
      ) : null}
      {selectedItem ? (
        <View style={[styles.monoBox, { borderColor: c.border, backgroundColor: c.bg, marginTop: 12 }]}>
          <View style={styles.panelTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label>Detalhe</Label>
              <Sans weight="sb" size={14} lineHeight={20} color={c.ink} numberOfLines={2}>
                {selectedItem.title}
              </Sans>
              <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
                {engineeringKnowledgeMetaLine(selectedItem)}
              </Mono>
            </View>
            <Pressable
              onPress={onCloseItem}
              style={({ pressed }) => [
                styles.inlineButton,
                {
                  borderColor: c.border,
                  backgroundColor: c.surface,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
                Fechar
              </Sans>
            </Pressable>
          </View>
          <Sans size={12.5} lineHeight={18} color={c.ink2}>
            {selectedItem.summary ?? 'Sem resumo registrado.'}
          </Sans>
          <KnowledgeDetailLine label="Capabilities" value={engineeringKnowledgeValuesLine(selectedItem.capabilities, 'sem capabilities')} />
          <KnowledgeDetailLine label="Decisões" value={engineeringKnowledgeValuesLine(selectedItem.decisions, 'sem decisões')} />
          <KnowledgeDetailLine label="Manutenção" value={engineeringKnowledgeValuesLine(selectedItem.maintenance, 'sem manutenção')} />
          <KnowledgeDetailLine label="Tags" value={engineeringKnowledgeValuesLine(selectedItem.tags, 'sem tags')} />
          <View style={styles.detailLine}>
            <Label>Excerpt</Label>
            <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2} numberOfLines={6}>
              {engineeringKnowledgeBodyPreview(selectedItem.body_excerpt)}
            </Mono>
          </View>
        </View>
      ) : null}
      {selectedCodeModule ? (
        <View style={[styles.monoBox, { borderColor: c.border, backgroundColor: c.bg, marginTop: 12 }]}>
          <View style={styles.panelTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Label>Módulo</Label>
              <Sans weight="sb" size={14} lineHeight={20} color={c.ink} numberOfLines={2}>
                {selectedCodeModule.module.name}
              </Sans>
              <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
                {engineeringCodeModuleMetaLine(selectedCodeModule.module)}
              </Mono>
            </View>
            <Pressable
              onPress={onCloseCodeModule}
              style={({ pressed }) => [
                styles.inlineButton,
                {
                  borderColor: c.border,
                  backgroundColor: c.surface,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
                Fechar
              </Sans>
            </Pressable>
          </View>
          <View style={styles.metricsCompact}>
            <Metric label="files" value={String(selectedCodeModule.module.file_count)} />
            <Metric label="rotas" value={String(selectedCodeModule.module.route_count)} />
            <Metric label="cmds" value={String(selectedCodeModule.module.command_count)} />
            <Metric label="tests" value={String(selectedCodeModule.module.test_count)} />
          </View>
          <KnowledgeDetailLine label="Coverage" value={engineeringCodeModuleCoverageLine(selectedCodeModule.module)} />
          <KnowledgeDetailLine label="Tags" value={engineeringCodeValuesLine(selectedCodeModule.module.tags, 'sem tags')} />
          <KnowledgeDetailLine label="Docs" value={engineeringCodeValuesLine(selectedCodeModule.module.related_docs, 'sem docs relacionados')} />
          <KnowledgeDetailLine label="Testes" value={engineeringCodeValuesLine(selectedCodeModule.module.related_tests, 'sem testes relacionados')} />
          {selectedCodeModule.doc_links.length ? (
            <View style={styles.auditSection}>
              <View style={styles.sectionHead}>
                <Label>Doc links</Label>
                <Mono size={10.5} lineHeight={14} color={c.ink2}>
                  {selectedCodeModule.doc_links.length}
                </Mono>
              </View>
              {selectedCodeModule.doc_links.slice(0, 5).map((link) => (
                <View key={link.id} style={[styles.auditRow, { borderColor: c.border, backgroundColor: c.surface }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink} numberOfLines={1}>
                      {link.canonical_path}
                    </Mono>
                    <Mono size={9.5} lineHeight={13} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
                      {link.link_type} · {link.target_path ?? '-'}
                    </Mono>
                  </View>
                  <StatusPill status={link.status} compact />
                </View>
              ))}
            </View>
          ) : null}
          {selectedCodeModule.symbols.length ? (
            <View style={styles.auditSection}>
              <View style={styles.sectionHead}>
                <Label>Símbolos do módulo</Label>
                <Mono size={10.5} lineHeight={14} color={c.ink2}>
                  {selectedCodeModule.symbols.length}
                </Mono>
              </View>
              {selectedCodeModule.symbols.slice(0, 6).map((symbol) => (
                <View key={symbol.id} style={[styles.auditRow, { borderColor: c.border, backgroundColor: c.surface }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Sans weight="med" size={12.2} lineHeight={17} color={c.ink} numberOfLines={1}>
                      {symbol.symbol_name}
                    </Sans>
                    <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
                      {engineeringCodeSymbolMetaLine(symbol)}
                    </Mono>
                  </View>
                  <StatusPill status={symbol.docs_status} compact />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function ToolRuntimeCard({
  runtime,
  authority,
  authorityPolicies,
  evidence,
  gate,
  policies,
  gateMode,
  summary,
  authoritySummary,
  authorityPolicySummary,
  loading,
  actionRunning,
  apiContractRunning,
  onGateModeChange,
  onRefresh,
  onApproveTool,
  onRevokeTool,
  onDryRunTool,
  onHardenAuthorityPolicy,
  onRevokeAuthorityPolicy,
  onRunApiContract,
}: {
  runtime: AtlasToolsDoctorResponse | null
  authority: AtlasToolsAuthorityResponse | null
  authorityPolicies: AtlasToolsAuthorityPoliciesResponse | null
  evidence: AtlasToolsEvidenceResponse | null
  gate: AtlasToolsGateResponse | null
  policies: AtlasToolsPoliciesResponse | null
  gateMode: EngineeringToolGateMode
  summary: EngineeringToolRuntimeSummary
  authoritySummary: ReturnType<typeof buildEngineeringToolAuthoritySummary>
  authorityPolicySummary: ReturnType<typeof buildEngineeringToolAuthorityPolicySummary>
  loading: boolean
  actionRunning: string | null
  apiContractRunning: boolean
  onGateModeChange: (mode: EngineeringToolGateMode) => void
  onRefresh: () => void
  onApproveTool: (tool: { slug: string; executionTier?: string | null; risks?: string[] }) => void
  onRevokeTool: (toolSlug: string) => void
  onHardenAuthorityPolicy: (policy: AtlasToolAuthorityPolicy) => void
  onRevokeAuthorityPolicy: (policy: AtlasToolAuthorityPolicy) => void
  onDryRunTool: (tool: {
    slug: string
    binary: string
    executionTier?: string | null
    safeCommands?: Array<{
      name: string
      category?: string
      command: string[]
      dry_run_default: boolean
      recommended_surface?: string
      creates_evidence?: boolean
      blocking_capable?: boolean
      network_allowed: boolean
      max_execution_tier?: string | null
      sandbox_mode?: string | null
      privacy_level?: string | null
      task_type?: string | null
      requires_provider_safe?: boolean
    }>
  }) => void
  onRunApiContract: () => void
}) {
  const c = usePalette()
  const tools = [...(runtime?.tools ?? [])].sort((left, right) => (
    statusWeight(left.status) - statusWeight(right.status)
  ))
  const runs = evidence?.data ?? []
  const policyRows = policies?.data ?? []
  const authorityPolicyRows = authorityPolicies?.policies ?? []
  const policyByTool = new Map(policyRows.map((policy) => [policy.tool_slug, policy]))
  const gateIssue = gate?.blocking_failures?.[0] ?? gate?.warnings?.[0] ?? null
  const authorityGroups = [...(authority?.authority_groups ?? [])].sort((left, right) => (
    Number(right.missing_primary) - Number(left.missing_primary)
    || Number(right.duplicate_primary) - Number(left.duplicate_primary)
    || right.high_risk_tools.length - left.high_risk_tools.length
    || left.authority_group.localeCompare(right.authority_group)
  ))
  const authorityRecommendations = authority?.recommendations ?? []

  return (
    <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.panelTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Super Tool Runtime</Label>
          <Sans weight="sb" size={15} lineHeight={21} color={c.ink}>
            {summary.readyCount}/{runtime?.tool_count ?? 0} ferramentas prontas
          </Sans>
          <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
            {summary.lastEvidenceAt ? `última evidência ${dateLabel(summary.lastEvidenceAt)}` : 'sem evidência recente'}
          </Mono>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <StatusPill status={summary.status} />
          <Pressable
            disabled={loading}
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.inlineButton,
              {
                borderColor: c.border,
                backgroundColor: loading ? c.bg : c.surface,
                opacity: pressed && !loading ? 0.82 : 1,
              },
            ]}
          >
            <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
              {loading ? 'Atualizando' : 'Atualizar'}
            </Sans>
          </Pressable>
          <Pressable
            disabled={apiContractRunning}
            onPress={onRunApiContract}
            style={({ pressed }) => [
              styles.inlineButton,
              {
                borderColor: c.border,
                backgroundColor: apiContractRunning ? c.bg : c.surface,
                opacity: pressed && !apiContractRunning ? 0.82 : 1,
              },
            ]}
          >
            <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
              {apiContractRunning ? 'Validando' : 'API Contract'}
            </Sans>
          </Pressable>
        </View>
      </View>
      <View style={styles.metricsCompact}>
        <Metric label="ready" value={String(summary.readyCount)} tone="ready" />
        <Metric label="missing" value={String(summary.missingCount)} tone={summary.missingCount > 0 ? 'warning' : 'ready'} />
        <Metric label="evidências" value={String(summary.evidenceCount)} tone={summary.evidenceCount > 0 ? summary.status : 'unknown'} />
        <Metric label="falhas" value={String(summary.failedEvidenceCount + summary.blockingFindingCount)} tone={summary.failedEvidenceCount + summary.blockingFindingCount > 0 ? 'failed' : 'ready'} />
      </View>
      <View style={[styles.gateBox, { borderColor: c.border, backgroundColor: c.bg }]}>
        <View style={styles.panelTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label>Matriz de autoridade</Label>
            <Sans weight="sb" size={13.5} lineHeight={19} color={c.ink} numberOfLines={1}>
              {authoritySummary.toolCount} tools · {authoritySummary.authorityGroupCount} grupos
            </Sans>
            <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
              {authoritySummary.tierLine}
            </Mono>
          </View>
          <StatusPill
            status={authoritySummary.highRecommendationCount > 0 || authoritySummary.missingPrimaryCount > 0 ? 'warning' : 'ready'}
            compact
          />
        </View>
        <View style={styles.metricsCompact}>
          <Metric label="recomendações" value={String(authoritySummary.recommendationCount)} tone={authoritySummary.recommendationCount > 0 ? 'warning' : 'ready'} />
          <Metric label="alta" value={String(authoritySummary.highRecommendationCount)} tone={authoritySummary.highRecommendationCount > 0 ? 'failed' : 'ready'} />
          <Metric label="sem primária" value={String(authoritySummary.missingPrimaryCount)} tone={authoritySummary.missingPrimaryCount > 0 ? 'warning' : 'ready'} />
          <Metric label="coautoridade" value={String(authoritySummary.duplicatePrimaryCount)} tone={authoritySummary.duplicatePrimaryCount > 0 ? 'warning' : 'ready'} />
        </View>
        {authorityRecommendations.slice(0, 2).map((recommendation) => (
          <Mono key={`${recommendation.authority_group}-${recommendation.code}`} size={9.8} lineHeight={13} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
            {recommendation.severity} · {recommendation.authority_group} · {recommendation.message}
          </Mono>
        ))}
      </View>
      <View style={[styles.gateBox, { borderColor: c.border, backgroundColor: c.bg }]}>
        <View style={styles.panelTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label>Políticas de autoridade</Label>
            <Sans weight="sb" size={13.5} lineHeight={19} color={c.ink} numberOfLines={1}>
              {authorityPolicySummary.policyCount} contratos · {authorityPolicySummary.blockingPolicyCount} bloqueantes
            </Sans>
            <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
              {authorityPolicySummary.warningPolicyCount} políticas geram avisos auditáveis
            </Mono>
          </View>
          <StatusPill status={authorityPolicyRows.length > 0 ? 'ready' : 'unknown'} compact />
        </View>
        {authorityPolicyRows.slice(0, 4).map((policy) => {
          const hardening = actionRunning === `authority-harden:${policy.authority_group}`
          const revoking = actionRunning === `authority-revoke:${policy.authority_group}`
          const mediumAlreadyBlocks = policy.block_severities.includes('medium')
          const hasWorkspaceOverride = policy.source === 'workspace'

          return (
            <View key={policy.authority_group} style={[styles.auditRow, { borderColor: c.border, backgroundColor: c.surface }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Sans weight="med" size={12.2} lineHeight={17} color={c.ink} numberOfLines={1}>
                  {policy.authority_group}
                </Sans>
                <Mono size={9.8} lineHeight={13} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
                  {toolAuthorityPolicyLine(policy)}
                </Mono>
              </View>
              <View style={styles.rowActions}>
                <Pressable
                  disabled={Boolean(actionRunning) || mediumAlreadyBlocks}
                  onPress={() => onHardenAuthorityPolicy(policy)}
                  style={({ pressed }) => [
                    styles.inlineButtonTiny,
                    {
                      borderColor: c.border,
                      backgroundColor: hardening ? c.bg : c.surface,
                      opacity: pressed && !actionRunning ? 0.82 : 1,
                    },
                  ]}
                >
                  <Sans weight="sb" size={11} lineHeight={14} color={mediumAlreadyBlocks ? c.ink2 : c.ink}>
                    {hardening ? 'Aplicando' : 'Medium bloqueia'}
                  </Sans>
                </Pressable>
                <Pressable
                  disabled={Boolean(actionRunning) || !hasWorkspaceOverride}
                  onPress={() => onRevokeAuthorityPolicy(policy)}
                  style={({ pressed }) => [
                    styles.inlineButtonTiny,
                    {
                      borderColor: c.recRed,
                      backgroundColor: revoking ? c.bg : c.surface,
                      opacity: pressed && !actionRunning ? 0.82 : 1,
                    },
                  ]}
                >
                  <Sans weight="sb" size={11} lineHeight={14} color={hasWorkspaceOverride ? c.recRed : c.ink2}>
                    {revoking ? 'Revogando' : 'Revogar'}
                  </Sans>
                </Pressable>
              </View>
            </View>
          )
        })}
      </View>
      <View style={[styles.gateBox, { borderColor: statusColor(gate?.status ?? 'unknown', c), backgroundColor: c.bg }]}>
        <View style={styles.panelTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label>Evidence gate</Label>
            <Sans weight="sb" size={13.5} lineHeight={19} color={c.ink} numberOfLines={1}>
              {gate ? (gate.allowed ? 'Fluxo liberado' : 'Fluxo bloqueado') : 'Gate não avaliado'}
            </Sans>
            <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
              {toolRuntimeGateLine(gate)}
            </Mono>
            <Mono size={9.8} lineHeight={13} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
              {toolRuntimeGateModeLine(gateMode)}
            </Mono>
          </View>
          <StatusPill status={gate?.status ?? 'unknown'} compact />
        </View>
        <View style={styles.filterBlock}>
          <FilterChips
            label="Gate"
            value={gateMode}
            options={[
              { value: 'observe', label: 'observação' },
              { value: 'release', label: 'release' },
            ]}
            onChange={(value) => onGateModeChange(value as EngineeringToolGateMode)}
          />
        </View>
        {gate ? (
          <View style={styles.metricsCompact}>
            <Metric label="runs" value={String(gate.summary?.run_count ?? 0)} tone={gate.status} />
            <Metric label="tools" value={String(gate.summary?.tool_count ?? 0)} tone={gate.status} />
            <Metric label="bloqueios" value={String(gate.summary?.blocking_failure_count ?? 0)} tone={(gate.summary?.blocking_failure_count ?? 0) > 0 ? 'failed' : 'passed'} />
            <Metric label="avisos" value={String(gate.summary?.warning_count ?? 0)} tone={(gate.summary?.warning_count ?? 0) > 0 ? 'warning' : 'passed'} />
          </View>
        ) : null}
        {gateIssue ? (
          <Mono size={9.8} lineHeight={13} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
            {toolRuntimeGateIssueLine(gateIssue)}
          </Mono>
        ) : null}
      </View>
      <View style={styles.auditSection}>
        <View style={styles.sectionHead}>
          <Label>Registry</Label>
          <Mono size={10.5} lineHeight={14} color={c.ink2}>
            {runtime?.status ?? 'unknown'}
          </Mono>
        </View>
        {tools.slice(0, 8).map((tool) => {
          const policy = policyByTool.get(tool.slug)
          const approved = policy?.approval_status === 'approved'
          const approving = actionRunning === `approve:${tool.slug}`
          const revoking = actionRunning === `revoke:${tool.slug}`
          const dryRunning = actionRunning === `dry-run:${tool.slug}`
          const defaultRecipe = tool.safe_commands?.find((command) => command.dry_run_default) ?? tool.safe_commands?.[0]

          return (
            <View key={tool.slug} style={[styles.auditRow, { borderColor: c.border, backgroundColor: c.bg }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Sans weight="med" size={12.2} lineHeight={17} color={c.ink} numberOfLines={1}>
                  {tool.name}
                </Sans>
                <Mono size={9.8} lineHeight={13} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
                  {tool.binary} · {toolRuntimeRiskLine(tool)} · {(tool.safe_commands?.length ?? 0)} recipes · {defaultRecipe?.category ?? 'diagnostic'}
                </Mono>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <StatusPill status={tool.status} compact />
                <View style={styles.rowActions}>
                  <Pressable
                    disabled={Boolean(actionRunning)}
                    onPress={() => onDryRunTool({
                      slug: tool.slug,
                      binary: tool.binary,
                      executionTier: tool.execution_tier,
                      safeCommands: tool.safe_commands,
                    })}
                    style={({ pressed }) => [
                      styles.inlineButtonTiny,
                      {
                        borderColor: c.border,
                        backgroundColor: dryRunning ? c.bg : c.surface,
                        opacity: pressed && !actionRunning ? 0.82 : 1,
                      },
                    ]}
                  >
                    <Sans weight="sb" size={11} lineHeight={14} color={c.ink}>
                      {dryRunning ? 'Dry' : 'Dry-run'}
                    </Sans>
                  </Pressable>
                  <Pressable
                    disabled={Boolean(actionRunning)}
                    onPress={() => approved
                      ? onRevokeTool(tool.slug)
                      : onApproveTool({
                        slug: tool.slug,
                        executionTier: tool.execution_tier,
                        risks: tool.risks,
                      })}
                    style={({ pressed }) => [
                      styles.inlineButtonTiny,
                      {
                        borderColor: approved ? c.recRed : c.border,
                        backgroundColor: approving || revoking ? c.bg : c.surface,
                        opacity: pressed && !actionRunning ? 0.82 : 1,
                      },
                    ]}
                  >
                    <Sans weight="sb" size={11} lineHeight={14} color={approved ? c.recRed : c.ink}>
                      {revoking ? 'Revogando' : approving ? 'Aprovando' : approved ? 'Revogar' : 'Aprovar 2h'}
                    </Sans>
                  </Pressable>
                </View>
              </View>
            </View>
          )
        })}
        {tools.length === 0 ? (
          <Sans size={12.5} lineHeight={18} color={c.ink2}>
            Registry ainda não carregado.
          </Sans>
        ) : null}
      </View>
      <View style={styles.auditSection}>
        <View style={styles.sectionHead}>
          <Label>Approval policies</Label>
          <Mono size={10.5} lineHeight={14} color={c.ink2}>
            {policyRows.length}
          </Mono>
        </View>
        {policyRows.slice(0, 5).map((policy) => {
          const revoking = actionRunning === `revoke:${policy.tool_slug}`

          return (
            <View key={policy.id} style={[styles.auditRow, { borderColor: c.border, backgroundColor: c.bg }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Sans weight="med" size={12.2} lineHeight={17} color={c.ink} numberOfLines={1}>
                  {policy.tool_slug}
                </Sans>
                <Mono size={9.8} lineHeight={13} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
                  {toolApprovalPolicyLine(policy)}
                </Mono>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <StatusPill status={policy.approval_status ?? 'unknown'} compact />
                <Pressable
                  disabled={Boolean(actionRunning) || policy.approval_status !== 'approved'}
                  onPress={() => onRevokeTool(policy.tool_slug)}
                  style={({ pressed }) => [
                    styles.inlineButtonTiny,
                    {
                      borderColor: c.recRed,
                      backgroundColor: revoking ? c.bg : c.surface,
                      opacity: pressed && !actionRunning ? 0.82 : 1,
                    },
                  ]}
                >
                  <Sans weight="sb" size={11} lineHeight={14} color={c.recRed}>
                    {revoking ? 'Revogando' : 'Revogar'}
                  </Sans>
                </Pressable>
              </View>
            </View>
          )
        })}
        {policyRows.length === 0 ? (
          <Sans size={12.5} lineHeight={18} color={c.ink2}>
            Nenhuma approval policy configurada.
          </Sans>
        ) : null}
      </View>
      <View style={styles.auditSection}>
        <View style={styles.sectionHead}>
          <Label>Autoridade</Label>
          <Mono size={10.5} lineHeight={14} color={c.ink2}>
            {authorityGroups.length}
          </Mono>
        </View>
        {authorityGroups.slice(0, 5).map((group) => (
          <View key={group.authority_group} style={[styles.auditRow, { borderColor: c.border, backgroundColor: c.bg }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Sans weight="med" size={12.2} lineHeight={17} color={c.ink} numberOfLines={1}>
                {group.authority_group}
              </Sans>
              <Mono size={9.8} lineHeight={13} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
                {toolAuthorityGroupLine(group)}
              </Mono>
            </View>
            <StatusPill status={group.missing_primary || group.duplicate_primary ? 'warning' : 'ready'} compact />
          </View>
        ))}
        {authorityGroups.length === 0 ? (
          <Sans size={12.5} lineHeight={18} color={c.ink2}>
            Matriz de autoridade ainda não carregada.
          </Sans>
        ) : null}
      </View>
      <View style={styles.auditSection}>
        <View style={styles.sectionHead}>
          <Label>Evidências recentes</Label>
          <Mono size={10.5} lineHeight={14} color={c.ink2}>
            {runs.length}
          </Mono>
        </View>
        {runs.slice(0, 5).map((run) => (
          <View key={run.id} style={[styles.auditRow, { borderColor: c.border, backgroundColor: c.bg }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Sans weight="med" size={12.2} lineHeight={17} color={c.ink} numberOfLines={1}>
                {run.tool_slug}
              </Sans>
              <Mono size={9.8} lineHeight={13} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
                {toolRuntimeEvidenceLine(run)}
              </Mono>
            </View>
            <StatusPill status={run.status} compact />
          </View>
        ))}
        {runs.length === 0 ? (
          <Sans size={12.5} lineHeight={18} color={c.ink2}>
            Nenhuma execução registrada no Evidence Store.
          </Sans>
        ) : null}
      </View>
    </View>
  )
}

function statusWeight(status: string): number {
  if (status === 'ready') return 0
  if (status === 'missing') return 1
  if (['failed', 'timeout'].includes(status)) return 2
  if (['disabled', 'skipped'].includes(status)) return 3

  return 4
}

function KnowledgeDetailLine({ label, value }: { label: string; value: string }) {
  const c = usePalette()

  return (
    <View style={styles.detailLine}>
      <Label>{label}</Label>
      <Sans size={12.5} lineHeight={18} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

function FilterChips({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const c = usePalette()

  return (
    <View style={styles.filterGroup}>
      <Label>{label}</Label>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const active = option.value === value

          return (
            <Pressable
              key={option.value || 'all'}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  borderColor: active ? c.bronze : c.border,
                  backgroundColor: active ? c.premium : c.bg,
                  opacity: pressed ? 0.84 : 1,
                },
              ]}
            >
              <Mono size={10} lineHeight={13} letterSpacing={0.1} color={active ? c.ink : c.ink2}>
                {option.label}
              </Mono>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function HarnessabilityCalibrationCard({
  calibration,
  calibrating,
  onCalibrate,
}: {
  calibration: Record<string, unknown> | null
  calibrating: boolean
  onCalibrate: () => void
}) {
  const c = usePalette()
  const thresholds = objectValue(calibration?.recommended_thresholds)
  const buckets = objectValue(calibration?.bucket_metrics)
  const highBucket = objectValue(buckets.high)
  const confidence = textValue(calibration?.confidence, 'none')
  const policySource = textValue(thresholds.policy_source, 'static_default')
  const sampleCount = numberValue(calibration?.sample_count)
  const highDebtRate = numberValue(highBucket.quality_debt_rate)

  return (
    <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.panelTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Harnessability policy</Label>
          <Sans weight="sb" size={15} lineHeight={21} color={c.ink}>
            {statusLabel(policySource)} · {confidence}
          </Sans>
          <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
            {dateLabel(textValue(calibration?.generated_at, null))}
          </Mono>
        </View>
        <Pressable
          disabled={calibrating}
          onPress={onCalibrate}
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              borderColor: c.border,
              backgroundColor: calibrating ? c.bg : c.surface,
              opacity: pressed && !calibrating ? 0.82 : 1,
            },
          ]}
        >
          <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
            {calibrating ? 'Calibrando' : 'Calibrar'}
          </Sans>
        </Pressable>
      </View>
      <View style={styles.metricsCompact}>
        <Metric label="amostra" value={sampleCount == null ? '-' : String(sampleCount)} tone={confidence === 'none' ? 'warning' : 'passed'} />
        <Metric label="high min" value={String(numberValue(thresholds.high_min_score) ?? '-')} tone={policySource === 'historical_calibration' ? 'adjusted' : 'stable'} />
        <Metric label="worktree <" value={String(numberValue(thresholds.require_worktree_below_score) ?? '-')} />
        <Metric label="danger min" value={String(numberValue(thresholds.danger_permission_min_score) ?? '-')} />
        <Metric label="debt high" value={highDebtRate == null ? '-' : `${highDebtRate}%`} tone={highDebtRate && highDebtRate > 0 ? 'warning' : 'passed'} />
      </View>
    </View>
  )
}

function RunCard({ run }: { run: AtlasEngineeringBenchmarkRunSummary }) {
  const c = usePalette()

  return (
    <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.panelTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Último run</Label>
          <Sans weight="sb" size={15} lineHeight={21} color={c.ink}>
            {run.passed_cases}/{run.total_cases} cases passaram
          </Sans>
          <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
            {dateLabel(run.finished_at ?? run.created_at)} · {run.provider ?? '-'} · {run.model ?? '-'}
          </Mono>
        </View>
        <View style={styles.statusStack}>
          <StatusPill status={run.release_gate_status ?? run.status} />
          <StatusPill status={run.trend_status ?? run.status} compact />
        </View>
      </View>
      {run.release_gate_failures?.length ? (
        <View style={[styles.gateBox, { borderColor: c.recRed, backgroundColor: c.bg }]}>
          <Sans size={11.5} lineHeight={16} color={c.recRed} numberOfLines={3}>
            {run.release_gate_failures[0]}
          </Sans>
        </View>
      ) : null}
      <View style={styles.metricsCompact}>
        <Metric label="pass rate" value={run.pass_rate == null ? '-' : `${run.pass_rate}%`} tone={run.status} />
        <Metric label="delta" value={deltaLabel(run.pass_rate_delta, '%')} tone={run.trend_status} />
        <Metric label="score médio" value={run.average_score == null ? '-' : String(run.average_score)} />
        <Metric label="score delta" value={deltaLabel(run.average_score_delta)} tone={run.trend_status} />
      </View>
      <View style={styles.metricsCompact}>
        <Metric label="controles" value={String((run.failed_control_count ?? 0) + (run.blocked_control_count ?? 0))} tone={run.failed_control_count || run.blocked_control_count ? 'failed' : 'passed'} />
        <Metric label="testes" value={String(run.failed_test_count ?? 0)} tone={run.failed_test_count ? 'failed' : 'passed'} />
        <Metric label="findings" value={String(run.blocking_review_finding_count ?? 0)} tone={run.blocking_review_finding_count ? 'failed' : 'passed'} />
        <Metric label="attempts" value={String(run.total_attempts ?? 0)} />
      </View>
      <View style={styles.metricsCompact}>
        <Metric label="gate" value={statusLabel(run.release_gate_status ?? 'unknown')} tone={run.release_gate_status} />
        <Metric label="perfil" value={run.release_gate_profile ?? '-'} />
        <Metric label="falhas gate" value={String(run.release_gate_failures?.length ?? 0)} tone={run.release_gate_status} />
        <Metric label="avisos" value={String(run.release_gate_warnings?.length ?? 0)} tone={run.release_gate_warnings?.length ? 'warning' : 'passed'} />
      </View>
      <View style={styles.metricsCompact}>
        <Metric label="rollout" value={statusLabel(run.rollout_status ?? 'unknown')} tone={run.rollout_status} />
        <Metric label="outcome" value={statusLabel(run.outcome_status ?? 'pending')} tone={run.outcome_status ?? 'pending'} />
        <Metric label="out score" value={run.outcome_score == null ? '-' : String(run.outcome_score)} tone={run.outcome_status} />
        <Metric label="registrado" value={run.outcome_recorded_at ? dateLabel(run.outcome_recorded_at) : '-'} />
      </View>
    </View>
  )
}

function TrendList({ runs }: { runs: AtlasEngineeringBenchmarkRunSummary[] }) {
  const c = usePalette()
  const visibleRuns = runs.slice(0, 8)

  return (
    <View style={styles.resultsList}>
      <View style={styles.sectionHead}>
        <Label>Histórico</Label>
        <Mono size={10.5} lineHeight={14} color={c.ink2}>
          {runs.length}
        </Mono>
      </View>
      {visibleRuns.map((run) => (
        <View key={run.id} style={[styles.trendRow, { borderColor: c.border, backgroundColor: c.surface }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Sans weight="med" size={12.5} lineHeight={18} color={c.ink} numberOfLines={1}>
              {run.provider ?? '-'} · {run.model ?? '-'} · {run.mode ?? '-'}
            </Sans>
            <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
              {dateLabel(run.finished_at ?? run.created_at)} · {run.pass_rate ?? '-'}% · score {run.average_score ?? '-'} · qd {qualityDebt(run)} · gate {statusLabel(run.release_gate_status ?? 'unknown')} · roll {statusLabel(run.rollout_status ?? 'unknown')}
            </Mono>
          </View>
          <View style={styles.trendDelta}>
            <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={statusColor(run.trend_status ?? run.status, c)}>
              {deltaLabel(run.pass_rate_delta, '%')}
            </Mono>
            <StatusPill status={run.trend_status ?? run.status} compact />
          </View>
        </View>
      ))}
    </View>
  )
}

function ResultRow({
  result,
  active = false,
  onPress,
}: {
  result: AtlasEngineeringBenchmarkResultSummary
  active?: boolean
  onPress?: () => void
}) {
  const c = usePalette()

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.resultRow,
        {
          borderColor: active ? c.bronze : c.border,
          backgroundColor: active ? c.premium : c.surface,
          opacity: pressed && onPress ? 0.84 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={12.5} lineHeight={18} color={c.ink} numberOfLines={1}>
          {result.case_code ?? result.case_id}
        </Sans>
        <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
          {result.decision ?? '-'} · score {result.score ?? '-'} · {result.duration_ms}ms
        </Mono>
        {result.failure_summary ? (
          <Sans size={11.5} lineHeight={16} color={c.recRed} numberOfLines={2}>
            {result.failure_summary}
          </Sans>
        ) : null}
      </View>
      <StatusPill status={result.status} compact />
    </Pressable>
  )
}

function EngineeringRunDetail({
  run,
  workspace,
  model,
  modelPolicy,
  qualityScan,
  qualityProfile,
}: {
  run: AtlasEngineeringRunSummary
  workspace: string
  model: string
  modelPolicy: 'fixed' | 'balanced' | 'best-quality' | 'fastest' | 'cheapest'
  qualityScan: 'off' | 'auto' | 'required'
  qualityProfile: 'fast' | 'standard' | 'release'
}) {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const [replayedRun, setReplayedRun] = useState<AtlasEngineeringRunSummary | null>(null)
  const [operatorRun, setOperatorRun] = useState<AtlasEngineeringRunSummary | null>(null)
  const [replaying, setReplaying] = useState(false)
  const [replayingAttemptId, setReplayingAttemptId] = useState<string | null>(null)
  const [operatorActioning, setOperatorActioning] = useState<string | null>(null)
  const activeRun = operatorRun ?? replayedRun ?? run
  const attempts = activeRun.attempts ?? []
  const patches = activeRun.patch_artifacts ?? []
  const controls = activeRun.control_results ?? []
  const tests = activeRun.test_runs ?? []
  const findings = activeRun.review_findings ?? []
  const attemptComparison = activeRun.attempt_comparison ?? null
  const firstPatch = patches[0]
  const autonomy = objectValue(activeRun.autonomy_policy)
  const modelSelection = objectValue(activeRun.model_selection)
  const autonomyActions = Array.isArray(autonomy.actions) ? autonomy.actions.map(String) : []
  const artifactTests = tests.filter((test) => Boolean(test.id && test.artifact_path))
  const comparisonByAttemptId = useMemo(() => {
    return new Map<string, AtlasEngineeringAttemptComparisonRow>(
      (attemptComparison?.attempts ?? []).map((row) => [row.attempt_id, row]),
    )
  }, [attemptComparison])
  const [patchDiff, setPatchDiff] = useState<string | null>(null)
  const [patchDiffMeta, setPatchDiffMeta] = useState<{ source: string; truncated: boolean; returnedBytes: number; hashMatches?: boolean | null } | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [artifactTestId, setArtifactTestId] = useState<string | null>(null)
  const [artifactFiles, setArtifactFiles] = useState<AtlasEngineeringTestArtifactFile[]>([])
  const [artifactLoading, setArtifactLoading] = useState(false)
  const [artifactContent, setArtifactContent] = useState<AtlasEngineeringTestArtifactContentResponse | null>(null)
  const [artifactContentLoading, setArtifactContentLoading] = useState(false)
  const [promoting, setPromoting] = useState(false)

  useEffect(() => {
    setReplayedRun(null)
    setOperatorRun(null)
  }, [run.id])

  useEffect(() => {
    setPatchDiff(null)
    setPatchDiffMeta(null)
    setArtifactTestId(null)
    setArtifactFiles([])
    setArtifactContent(null)
  }, [activeRun.id, firstPatch?.id])

  const loadPatchDiff = useCallback(async () => {
    if (!activeRun.id || !firstPatch?.id || diffLoading) return

    setDiffLoading(true)
    try {
      const response = await fetchEngineeringRunPatchDiff(activeRun.id, firstPatch.id, { max_bytes: 524288 })
      setPatchDiff(response.diff.content)
      setPatchDiffMeta({
        source: response.diff.source,
        truncated: response.diff.truncated,
        returnedBytes: response.diff.returned_bytes,
        hashMatches: response.patch_artifact.hash_matches,
      })
    } catch {
      showToast('Não consegui abrir o diff')
    } finally {
      setDiffLoading(false)
    }
  }, [activeRun.id, diffLoading, firstPatch?.id, showToast])

  const loadArtifacts = useCallback(async (test: AtlasEngineeringTestRunSummary) => {
    if (!activeRun.id || !test.id || artifactLoading) return

    setArtifactLoading(true)
    try {
      const response = await listEngineeringTestRunArtifacts(activeRun.id, test.id, { limit: 150 })
      setArtifactTestId(test.id)
      setArtifactFiles(response.files)
      setArtifactContent(null)
    } catch {
      showToast('Não consegui abrir artifacts')
    } finally {
      setArtifactLoading(false)
    }
  }, [activeRun.id, artifactLoading, showToast])

  const loadArtifactContent = useCallback(async (file: AtlasEngineeringTestArtifactFile) => {
    if (!activeRun.id || !artifactTestId || !file.readable_inline || artifactContentLoading) return

    setArtifactContentLoading(true)
    try {
      const response = await fetchEngineeringTestRunArtifactContent(activeRun.id, artifactTestId, {
        path: file.path,
        max_bytes: 524288,
      })
      setArtifactContent(response)
    } catch {
      showToast('Não consegui abrir artifact')
    } finally {
      setArtifactContentLoading(false)
    }
  }, [activeRun.id, artifactContentLoading, artifactTestId, showToast])

  const replaySensors = useCallback(async () => {
    if (!activeRun.id || replaying) return
    const resolvedWorkspace = workspace.trim()
    if (!resolvedWorkspace) {
      showToast('Informe o workspace para replay')
      return
    }

    setReplaying(true)
    try {
      const response = await replayEngineeringRun(activeRun.id, {
        workspace: resolvedWorkspace,
        model: model.trim() || null,
        model_policy: model.trim() ? 'fixed' : modelPolicy,
        auto_test: true,
        sandbox: 'worktree',
        provider_replay: false,
        apply_isolated_patch: false,
        quality_scan: qualityScan,
        quality_profile: qualityProfile,
        quality_changed_only: true,
      })
      setOperatorRun(null)
      setReplayedRun(response.run)
      showToast(response.run.decision === 'resolved' ? 'Replay passou' : 'Replay registrado')
    } catch {
      showToast('Não consegui executar replay')
    } finally {
      setReplaying(false)
    }
  }, [activeRun.id, model, modelPolicy, qualityProfile, qualityScan, replaying, showToast, workspace])

  const replayAttemptSensors = useCallback(async (attemptId: string) => {
    if (!activeRun.id || replaying || replayingAttemptId) return
    const resolvedWorkspace = workspace.trim()
    if (!resolvedWorkspace) {
      showToast('Informe o workspace para replay')
      return
    }

    setReplayingAttemptId(attemptId)
    try {
      const response = await replayEngineeringRunAttempt(activeRun.id, attemptId, {
        workspace: resolvedWorkspace,
        model: model.trim() || null,
        model_policy: model.trim() ? 'fixed' : modelPolicy,
        auto_test: true,
        sandbox: 'worktree',
        provider_replay: false,
        apply_isolated_patch: false,
        quality_scan: qualityScan,
        quality_profile: qualityProfile,
        quality_changed_only: true,
      })
      setOperatorRun(null)
      setReplayedRun(response.run)
      showToast(response.run.decision === 'resolved' ? 'Attempt passou no replay' : 'Replay do attempt registrado')
    } catch {
      showToast('Não consegui executar replay do attempt')
    } finally {
      setReplayingAttemptId(null)
    }
  }, [activeRun.id, model, modelPolicy, qualityProfile, qualityScan, replaying, replayingAttemptId, showToast, workspace])

  const applyOperatorAction = useCallback(async (action: 'cancel' | 'accept' | 'needs_human' | 'reject') => {
    if (!activeRun.id || operatorActioning) return

    setOperatorActioning(action)
    try {
      const response = await applyEngineeringRunOperatorAction(activeRun.id, {
        action,
        actor: 'atlas_app',
        note: `Action ${action} from Engineering screen.`,
      })
      setOperatorRun(response.run)
      showToast(action === 'accept' ? 'Run aceito' : 'Ação registrada')
    } catch {
      showToast('Não consegui registrar ação')
    } finally {
      setOperatorActioning(null)
    }
  }, [activeRun.id, operatorActioning, showToast])

  const promoteRun = useCallback(async () => {
    if (!activeRun.id || promoting) return
    setPromoting(true)
    try {
      await ensureDefaultEngineeringBenchmarkSuite({
        slug: 'atlas-real-runs',
        name: 'Atlas real runs',
        description: 'Corpus promovido a partir de runs reais do Harness.',
      })
      await promoteEngineeringRunToBenchmarkCase('atlas-real-runs', {
        run_id: activeRun.id,
        title: `Run real ${String(activeRun.id).slice(0, 8)}`,
        expected_decision: activeRun.decision ?? 'resolved',
        status: 'active',
        metadata: {
          source: 'atlas_app',
          promoted_from_flow: 'engineering_run_detail',
        },
      })
      showToast('Run promovido para Atlas-Bench', { variant: 'checkin' })
    } catch {
      showToast('Não consegui promover o run')
    } finally {
      setPromoting(false)
    }
  }, [activeRun.decision, activeRun.id, promoting, showToast])

  return (
    <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.panelTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Run selecionado</Label>
          <Sans weight="sb" size={15} lineHeight={21} color={c.ink}>
            {statusLabel(activeRun.decision ?? activeRun.status ?? 'unknown')} · score {activeRun.score ?? '-'}
          </Sans>
          <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
            {activeRun.id ?? '-'} · {dateLabel(activeRun.finished_at as string | null | undefined)}
          </Mono>
        </View>
        <StatusPill status={activeRun.decision ?? activeRun.status} />
      </View>

      <View style={styles.metricsCompact}>
        <Metric label="attempts" value={String(attempts.length || activeRun.attempt_count || 0)} tone={activeRun.status} />
        <Metric label="controles" value={`${controls.filter((item) => item.status !== 'passed').length}/${controls.length}`} tone={controls.some((item) => item.status === 'failed' || item.status === 'blocked') ? 'failed' : 'passed'} />
        <Metric label="testes" value={`${tests.filter((item) => item.status !== 'passed').length}/${tests.length}`} tone={tests.some((item) => item.status === 'failed') ? 'failed' : 'passed'} />
        <Metric label="findings" value={String(activeRun.review_summary?.open_count ?? findings.filter((item) => item.status === 'open').length)} tone={(activeRun.review_summary?.blocking_count ?? 0) > 0 ? 'failed' : 'passed'} />
      </View>
      {modelSelection.selected_model ? (
        <View style={styles.metricsCompact}>
          <Metric label="modelo" value={textValue(modelSelection.selected_alias, textValue(modelSelection.selected_model, '-'))} tone={textValue(modelSelection.status, 'passed')} />
          <Metric label="política" value={textValue(modelSelection.effective_policy, '-')} />
          <Metric label="fonte" value={textValue(modelSelection.source, '-')} />
          <Metric label="confiança" value={`${Math.round((numberValue(modelSelection.confidence) ?? 0) * 100)}%`} />
        </View>
      ) : null}
      <View style={styles.memoryActionRow}>
        <Pressable
          disabled={!activeRun.id}
          onPress={() => {
            if (!activeRun.id) return
            router.push({
              pathname: '/memory',
              params: memoryEngineeringRunReviewParams(activeRun.id, activeRun.task_id ?? null),
            })
          }}
          style={({ pressed }) => [
            styles.inlineButton,
            {
              borderColor: c.border,
              backgroundColor: pressed && activeRun.id ? c.premium : c.surface,
              opacity: activeRun.id ? 1 : 0.45,
            },
          ]}
        >
          <Sans weight="sb" size={12} lineHeight={16} color={c.prussian}>
            Memória do run
          </Sans>
        </Pressable>
        <Pressable
          disabled={!activeRun.id || replaying || Boolean(replayingAttemptId)}
          onPress={() => { void replaySensors() }}
          style={({ pressed }) => [
            styles.inlineButton,
            {
              borderColor: c.border,
              backgroundColor: pressed && activeRun.id && !replaying && !replayingAttemptId ? c.premium : c.surface,
              opacity: activeRun.id && !replaying && !replayingAttemptId ? 1 : 0.45,
            },
          ]}
        >
          <Sans weight="sb" size={12} lineHeight={16} color={c.prussian}>
            {replaying ? 'Replay' : 'Replay sensores'}
          </Sans>
        </Pressable>
        <Pressable
          disabled={!activeRun.id || promoting}
          onPress={() => { void promoteRun() }}
          style={({ pressed }) => [
            styles.inlineButton,
            {
              borderColor: c.border,
              backgroundColor: pressed && activeRun.id && !promoting ? c.premium : c.surface,
              opacity: activeRun.id && !promoting ? 1 : 0.45,
            },
          ]}
        >
          <Sans weight="sb" size={12} lineHeight={16} color={c.prussian}>
            {promoting ? 'Promovendo' : 'Promover Bench'}
          </Sans>
        </Pressable>
      </View>
      <View style={styles.memoryActionRow}>
        <Pressable
          disabled={!activeRun.id || Boolean(operatorActioning)}
          onPress={() => { void applyOperatorAction('accept') }}
          style={({ pressed }) => [
            styles.inlineButton,
            {
              borderColor: c.border,
              backgroundColor: pressed && !operatorActioning ? c.premium : c.surface,
              opacity: activeRun.id && !operatorActioning ? 1 : 0.45,
            },
          ]}
        >
          <Sans weight="sb" size={12} lineHeight={16} color={c.moss}>
            {operatorActioning === 'accept' ? 'Aceitando' : 'Aceitar'}
          </Sans>
        </Pressable>
        <Pressable
          disabled={!activeRun.id || Boolean(operatorActioning)}
          onPress={() => { void applyOperatorAction('needs_human') }}
          style={({ pressed }) => [
            styles.inlineButton,
            {
              borderColor: c.border,
              backgroundColor: pressed && !operatorActioning ? c.premium : c.surface,
              opacity: activeRun.id && !operatorActioning ? 1 : 0.45,
            },
          ]}
        >
          <Sans weight="sb" size={12} lineHeight={16} color={c.bronze}>
            {operatorActioning === 'needs_human' ? 'Marcando' : 'Humano'}
          </Sans>
        </Pressable>
        <Pressable
          disabled={!activeRun.id || Boolean(operatorActioning)}
          onPress={() => { void applyOperatorAction('reject') }}
          style={({ pressed }) => [
            styles.inlineButton,
            {
              borderColor: c.border,
              backgroundColor: pressed && !operatorActioning ? c.premium : c.surface,
              opacity: activeRun.id && !operatorActioning ? 1 : 0.45,
            },
          ]}
        >
          <Sans weight="sb" size={12} lineHeight={16} color={c.recRed}>
            {operatorActioning === 'reject' ? 'Rejeitando' : 'Rejeitar'}
          </Sans>
        </Pressable>
        <Pressable
          disabled={!activeRun.id || Boolean(operatorActioning)}
          onPress={() => { void applyOperatorAction('cancel') }}
          style={({ pressed }) => [
            styles.inlineButton,
            {
              borderColor: c.border,
              backgroundColor: pressed && !operatorActioning ? c.premium : c.surface,
              opacity: activeRun.id && !operatorActioning ? 1 : 0.45,
            },
          ]}
        >
          <Sans weight="sb" size={12} lineHeight={16} color={c.recRed}>
            {operatorActioning === 'cancel' ? 'Cancelando' : 'Cancelar'}
          </Sans>
        </Pressable>
      </View>
      {activeRun.operator_actions?.length ? (
        <View style={styles.auditSection}>
          <View style={styles.sectionHead}>
            <Label>Ações</Label>
            <Mono size={10.5} lineHeight={14} color={c.ink2}>{activeRun.operator_actions.length}</Mono>
          </View>
          {activeRun.operator_actions.slice(0, 4).map((action) => (
            <AuditRow
              key={action.id}
              title={`${statusLabel(action.action)} · ${action.actor ?? '-'}`}
              meta={`${statusLabel(action.status_before ?? 'unknown')} -> ${statusLabel(action.status_after ?? 'unknown')} · ${dateLabel(action.acted_at)}`}
              status={action.status_after ?? action.action}
              detail={action.note}
            />
          ))}
        </View>
      ) : null}
      {Object.keys(autonomy).length ? (
        <View style={styles.metricsCompact}>
          <Metric label="autonomia" value={statusLabel(textValue(autonomy.status, 'unknown'))} tone={textValue(autonomy.status, null)} />
          <Metric label="sandbox" value={textValue(autonomy.effective_sandbox, '-')} />
          <Metric label="permissão" value={textValue(autonomy.effective_permission, '-')} />
          <Metric label="ações" value={String(autonomyActions.length)} tone={autonomyActions.length ? 'warning' : 'passed'} />
        </View>
      ) : null}

      {firstPatch ? (
        <View style={styles.auditSection}>
          <View style={styles.sectionHead}>
            <Label>Patch</Label>
            <StatusPill status={firstPatch.risk_flags?.length ? 'warning' : 'passed'} compact />
          </View>
          <Mono size={10.3} lineHeight={15} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
            {(firstPatch.changed_files ?? []).slice(0, 6).join(', ') || '-'}
          </Mono>
          {firstPatch.diff_excerpt ? (
            <View style={[styles.monoBox, { borderColor: c.border, backgroundColor: c.bg }]}>
              <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink} numberOfLines={10}>
                {firstPatch.diff_excerpt}
              </Mono>
            </View>
          ) : null}
          <Pressable
            disabled={diffLoading}
            onPress={() => { void loadPatchDiff() }}
            style={({ pressed }) => [
              styles.inlineButton,
              {
                borderColor: c.border,
                backgroundColor: diffLoading ? c.bg : c.surface,
                opacity: pressed && !diffLoading ? 0.82 : 1,
              },
            ]}
          >
            <Sans weight="sb" size={12} lineHeight={16} color={c.ink}>
              {diffLoading ? 'Abrindo diff' : (patchDiff ? 'Atualizar diff completo' : 'Abrir diff completo')}
            </Sans>
          </Pressable>
          {patchDiff ? (
            <View style={[styles.monoBox, { borderColor: c.border, backgroundColor: c.bg }]}>
              <Mono size={10.1} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
                {patchDiffMeta?.source ?? '-'} · {patchDiffMeta?.returnedBytes ?? 0} bytes · hash {patchDiffMeta?.hashMatches === true ? 'ok' : 'verificar'}{patchDiffMeta?.truncated ? ' · truncado' : ''}
              </Mono>
              <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink} numberOfLines={80}>
                {patchDiff}
              </Mono>
            </View>
          ) : null}
        </View>
      ) : null}

      {findings.length ? (
        <View style={styles.auditSection}>
          <View style={styles.sectionHead}>
            <Label>Findings</Label>
            <Mono size={10.5} lineHeight={14} color={c.ink2}>{findings.length}</Mono>
          </View>
          {findings.slice(0, 6).map((finding) => (
            <AuditRow
              key={finding.id}
              title={`${finding.severity.toUpperCase()} · ${finding.title}`}
              meta={fileLineLabel(finding.file_path, finding.start_line)}
              status={finding.status}
              detail={finding.body}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.auditSection}>
        <View style={styles.sectionHead}>
          <Label>Controles</Label>
          <Mono size={10.5} lineHeight={14} color={c.ink2}>{controls.length}</Mono>
        </View>
        {controls.slice(0, 8).map((control, index) => (
          <AuditRow
            key={control.id ?? `${control.control_slug}-${index}`}
            title={control.control_slug}
            meta={`v${control.control_version ?? '-'} · ${control.duration_ms ?? 0}ms`}
            status={control.status}
            detail={control.summary ?? control.output_excerpt}
          />
        ))}
      </View>

      <View style={styles.auditSection}>
        <View style={styles.sectionHead}>
          <Label>Testes</Label>
          <Mono size={10.5} lineHeight={14} color={c.ink2}>{tests.length}</Mono>
        </View>
        {tests.slice(0, 6).map((test, index) => (
          <AuditRow
            key={test.id ?? `${test.command}-${index}`}
            title={test.command ?? 'test'}
            meta={`${test.type ?? 'test'} · exit ${test.exit_code ?? '-'} · ${test.duration_ms ?? 0}ms`}
            status={test.status}
            detail={testRunDetail(test)}
          />
        ))}
      </View>

      {artifactTests.length ? (
        <View style={styles.auditSection}>
          <View style={styles.sectionHead}>
            <Label>Artifacts</Label>
            <Mono size={10.5} lineHeight={14} color={c.ink2}>{artifactFiles.length || artifactTests.length}</Mono>
          </View>
          <View style={styles.artifactButtonRow}>
            {artifactTests.slice(0, 4).map((test, index) => (
              <Pressable
                key={test.id ?? `${test.command}-${index}`}
                disabled={artifactLoading}
                onPress={() => { void loadArtifacts(test) }}
                style={({ pressed }) => [
                  styles.artifactButton,
                  {
                    borderColor: artifactTestId === test.id ? c.bronze : c.border,
                    backgroundColor: artifactTestId === test.id ? c.premium : c.surface,
                    opacity: pressed && !artifactLoading ? 0.82 : 1,
                  },
                ]}
              >
                <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink} numberOfLines={1}>
                  {test.type ?? 'test'} · {index + 1}
                </Mono>
              </Pressable>
            ))}
          </View>
          {artifactFiles.slice(0, 12).map((file) => (
            <ArtifactFileRow
              key={file.path}
              file={file}
              loading={artifactContentLoading && artifactContent?.artifact.path !== file.path}
              active={artifactContent?.artifact.path === file.path}
              onPress={file.readable_inline ? () => { void loadArtifactContent(file) } : undefined}
            />
          ))}
          {artifactContent ? (
            <View style={[styles.monoBox, { borderColor: c.border, backgroundColor: c.bg }]}>
              <Mono size={10.1} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
                {artifactContent.artifact.path} · {bytesLabel(artifactContent.artifact.returned_bytes)}{artifactContent.artifact.truncated ? ' · truncado' : ''}
              </Mono>
              {artifactContent.data_url ? (
                <Image source={{ uri: artifactContent.data_url }} resizeMode="contain" style={[styles.artifactImage, { backgroundColor: c.surface }]} />
              ) : (
                <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink} numberOfLines={80}>
                  {artifactContent.content ?? '-'}
                </Mono>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      {attemptComparison?.attempts?.length ? (
        <View style={styles.auditSection}>
          <View style={styles.sectionHead}>
            <Label>Comparação de attempts</Label>
            <Mono size={10.5} lineHeight={14} color={c.ink2}>{statusLabel(attemptComparison.status)}</Mono>
          </View>
          <View style={styles.metricsCompact}>
            <Metric label="melhor" value={attemptComparison.best_attempt_number ? `#${attemptComparison.best_attempt_number}` : '-'} tone={attemptComparison.best_recommendation ?? attemptComparison.status} />
            <Metric label="score" value={attemptComparison.best_score == null ? '-' : String(attemptComparison.best_score)} tone={attemptComparison.best_recommendation ?? attemptComparison.status} />
            <Metric label="ação" value={statusLabel(attemptComparison.best_recommendation ?? '-')} tone={attemptComparison.best_recommendation ?? attemptComparison.status} />
          </View>
        </View>
      ) : null}

      <View style={styles.auditSection}>
        <View style={styles.sectionHead}>
          <Label>Tentativas</Label>
          <Mono size={10.5} lineHeight={14} color={c.ink2}>{attempts.length}</Mono>
        </View>
        {attempts.slice(0, 6).map((attempt) => {
          const comparison = comparisonByAttemptId.get(attempt.id)
          const attemptReplayActive = replayingAttemptId === attempt.id
          const attemptReplayDisabled = !activeRun.id || replaying || Boolean(replayingAttemptId)

          return (
            <View key={attempt.id} style={[styles.auditRow, { borderColor: c.border, backgroundColor: c.bg }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Sans weight="med" size={12.2} lineHeight={17} color={c.ink} numberOfLines={1}>
                  {`#${attempt.attempt_number} · ${attempt.phase ?? 'edit'}`}
                </Sans>
                <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
                  {`${attempt.provider ?? '-'} · ${attempt.model ?? '-'}${comparison ? ` · score ${comparison.score} · rank ${comparison.rank}` : ''}`}
                </Mono>
                {attempt.failure_summary || attempt.changed_files?.length ? (
                  <Sans size={11.3} lineHeight={16} color={statusColor(attempt.status ?? 'unknown', c)} numberOfLines={3}>
                    {attempt.failure_summary ?? (attempt.changed_files ?? []).slice(0, 4).join(', ')}
                  </Sans>
                ) : null}
              </View>
              <View style={styles.statusStack}>
                <StatusPill status={attempt.status ?? 'unknown'} compact />
                {comparison ? (
                  <Mono size={9.5} lineHeight={13} letterSpacing={0.1} color={statusColor(comparison.recommendation, c)} numberOfLines={1}>
                    {statusLabel(comparison.recommendation)}
                  </Mono>
                ) : null}
                <Pressable
                  disabled={attemptReplayDisabled}
                  onPress={() => { void replayAttemptSensors(attempt.id) }}
                  style={({ pressed }) => [
                    styles.attemptReplayButton,
                    {
                      borderColor: c.border,
                      backgroundColor: pressed && !attemptReplayDisabled ? c.premium : c.surface,
                      opacity: attemptReplayDisabled && !attemptReplayActive ? 0.45 : 1,
                    },
                  ]}
                >
                  <Sans weight="sb" size={11} lineHeight={15} color={c.prussian}>
                    {attemptReplayActive ? 'Replay' : 'Reexecutar'}
                  </Sans>
                </Pressable>
              </View>
            </View>
          )
        })}
      </View>

      {activeRun.timeline?.length ? (
        <View style={styles.auditSection}>
          <View style={styles.sectionHead}>
            <Label>Timeline</Label>
            <Mono size={10.5} lineHeight={14} color={c.ink2}>{activeRun.timeline.length}</Mono>
          </View>
          {activeRun.timeline.slice(-8).map((event, index) => (
            <AuditRow
              key={`${event.type}-${event.ref_id ?? index}`}
              title={event.label ?? event.type}
              meta={`${event.type} · ${dateLabel(event.at)}`}
              status={event.status}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

function AuditRow({
  title,
  meta,
  status,
  detail,
}: {
  title: string
  meta?: string | null
  status?: string | null
  detail?: string | null
}) {
  const c = usePalette()

  return (
    <View style={[styles.auditRow, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={12.2} lineHeight={17} color={c.ink} numberOfLines={1}>
          {title}
        </Sans>
        {meta ? (
          <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
            {meta}
          </Mono>
        ) : null}
        {detail ? (
          <Sans size={11.3} lineHeight={16} color={statusColor(status ?? 'unknown', c)} numberOfLines={3}>
            {detail}
          </Sans>
        ) : null}
      </View>
      <StatusPill status={status} compact />
    </View>
  )
}

function ArtifactFileRow({
  file,
  loading,
  active,
  onPress,
}: {
  file: AtlasEngineeringTestArtifactFile
  loading?: boolean
  active?: boolean
  onPress?: () => void
}) {
  const c = usePalette()

  return (
    <Pressable
      disabled={!onPress || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.auditRow,
        {
          borderColor: active ? c.bronze : c.border,
          backgroundColor: active ? c.premium : c.bg,
          opacity: pressed && onPress && !loading ? 0.84 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={12.2} lineHeight={17} color={c.ink} numberOfLines={1}>
          {file.path}
        </Sans>
        <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
          {file.kind} · {bytesLabel(file.bytes)} · {file.readable_inline ? 'inline' : 'download'}
        </Mono>
      </View>
      <StatusPill status={file.readable_inline ? (loading ? 'running' : 'passed') : 'skipped'} compact />
    </Pressable>
  )
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const c = usePalette()

  return (
    <View style={[styles.segmented, { borderColor: c.border, backgroundColor: c.bg }]}>
      {options.map((option) => {
        const active = option.value === value

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segmentedItem,
              {
                backgroundColor: active ? c.prussian : 'transparent',
                opacity: pressed ? 0.86 : 1,
              },
            ]}
          >
            <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={active ? c.onInk : c.ink2}>
              {option.label}
            </Mono>
          </Pressable>
        )
      })}
    </View>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string | null }) {
  const c = usePalette()

  return (
    <View style={[styles.metric, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Label>{label}</Label>
      <Mono size={16} lineHeight={21} letterSpacing={0.1} color={statusColor(tone ?? value, c)}>
        {value}
      </Mono>
    </View>
  )
}

function StatusPill({ status, compact = false }: { status: string | null | undefined; compact?: boolean }) {
  const c = usePalette()
  const normalized = status ?? 'unknown'

  return (
    <View style={[styles.statusPill, compact && styles.statusPillCompact, { borderColor: statusColor(normalized, c) }]}>
      <Mono size={compact ? 9.5 : 10.5} lineHeight={compact ? 12 : 14} letterSpacing={0.1} color={statusColor(normalized, c)}>
        {statusLabel(normalized)}
      </Mono>
    </View>
  )
}

function aggregateSuites(suites: AtlasEngineeringBenchmarkSuiteSummary[]): {
  status: string
  passRate: number | null
  averageScore: number | null
} {
  const latestRuns = suites
    .map((suite) => suite.latest_run)
    .filter((run): run is AtlasEngineeringBenchmarkRunSummary => Boolean(run))
  if (latestRuns.length === 0) return { status: 'unknown', passRate: null, averageScore: null }

  const passRates = latestRuns
    .map((run) => run.pass_rate)
    .filter((value): value is number => typeof value === 'number')
  const scores = latestRuns
    .map((run) => run.average_score)
    .filter((value): value is number => typeof value === 'number')
  const failed = latestRuns.some((run) => run.status === 'failed' || run.release_gate_status === 'failed')
  const warning = latestRuns.some((run) => run.release_gate_status === 'warning')

  return {
    status: failed ? 'failed' : (warning ? 'warning' : 'passed'),
    passRate: passRates.length ? Math.round(passRates.reduce((sum, value) => sum + value, 0) / passRates.length) : null,
    averageScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
  }
}

function corpusNumber(manifest: Record<string, unknown> | null | undefined, key: string): number {
  const value = manifest?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function corpusReleaseCount(manifest: Record<string, unknown> | null | undefined): number {
  const subsets = objectValue(manifest?.official_subsets)
  const release = numberValue(subsets.release)
  return release ?? 0
}

function statusLabel(status: string): string {
  switch (status) {
    case 'passed':
    case 'resolved':
    case 'active':
      return 'ok'
    case 'failed':
    case 'unresolved':
    case 'unsafe':
      return 'falha'
    case 'partial':
    case 'reviewing':
      return 'revisar'
    case 'running':
      return 'rodando'
    case 'empty':
      return 'vazio'
    case 'first_baseline':
      return 'base'
    case 'improved':
      return 'melhor'
    case 'regressed':
      return 'regrediu'
    case 'stable':
      return 'estável'
    case 'warning':
      return 'aviso'
    case 'skipped':
      return 'pulado'
    case 'missing':
      return 'faltando'
    case 'allowed':
      return 'permitido'
    case 'approved':
      return 'aprovado'
    case 'not_approved':
      return 'sem aprovação'
    case 'not_configured':
      return 'sem policy'
    case 'denied':
      return 'negado'
    case 'requires_approval':
      return 'aprovar'
    case 'release_ready':
      return 'pronto'
    case 'needs_review':
      return 'revisar'
    case 'blocked':
      return 'bloq'
    case 'healthy':
    case 'ready':
      return 'saudável'
    case 'documented':
      return 'doc'
    case 'module_documented':
      return 'módulo'
    case 'undocumented':
      return 'sem doc'
    case 'current':
    case 'fresh':
      return 'atual'
    case 'drift_detected':
      return 'drift'
    case 'empty_index':
      return 'vazio'
    case 'not_audited':
      return 'auditar'
    case 'missing_target':
      return 'faltando'
    case 'accepted':
      return 'aceito'
    case 'degraded':
      return 'degradou'
    case 'incident':
      return 'incidente'
    case 'rolled_back':
      return 'rollback'
    case 'monitoring':
      return 'monitorar'
    case 'pending':
      return 'pendente'
    case 'cancelled':
      return 'cancelado'
    case 'cancel':
      return 'cancelar'
    case 'accept':
      return 'aceitar'
    case 'reject':
      return 'rejeitar'
    case 'needs_human':
      return 'humano'
    case 'unchanged':
      return 'mantida'
    case 'adjusted':
      return 'ajustada'
    case 'insufficient_data':
      return 'sem dados'
    case 'watch':
      return 'atenção'
    case 'conservative':
      return 'restrito'
    case 'ranked':
      return 'rank'
    case 'single_attempt':
      return 'único'
    case 'best_repair_base':
      return 'melhor base'
    case 'review_before_replay':
      return 'revisar base'
    case 'avoid_replay_base':
      return 'evitar base'
    default:
      return status || '-'
  }
}

function statusColor(status: string, c: ReturnType<typeof usePalette>): string {
  const normalized = status.toLowerCase()
  if (['passed', 'resolved', 'ok', 'active', 'ready'].includes(normalized)) return c.moss
  if (['improved', 'melhor', 'release_ready', 'healthy', 'documented', 'current', 'fresh', 'accepted', 'accept', 'best_repair_base', 'allowed', 'approved'].includes(normalized)) return c.moss
  if (['failed', 'unresolved', 'unsafe', 'falha', 'regressed', 'blocked', 'degraded', 'incident', 'rolled_back', 'cancelled', 'cancel', 'reject', 'missing_target', 'missing', 'denied'].includes(normalized)) return c.recRed
  if (['avoid_replay_base'].includes(normalized)) return c.recRed
  if (['partial', 'reviewing', 'running', 'first_baseline', 'stable', 'warning', 'needs_review', 'monitoring', 'pending', 'watch', 'conservative', 'adjusted', 'needs_human', 'ranked', 'single_attempt', 'review_before_replay', 'module_documented', 'undocumented', 'drift_detected', 'empty_index', 'requires_approval', 'not_approved', 'not_configured'].includes(normalized)) return c.bronze
  return c.ink2
}

function deltaLabel(value: number | null | undefined, suffix = ''): string {
  if (typeof value !== 'number') return '-'
  const sign = value > 0 ? '+' : ''

  return `${sign}${value}${suffix}`
}

function percentValue(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '-'
}

function bytesLabel(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  if (value >= 1_048_576) return `${Math.round(value / 10_485.76) / 100} MB`
  if (value >= 1024) return `${Math.round(value / 10.24) / 100} KB`
  return `${value} B`
}

function qualityDebt(run: AtlasEngineeringBenchmarkRunSummary): number {
  return (run.failed_control_count ?? 0)
    + (run.blocked_control_count ?? 0)
    + (run.skipped_required_control_count ?? 0)
    + (run.failed_test_count ?? 0)
    + (run.blocking_review_finding_count ?? 0)
}

function testRunDetail(test: AtlasEngineeringTestRunSummary): string | null {
  const quality = objectValue(test.quality_scan_result)
  const summary = objectValue(quality.summary)
  const status = textValue(quality.status, null)
  if (status) {
    const findings = numberValue(summary.finding_count) ?? 0
    const failedTools = numberValue(summary.failed_count) ?? 0
    const recommendations = numberValue(summary.recommendation_count) ?? 0

    return `quality ${status} · findings ${findings} · tools falhas ${failedTools} · recomendações ${recommendations}`
  }

  return test.stderr_excerpt ?? test.stdout_excerpt ?? textValue(test.visual_smoke?.status, null)
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function textValue(value: unknown, fallback: string | null = '-'): string {
  return typeof value === 'string' && value.trim() ? value : (fallback ?? '')
}

function fileLineLabel(filePath: string | null | undefined, startLine?: number | null): string {
  if (!filePath) return '-'
  return startLine ? `${filePath}:${startLine}` : filePath
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricsCompact: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  metric: {
    flex: 1,
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  suiteRail: {
    gap: 8,
    paddingBottom: 14,
  },
  suiteButton: {
    width: 174,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  panelTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  emptyState: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  seedButton: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  formBlock: {
    marginTop: 14,
    gap: 8,
  },
  input: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 12.5,
    fontFamily: 'JetBrainsMono_400Regular',
  },
  segmented: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 3,
    flexDirection: 'row',
    gap: 3,
  },
  segmentedItem: {
    flex: 1,
    minHeight: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  runButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsList: {
    gap: 8,
    marginTop: 2,
    marginBottom: 12,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  resultRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  trendRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trendDelta: {
    alignItems: 'flex-end',
    gap: 5,
  },
  caseRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusStack: {
    alignItems: 'flex-end',
    gap: 5,
  },
  gateBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  auditSection: {
    marginTop: 14,
    gap: 8,
  },
  auditRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  monoBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  detailLine: {
    gap: 3,
  },
  inlineButton: {
    minHeight: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  inlineButtonTiny: {
    minHeight: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: 190,
  },
  rivalsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  rivalsHistory: {
    gap: 8,
    marginTop: 12,
  },
  filterBlock: {
    marginTop: 14,
    gap: 10,
  },
  filterGroup: {
    gap: 6,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    minHeight: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  memoryActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  artifactButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  artifactButton: {
    minHeight: 34,
    minWidth: 86,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  attemptReplayButton: {
    minHeight: 30,
    minWidth: 78,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  artifactImage: {
    width: '100%',
    minHeight: 180,
    maxHeight: 360,
    borderRadius: 8,
  },
})
