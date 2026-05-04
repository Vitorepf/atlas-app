import { RefreshControl, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Screen } from '../components/Screen'
import { SectionHeader } from '../components/SectionHeader'
import { Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import { copyToClipboard } from '../lib/clipboard'
import {
  openBrainAuditLine,
  openBrainContextPackCopyText,
  openBrainContextPackSummary,
  openBrainMaintenanceLine,
  openBrainMemoryQualityLine,
  openBrainQualityHistoryLine,
  openBrainRecallItemBody,
  openBrainRecallItemTitle,
  openBrainRecallSummary,
  openBrainTrendDriverLine,
} from '../lib/openBrain'
import {
  AtlasApiError,
  buildAtlasOpenBrainContextPack,
  getAtlasMemoryQuality,
  getAtlasMemoryQualityHistory,
  listAtlasOpenBrainAudits,
  recallAtlasMemory,
  runAtlasMemoryMaintenance,
  type AtlasMemoryQuality,
  type AtlasMemoryQualityHistory,
  type AtlasMemoryQualitySnapshot,
  type AtlasMemoryQualityTrendDriver,
  type AtlasMemoryMaintenance,
  type AtlasMemoryMaintenanceResponse,
  type AtlasMemoryMaintenanceStage,
  type AtlasMemoryRecall,
  type AtlasOpenBrainAudit,
  type AtlasOpenBrainContextPack,
} from '../lib/api/client'

const DEFAULT_WORKSPACE = '/Users/vitorepf/Develop/atlas/atlas-server'
const DEFAULT_OBJECTIVE = 'continuar a implementação do Atlas com memória, Open Brain e contexto provider-safe'

type BusyAction = 'recall' | 'context-pack' | 'audits' | 'maintain' | 'apply-projection' | null

export default function OpenBrainScreen() {
  const c = usePalette()
  const { showToast } = useShell()
  const [workspace, setWorkspace] = useState(DEFAULT_WORKSPACE)
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVE)
  const [recall, setRecall] = useState<AtlasMemoryRecall | null>(null)
  const [contextPack, setContextPack] = useState<AtlasOpenBrainContextPack | null>(null)
  const [audits, setAudits] = useState<AtlasOpenBrainAudit[]>([])
  const [maintenance, setMaintenance] = useState<AtlasMemoryMaintenance | null>(null)
  const [memoryQuality, setMemoryQuality] = useState<AtlasMemoryQuality | null>(null)
  const [memoryQualityHistory, setMemoryQualityHistory] = useState<AtlasMemoryQualityHistory | null>(null)
  const [busy, setBusy] = useState<BusyAction>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectionApplyArmed, setProjectionApplyArmed] = useState(false)

  const resolvedWorkspace = workspace.trim()
  const resolvedObjective = objective.trim()
  const contextPackCopy = useMemo(() => openBrainContextPackCopyText(contextPack), [contextPack])
  const contextPackPreview = useMemo(() => contextPackCopy.slice(0, 1800), [contextPackCopy])

  const loadAudits = useCallback(async () => {
    const response = await listAtlasOpenBrainAudits({ limit: 12 })
    setAudits(response.open_brain_audits)
  }, [])

  const loadMemoryQuality = useCallback(async () => {
    const targetWorkspace = resolvedWorkspace || DEFAULT_WORKSPACE
    const [qualityResponse, historyResponse] = await Promise.all([
      getAtlasMemoryQuality({ workspace: targetWorkspace }),
      getAtlasMemoryQualityHistory({ workspace: targetWorkspace, days: 30, limit: 12 }),
    ])
    setMemoryQuality(qualityResponse.memory_quality)
    setMemoryQualityHistory(historyResponse.memory_quality_history)
  }, [resolvedWorkspace])

  const loadMaintenanceStatus = useCallback(async () => {
    const response = await runMemoryMaintenance({
      workspace: resolvedWorkspace || DEFAULT_WORKSPACE,
      dry_run: true,
      sync: false,
      index_code: false,
      include_drift_audit: false,
    })
    setMaintenance(response.memory_maintenance)
  }, [resolvedWorkspace])

  useEffect(() => {
    let mounted = true
    setRefreshing(true)

    Promise.allSettled([loadAudits(), loadMaintenanceStatus(), loadMemoryQuality()])
      .then((results) => {
        if (!mounted) return
        const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined
        if (rejected) setError(errorMessage(rejected.reason, 'Não consegui carregar Open Brain.'))
      })
      .finally(() => {
        if (mounted) setRefreshing(false)
      })

    return () => {
      mounted = false
    }
  }, [loadAudits, loadMaintenanceStatus, loadMemoryQuality])

  const refresh = useCallback(async () => {
    setError(null)
    setRefreshing(true)
    try {
      await Promise.all([loadAudits(), loadMaintenanceStatus(), loadMemoryQuality()])
    } catch (refreshError) {
      setError(errorMessage(refreshError, 'Não consegui atualizar Open Brain.'))
    } finally {
      setRefreshing(false)
    }
  }, [loadAudits, loadMaintenanceStatus, loadMemoryQuality])

  async function runRecall(): Promise<void> {
    if (!resolvedObjective) {
      showToast('Informe a pergunta')
      return
    }

    setBusy('recall')
    setError(null)
    try {
      const response = await recallAtlasMemory({
        query: resolvedObjective,
        context: { workspace: resolvedWorkspace || DEFAULT_WORKSPACE },
        options: {
          limit: 8,
          budget_chars: 2600,
          item_chars: 420,
          include_registry: true,
          include_verbatim: true,
          include_semantic: true,
        },
      })
      setRecall(response.memory_recall)
      showToast('Recall pronto', { variant: 'checkin' })
    } catch (recallError) {
      setError(errorMessage(recallError, 'Não consegui buscar memória.'))
    } finally {
      setBusy(null)
    }
  }

  async function buildContextPack(): Promise<void> {
    if (!resolvedObjective) {
      showToast('Informe o objetivo')
      return
    }

    setBusy('context-pack')
    setError(null)
    try {
      const response = await buildAtlasOpenBrainContextPack({
        objective: resolvedObjective,
        workspace: resolvedWorkspace || DEFAULT_WORKSPACE,
        task_type: 'dev',
        desired_mode: 'professional',
        agent: 'codex',
        requester: 'atlas-app',
        include_prompt: true,
        options: {
          include_memory_registry: true,
          include_verbatim_recall: true,
          include_semantic_context: true,
          memory_recall_limit: 10,
          memory_recall_budget_chars: 4200,
          memory_recall_item_chars: 480,
        },
      })
      setContextPack(response.open_brain)
      await loadAudits().catch(() => null)
      showToast('Context pack pronto', { variant: 'checkin' })
    } catch (contextError) {
      setError(errorMessage(contextError, 'Não consegui gerar context pack.'))
    } finally {
      setBusy(null)
    }
  }

  async function reloadAudits(): Promise<void> {
    setBusy('audits')
    setError(null)
    try {
      await loadAudits()
      showToast('Auditorias atualizadas', { variant: 'checkin' })
    } catch (auditError) {
      setError(errorMessage(auditError, 'Não consegui carregar auditorias.'))
    } finally {
      setBusy(null)
    }
  }

  async function runMaintain(): Promise<void> {
    setProjectionApplyArmed(false)
    setBusy('maintain')
    setError(null)
    try {
      const response = await runMemoryMaintenance({
        workspace: resolvedWorkspace || DEFAULT_WORKSPACE,
        dry_run: false,
        sync: true,
        index_code: true,
        prune: true,
        include_drift_audit: true,
      })
      setMaintenance(response.memory_maintenance)
      setMemoryQuality(memoryQualityFromMaintenance(response.memory_maintenance) ?? memoryQuality)
      await loadMemoryQuality().catch(() => null)
      await loadAudits().catch(() => null)
      showToast(memoryToast(response.memory_maintenance), { variant: response.memory_maintenance.ok ? 'checkin' : undefined })
    } catch (maintainError) {
      const recovered = maintenanceFromError(maintainError)
      if (recovered) {
        setMaintenance(recovered)
        setMemoryQuality(memoryQualityFromMaintenance(recovered) ?? memoryQuality)
      }
      setError(errorMessage(maintainError, 'Memory maintain falhou.'))
    } finally {
      setBusy(null)
    }
  }

  async function applyProjection(): Promise<void> {
    if (!projectionApplyArmed) {
      setProjectionApplyArmed(true)
      showToast('Toque novamente para aplicar projection')
      return
    }

    setBusy('apply-projection')
    setError(null)
    try {
      const response = await runMemoryMaintenance({
        workspace: resolvedWorkspace || DEFAULT_WORKSPACE,
        dry_run: false,
        sync: false,
        index_code: false,
        prune: true,
        include_drift_audit: true,
        apply_projection: true,
        confirm: true,
      })
      setMaintenance(response.memory_maintenance)
      setMemoryQuality(memoryQualityFromMaintenance(response.memory_maintenance) ?? memoryQuality)
      await loadMemoryQuality().catch(() => null)
      setProjectionApplyArmed(false)
      await loadAudits().catch(() => null)
      showToast(memoryToast(response.memory_maintenance), { variant: response.memory_maintenance.ok ? 'checkin' : undefined })
    } catch (projectionError) {
      const recovered = maintenanceFromError(projectionError)
      if (recovered) {
        setMaintenance(recovered)
        setMemoryQuality(memoryQualityFromMaintenance(recovered) ?? memoryQuality)
      }
      setError(errorMessage(projectionError, 'Não consegui aplicar projection.'))
    } finally {
      setBusy(null)
    }
  }

  async function copyPack(): Promise<void> {
    if (!contextPackCopy) {
      showToast('Gere um context pack primeiro')
      return
    }

    await copyToClipboard(contextPackCopy, () => showToast('Context pack copiado', { variant: 'checkin' }))
  }

  return (
    <Screen
      topExtra={22}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh() }} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Atlas Open Brain</Label>
          <Sans weight="sb" size={24} lineHeight={30} color={c.ink}>
            Recall e context pack
          </Sans>
          <Mono size={10.5} lineHeight={15} letterSpacing={0.15} color={c.ink2}>
            provider-safe · MCP local · manutenção
          </Mono>
        </View>
        <StatusPill value={maintenance?.status ?? 'loading'} tone={maintenance?.ok === false ? 'bad' : 'good'} />
      </View>

      {error ? (
        <View style={[styles.notice, { borderColor: c.recRed, backgroundColor: c.surface }]}>
          <Sans weight="sb" size={13} lineHeight={18} color={c.recRed}>Open Brain</Sans>
          <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>{error}</Mono>
        </View>
      ) : null}

      <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Label>Workspace</Label>
        <TextInput
          value={workspace}
          onChangeText={(value) => {
            setWorkspace(value)
            setProjectionApplyArmed(false)
          }}
          placeholder="/path/do/atlas-server"
          placeholderTextColor={c.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
        />

        <Label>Objetivo</Label>
        <TextInput
          value={objective}
          onChangeText={setObjective}
          placeholder="pergunta, tarefa ou objetivo para recall"
          placeholderTextColor={c.ink3}
          autoCapitalize="sentences"
          autoCorrect
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.textArea, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
        />

        <View style={styles.buttonGrid}>
          <ActionButton
            label={busy === 'recall' ? 'Buscando' : 'Buscar memória'}
            disabled={busy !== null}
            tone="primary"
            onPress={() => { void runRecall() }}
          />
          <ActionButton
            label={busy === 'context-pack' ? 'Gerando' : 'Gerar context pack'}
            disabled={busy !== null}
            tone="primary"
            onPress={() => { void buildContextPack() }}
          />
          <ActionButton
            label="Copiar context pack"
            disabled={busy !== null || !contextPack}
            onPress={() => { void copyPack() }}
          />
          <ActionButton
            label={busy === 'audits' ? 'Carregando' : 'Auditorias'}
            disabled={busy !== null}
            onPress={() => { void reloadAudits() }}
          />
        </View>
      </View>

      <SectionHeader label="Recall" />
      <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
        <View style={styles.panelTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Sans weight="sb" size={15} lineHeight={21} color={c.ink}>Memória relevante</Sans>
            <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
              {openBrainRecallSummary(recall)}
            </Mono>
          </View>
          <CountPill value={String(recall?.recall.length ?? 0)} />
        </View>

        <View style={styles.list}>
          {(recall?.recall ?? []).slice(0, 8).map((item, index) => (
            <View key={`${item.source ?? 'memory'}:${item.id ?? item.source_ref_id ?? index}`} style={[styles.row, { borderColor: c.border, backgroundColor: c.bg }]}>
              <Mono size={10} lineHeight={14} letterSpacing={0.1} color={c.bronze}>{String(item.rank ?? index + 1).padStart(2, '0')}</Mono>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Sans weight="sb" size={13} lineHeight={18} color={c.ink} numberOfLines={2}>
                  {openBrainRecallItemTitle(item)}
                </Sans>
                <Mono size={10.5} lineHeight={15} letterSpacing={0.05} color={c.ink2} numberOfLines={4}>
                  {openBrainRecallItemBody(item) || item.reason || 'sem resumo'}
                </Mono>
                <Mono size={10} lineHeight={14} letterSpacing={0.08} color={c.ink3} numberOfLines={1}>
                  {item.source ?? 'memory'} · {item.type ?? item.source_ref_type ?? 'context'} · score {formatNumber(item.score)}
                </Mono>
              </View>
            </View>
          ))}
          {recall && recall.recall.length === 0 ? <EmptyLine text="nenhuma memória provider-safe encontrada" /> : null}
          {!recall ? <EmptyLine text="execute recall para montar a lista" /> : null}
        </View>
      </View>

      <SectionHeader label="Context Pack" />
      <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
        <View style={styles.panelTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Sans weight="sb" size={15} lineHeight={21} color={c.ink}>Pacote para Claude/Codex</Sans>
            <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
              {openBrainContextPackSummary(contextPack)}
            </Mono>
          </View>
          <StatusPill value={contextPack?.ok ? 'safe' : 'pending'} tone={contextPack?.ok ? 'good' : 'neutral'} />
        </View>

        {contextPack ? (
          <>
            <View style={styles.metrics}>
              <Metric label="refs" value={String(contextPack.summary.context_refs_count ?? 0)} />
              <Metric label="memórias" value={String(contextPack.summary.memory_refs_count ?? 0)} />
              <Metric label="recall" value={String(contextPack.summary.recall_count ?? 0)} />
            </View>
            <View style={[styles.preview, { borderColor: c.border, backgroundColor: c.bg }]}>
              <Mono size={10.5} lineHeight={15} letterSpacing={0.05} color={c.ink2}>
                {contextPackPreview || JSON.stringify(contextPack.context_pack, null, 2).slice(0, 1800)}
              </Mono>
            </View>
          </>
        ) : (
          <EmptyLine text="gere um context pack para ver o payload" />
        )}
      </View>

      <SectionHeader label="Qualidade" />
      <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
        <View style={styles.panelTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Sans weight="sb" size={15} lineHeight={21} color={c.ink}>Memory Quality Gate</Sans>
            <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
              {openBrainMemoryQualityLine(memoryQuality)}
            </Mono>
            <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink3}>
              {openBrainQualityHistoryLine(memoryQualityHistory)}
            </Mono>
          </View>
          <StatusPill
            value={String(memoryQuality?.trend?.status ?? memoryQualityHistory?.summary?.trend_status ?? 'loading')}
            tone={qualityTone(String(memoryQuality?.trend?.status ?? memoryQuality?.status ?? 'unknown'))}
          />
        </View>

        <View style={styles.metrics}>
          <Metric label="score" value={String(memoryQuality?.score ?? '-')} />
          <Metric label="ativas" value={String(numberAt(memoryQuality?.counts, 'active') ?? '-')} />
          <Metric label="safe" value={String(numberAt(memoryQuality?.counts, 'provider_safe_active') ?? '-')} />
        </View>

        {(memoryQuality?.trend?.drivers ?? []).length > 0 ? (
          <View style={[styles.preview, { borderColor: c.border, backgroundColor: c.bg }]}>
            <Label>Drivers</Label>
            {(memoryQuality?.trend?.drivers ?? []).slice(0, 5).map((driver, index) => (
              <Mono key={`${driver.kind ?? 'driver'}:${driver.key ?? index}`} size={10.5} lineHeight={15} letterSpacing={0.05} color={driver.severity === 'warning' ? c.recRed : c.ink2}>
                {index + 1}. {openBrainTrendDriverLine(driver)}
              </Mono>
            ))}
          </View>
        ) : null}

        <View style={styles.list}>
          {(memoryQualityHistory?.snapshots ?? []).slice(0, 5).map((snapshot) => (
            <QualitySnapshotRow key={snapshot.id} snapshot={snapshot} />
          ))}
          {memoryQualityHistory && memoryQualityHistory.snapshots.length === 0 ? <EmptyLine text="nenhum snapshot registrado" /> : null}
          {!memoryQualityHistory ? <EmptyLine text="carregando histórico de qualidade" /> : null}
        </View>
      </View>

      <SectionHeader label="Memory Maintain" />
      <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
        <View style={styles.panelTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Sans weight="sb" size={15} lineHeight={21} color={c.ink}>Manutenção operacional</Sans>
            <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
              {openBrainMaintenanceLine(maintenance)}
            </Mono>
          </View>
          <StatusPill value={maintenance?.ok ? 'ready' : (maintenance?.status ?? 'check')} tone={maintenance?.ok ? 'good' : 'bad'} />
        </View>

        <View style={styles.buttonGrid}>
          <ActionButton
            label={busy === 'maintain' ? 'Rodando' : 'Rodar maintain'}
            disabled={busy !== null}
            tone="primary"
            onPress={() => { void runMaintain() }}
          />
          <ActionButton
            label={projectionApplyArmed ? 'Confirmar apply' : 'Aplicar projection'}
            disabled={busy !== null}
            tone={projectionApplyArmed ? 'danger' : 'secondary'}
            onPress={() => { void applyProjection() }}
          />
        </View>

        <View style={styles.list}>
          <StageRow label="docs" stage={maintenance?.stages.knowledge_sync} />
          <StageRow label="code" stage={maintenance?.stages.code_index} />
          <StageRow label="projection" stage={maintenance?.stages.provider_projection_status} />
          <StageRow label="health" stage={maintenance?.stages.mcp_health} />
        </View>

        {(maintenance?.stages.mcp_health?.next_actions ?? []).length > 0 ? (
          <View style={[styles.preview, { borderColor: c.border, backgroundColor: c.bg }]}>
            {(maintenance?.stages.mcp_health?.next_actions ?? []).slice(0, 5).map((action, index) => (
              <Mono key={`${action}:${index}`} size={10.5} lineHeight={15} letterSpacing={0.05} color={c.ink2}>
                {index + 1}. {action}
              </Mono>
            ))}
          </View>
        ) : null}
      </View>

      <SectionHeader label="Auditorias" />
      <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
        <View style={styles.list}>
          {audits.map((audit) => (
            <View key={audit.id} style={[styles.row, { borderColor: c.border, backgroundColor: c.bg }]}>
              <View style={[styles.auditDot, { backgroundColor: audit.provider_safe ? c.moss : c.recRed }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Sans weight="sb" size={13} lineHeight={18} color={c.ink} numberOfLines={1}>
                  {openBrainAuditLine(audit)}
                </Sans>
                <Mono size={10.5} lineHeight={15} letterSpacing={0.05} color={c.ink2} numberOfLines={2}>
                  {dateLabel(audit.accessed_at)} · refs {audit.context_refs_count} · memórias {audit.memory_refs_count} · {audit.context_pack_hash?.slice(0, 10) ?? 'sem hash'}
                </Mono>
              </View>
            </View>
          ))}
          {audits.length === 0 ? <EmptyLine text="nenhuma auditoria registrada" /> : null}
        </View>
      </View>
    </Screen>
  )
}

function ActionButton({
  label,
  disabled = false,
  tone = 'secondary',
  onPress,
}: {
  label: string
  disabled?: boolean
  tone?: 'primary' | 'secondary' | 'danger'
  onPress: () => void
}) {
  const c = usePalette()
  const backgroundColor = tone === 'primary'
    ? c.prussian
    : tone === 'danger'
      ? c.recRed
      : c.surface
  const borderColor = tone === 'secondary' ? c.border : backgroundColor
  const textColor = tone === 'secondary' ? c.ink : c.onInk

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.48 : pressed ? 0.86 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
      ]}
    >
      <Sans weight="sb" size={12.5} lineHeight={17} color={textColor} numberOfLines={1}>
        {label}
      </Sans>
    </Pressable>
  )
}

function StatusPill({ value, tone }: { value: string; tone: 'good' | 'bad' | 'neutral' }) {
  const c = usePalette()
  const color = tone === 'good' ? c.moss : tone === 'bad' ? c.recRed : c.ink2

  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Mono size={10} lineHeight={14} letterSpacing={0.2} color={color} numberOfLines={1}>
        {value}
      </Mono>
    </View>
  )
}

function CountPill({ value }: { value: string }) {
  const c = usePalette()

  return (
    <View style={[styles.countPill, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Mono size={11} lineHeight={15} letterSpacing={0.2} color={c.ink2}>{value}</Mono>
    </View>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  const c = usePalette()

  return (
    <View style={[styles.metric, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Label>{label}</Label>
      <Sans weight="sb" size={17} lineHeight={22} color={c.ink}>{value}</Sans>
    </View>
  )
}

function StageRow({ label, stage }: { label: string; stage?: AtlasMemoryMaintenanceStage }) {
  const c = usePalette()
  const ok = stage?.ok !== false
  const status = String(stage?.overall_status ?? stage?.status ?? (stage ? 'ok' : 'pending'))

  return (
    <View style={[styles.stageRow, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Label style={{ minWidth: 82 }}>{label}</Label>
      <Mono size={10.5} lineHeight={15} letterSpacing={0.05} color={ok ? c.ink2 : c.recRed} numberOfLines={2}>
        {status}
      </Mono>
    </View>
  )
}

function QualitySnapshotRow({ snapshot }: { snapshot: AtlasMemoryQualitySnapshot }) {
  const c = usePalette()
  const tone = qualityTone(snapshot.status)

  return (
    <View style={[styles.stageRow, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="sb" size={12.5} lineHeight={17} color={tone === 'bad' ? c.recRed : c.ink} numberOfLines={1}>
          {snapshot.status} · score {snapshot.score}
        </Sans>
        <Mono size={10.5} lineHeight={15} letterSpacing={0.05} color={c.ink2} numberOfLines={1}>
          {dateLabel(snapshot.snapshot_at)} · {snapshot.source_type ?? 'snapshot'}
        </Mono>
      </View>
    </View>
  )
}

function EmptyLine({ text }: { text: string }) {
  const c = usePalette()

  return (
    <View style={[styles.emptyLine, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Mono size={10.5} lineHeight={15} letterSpacing={0.05} color={c.ink3}>{text}</Mono>
    </View>
  )
}

async function runMemoryMaintenance(input: Parameters<typeof runAtlasMemoryMaintenance>[0]): Promise<AtlasMemoryMaintenanceResponse> {
  try {
    return await runAtlasMemoryMaintenance(input)
  } catch (error) {
    const maintenance = maintenanceFromError(error)
    if (maintenance) return { memory_maintenance: maintenance }
    throw error
  }
}

function maintenanceFromError(error: unknown): AtlasMemoryMaintenance | null {
  if (!(error instanceof AtlasApiError)) return null
  const payload = error.payload
  if (!payload || typeof payload !== 'object') return null
  const maintenance = (payload as { memory_maintenance?: unknown }).memory_maintenance

  return isMaintenance(maintenance) ? maintenance : null
}

function isMaintenance(value: unknown): value is AtlasMemoryMaintenance {
  return Boolean(value && typeof value === 'object' && typeof (value as { status?: unknown }).status === 'string')
}

function memoryQualityFromMaintenance(maintenance: AtlasMemoryMaintenance): AtlasMemoryQuality | null {
  const quality = maintenance.stages.memory_quality

  return isMemoryQuality(quality) ? quality : null
}

function isMemoryQuality(value: unknown): value is AtlasMemoryQuality {
  return Boolean(value && typeof value === 'object'
    && typeof (value as { status?: unknown }).status === 'string'
    && typeof (value as { score?: unknown }).score === 'number')
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message

  return fallback
}

function memoryToast(maintenance: AtlasMemoryMaintenance): string {
  return maintenance.ok ? `Memória ${maintenance.status}` : `Memória ${maintenance.status}`
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

function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-'
}

function numberAt(source: unknown, path: string): number | null {
  if (!source || typeof source !== 'object') return null
  let current: unknown = source
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return null
    current = (current as Record<string, unknown>)[part]
  }

  return typeof current === 'number' && Number.isFinite(current) ? current : null
}

function qualityTone(status: string): 'good' | 'bad' | 'neutral' {
  if (['ready', 'stable', 'improved', 'passed'].includes(status)) return 'good'
  if (['critical', 'empty', 'not_migrated', 'regressed', 'failed'].includes(status)) return 'bad'

  return 'neutral'
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    gap: 4,
    marginBottom: 12,
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  panelTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  input: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
    fontFamily: 'JetBrainsMono_400Regular',
  },
  textArea: {
    minHeight: 92,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  button: {
    minHeight: 40,
    minWidth: '47%',
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pill: {
    minHeight: 28,
    maxWidth: 112,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  countPill: {
    minHeight: 28,
    minWidth: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  list: {
    gap: 8,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  auditDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
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
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    gap: 5,
  },
  stageRow: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyLine: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
  },
})
