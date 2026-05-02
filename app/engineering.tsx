import { Image, RefreshControl, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import { memoryEngineeringRunReviewParams } from '../lib/memoryReviewNavigation'
import {
  applyEngineeringRunOperatorAction,
  calibrateEngineeringBenchmarkSuite,
  calibrateEngineeringHarnessability,
  ensureDefaultEngineeringBenchmarkSuite,
  fetchEngineeringBenchmarkRun,
  fetchEngineeringBenchmarkSuite,
  fetchEngineeringBenchmarkTrends,
  fetchEngineeringHarnessabilityCalibration,
  fetchEngineeringRunPatchDiff,
  fetchEngineeringTestRunArtifactContent,
  listEngineeringTestRunArtifacts,
  listEngineeringBenchmarkSuites,
  replayEngineeringRun,
  replayEngineeringRunAttempt,
  runEngineeringBenchmarkSuite,
  type AtlasEngineeringAttemptComparisonRow,
  type AtlasEngineeringBenchmarkResultSummary,
  type AtlasEngineeringBenchmarkRunResponse,
  type AtlasEngineeringBenchmarkRunSummary,
  type AtlasEngineeringBenchmarkSuiteResponse,
  type AtlasEngineeringBenchmarkSuiteSummary,
  type AtlasEngineeringBenchmarkTrendsResponse,
  type AtlasEngineeringTestArtifactContentResponse,
  type AtlasEngineeringTestArtifactFile,
  type AtlasEngineeringRunSummary,
  type AtlasEngineeringTestRunSummary,
} from '../lib/api/client'

export default function EngineeringScreen() {
  const c = usePalette()
  const { showToast } = useShell()
  const [suites, setSuites] = useState<AtlasEngineeringBenchmarkSuiteSummary[]>([])
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null)
  const [suiteDetail, setSuiteDetail] = useState<AtlasEngineeringBenchmarkSuiteResponse | null>(null)
  const [trends, setTrends] = useState<AtlasEngineeringBenchmarkTrendsResponse | null>(null)
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
  const [running, setRunning] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [harnessCalibration, setHarnessCalibration] = useState<Record<string, unknown> | null>(null)
  const [calibratingHarness, setCalibratingHarness] = useState(false)

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

  const loadHarnessCalibration = useCallback(async () => {
    try {
      const response = await fetchEngineeringHarnessabilityCalibration()
      setHarnessCalibration(response.harnessability_calibration)
    } catch {
      setHarnessCalibration(null)
    }
  }, [])

  useEffect(() => {
    void loadSuites()
    void loadHarnessCalibration()
  }, [loadSuites, loadHarnessCalibration])

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
      loadHarnessCalibration(),
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

  return (
    <Screen
      topExtra={22}
      refreshControl={<RefreshControl refreshing={loading || detailLoading} onRefresh={() => { void refresh() }} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Engineering Harness</Label>
          <Sans weight="sb" size={23} lineHeight={29} color={c.ink}>
            Atlas-Bench
          </Sans>
        </View>
        <StatusPill status={aggregate.status} />
      </View>

      <View style={styles.metrics}>
        <Metric label="suites" value={String(suites.length)} />
        <Metric label="pass rate" value={aggregate.passRate == null ? '-' : `${aggregate.passRate}%`} tone={aggregate.status} />
        <Metric label="score" value={aggregate.averageScore == null ? '-' : String(aggregate.averageScore)} />
      </View>

      <HarnessabilityCalibrationCard
        calibration={harnessCalibration}
        calibrating={calibratingHarness}
        onCalibrate={() => { void calibrateHarnessability() }}
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
            <Label>Provider</Label>
            <Segmented
              value={runMode}
              options={[
                { value: 'sensors', label: 'Sensores' },
                { value: 'host', label: 'Host' },
                { value: 'docker', label: 'Docker' },
              ]}
              onChange={(value) => setRunMode(value as 'sensors' | 'host' | 'docker')}
            />
            <Label>Modelo</Label>
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder="sonnet, opus, spark ou id do modelo"
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
                  {running ? 'Executando' : 'Rodar benchmark'}
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
    case 'release_ready':
      return 'pronto'
    case 'needs_review':
      return 'revisar'
    case 'blocked':
      return 'bloq'
    case 'healthy':
      return 'saudável'
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
  if (['passed', 'resolved', 'ok', 'active'].includes(normalized)) return c.moss
  if (['improved', 'melhor', 'release_ready', 'healthy', 'accepted', 'accept', 'best_repair_base'].includes(normalized)) return c.moss
  if (['failed', 'unresolved', 'unsafe', 'falha', 'regressed', 'blocked', 'degraded', 'incident', 'rolled_back', 'cancelled', 'cancel', 'reject'].includes(normalized)) return c.recRed
  if (['avoid_replay_base'].includes(normalized)) return c.recRed
  if (['partial', 'reviewing', 'running', 'first_baseline', 'stable', 'warning', 'needs_review', 'monitoring', 'pending', 'watch', 'conservative', 'adjusted', 'needs_human', 'ranked', 'single_attempt', 'review_before_replay'].includes(normalized)) return c.bronze
  return c.ink2
}

function deltaLabel(value: number | null | undefined, suffix = ''): string {
  if (typeof value !== 'number') return '-'
  const sign = value > 0 ? '+' : ''

  return `${sign}${value}${suffix}`
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
  inlineButton: {
    minHeight: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
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
