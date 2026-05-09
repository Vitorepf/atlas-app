import { RefreshControl, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CreateDomainPanel } from '../components/domains/CreateDomainPanel'
import { PrimaryButton } from '../components/PrimaryButton'
import { Screen } from '../components/Screen'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import { domainColor, domainLabel, type DomainKey } from '../lib/domains'
import { useAtlasStore } from '../lib/atlasStore'
import { memoryProjectReviewParams, memoryTaskReviewParams } from '../lib/memoryReviewNavigation'
import {
  completeTask,
  convertProjectBlockerToTask,
  createProject,
  createProjectEngineeringBlueprint,
  createProjectNextAction,
  deferTask,
  fetchTaskEngineering,
  fetchProjectEngineeringBlueprint,
  freezeTaskEngineeringBlueprint,
  freezeProjectEngineeringBlueprint,
  generateProjectEngineeringTasks,
  listProjectEvents,
  listProjectBlockers,
  listProjects,
  listProjectReviewQueue,
  listProjectSteps,
  activateProjectStep,
  patchProjectStep,
  patchProject,
  rebuildProjectPlan,
  recoverProjectExecution,
  recordTaskEngineeringEvidence,
  recordTaskEngineeringQa,
  resolveProjectBlocker,
  reviewProject,
  scheduleTask,
  startProjectExecution,
  type AtlasEngineeringEvidenceInput,
  type AtlasEngineeringEvidenceResponse,
  type AtlasEngineeringEvidenceStatus,
  type AtlasEngineeringEvidenceType,
  type AtlasEngineeringPackageResponse,
  type AtlasEngineeringProjectBlueprintResponse,
  type AtlasEngineeringQaInput,
  type AtlasProject,
  type AtlasProjectBlocker,
  type AtlasProjectBlockerReasonCode,
  type AtlasProjectBlockerSeverity,
  type AtlasProjectEvent,
  type AtlasProjectStep,
  type AtlasProjectType,
  type ProjectExecutionPacket,
  type ProjectReviewItem,
} from '../lib/api/client'

type ProjectFilter = 'active' | 'attention' | 'blocked' | 'paused' | 'waiting' | 'completed' | 'all'
type ProjectReviewAction = 'mark_reviewed' | 'postpone' | 'ensure_next_action' | 'rebuild_plan' | 'reactivate' | 'recover'
type DeferReasonCode = 'low_energy' | 'too_big' | 'unclear' | 'blocked' | 'waiting' | 'calendar' | 'avoidance' | 'not_now'
type CompletionQuality = 'complete' | 'partial' | 'learned' | 'blocked'
type CompletionDraft = {
  quality: CompletionQuality
  actualMinutes: string
  energyAfter: 1 | 2 | 3 | 4 | 5
  outcome: string
  evidence: string
  nextHint: string
  blockerReasonCode: AtlasProjectBlockerReasonCode
  blockerSeverity: AtlasProjectBlockerSeverity
  waitingOn: string
}
type ProjectCompletionDraft = {
  outcome: string
  evidence: string
  note: string
  force: boolean
}
type ProjectCompletionReadiness = {
  ready: boolean
  openStepCount: number
  blockedStepCount: number
  openTaskCount: number
}
type ProjectCompletionInfo = {
  outcome: string
  evidence: string | null
  force: boolean
}
type EngineeringEvidenceDraft = {
  targetId: string
  evidenceType: AtlasEngineeringEvidenceType
  status: AtlasEngineeringEvidenceStatus
  confidence: string
  summary: string
}
type EngineeringQaDraft = {
  steps: string
  expected: string
  actual: string
  screenshot: string
  consoleOutput: string
  networkOutput: string
  riskNotes: string
}
type EngineeringEvidenceTarget = {
  id: string
  label: string
  evidenceType: AtlasEngineeringEvidenceType
  status: string
}
type ProjectAcceptedPlanSummary = {
  proposalId: string | null
  plannerVersion: string | null
  rationale: string | null
  acceptedAt: string | null
}
type DeferOption = {
  key: string
  label: string
  days: number
  reasonCode: DeferReasonCode
  reason: string
}

type ProjectDraft = {
  title: string
  domain: DomainKey
  projectType: AtlasProjectType
  priority: 'low' | 'normal' | 'high' | 'urgent'
  goal: string
}

type ExecutionLearningSummary = {
  completedActions: number
  averageActualMinutes: number | null
  averageEstimateRatio: number | null
  lastActualMinutes: number | null
  bias: string | null
}

const FILTERS: Array<{ key: ProjectFilter; label: string }> = [
  { key: 'active', label: 'ativos' },
  { key: 'attention', label: 'atenção' },
  { key: 'blocked', label: 'bloqueados' },
  { key: 'waiting', label: 'aguardando' },
  { key: 'paused', label: 'pausados' },
  { key: 'completed', label: 'concluídos' },
  { key: 'all', label: 'todos' },
]

const PROJECT_TYPES: Array<{ key: AtlasProjectType; label: string }> = [
  { key: 'study', label: 'estudo' },
  { key: 'technical_build', label: 'app/código' },
  { key: 'business', label: 'negócio' },
  { key: 'tedious', label: 'chato' },
  { key: 'personal', label: 'pessoal' },
]

const PRIORITIES: Array<{ key: ProjectDraft['priority']; label: string }> = [
  { key: 'urgent', label: 'urgente' },
  { key: 'high', label: 'alta' },
  { key: 'normal', label: 'normal' },
  { key: 'low', label: 'baixa' },
]

const DEFER_OPTIONS: DeferOption[] = [
  { key: 'tomorrow', label: 'Amanhã', days: 1, reasonCode: 'not_now', reason: 'Adiada para amanhã pela tela de Projetos.' },
  { key: 'low-energy', label: 'Energia baixa', days: 1, reasonCode: 'low_energy', reason: 'Energia baixa; retomar com bloco menor.' },
  { key: 'too-big', label: 'Grande demais', days: 1, reasonCode: 'too_big', reason: 'Ação grande demais; precisa quebrar antes de executar.' },
  { key: 'blocked', label: 'Bloqueio', days: 2, reasonCode: 'blocked', reason: 'Existe um bloqueio ou dependência para resolver.' },
]

const COMPLETION_QUALITIES: Array<{ key: CompletionQuality; label: string; hint: string }> = [
  { key: 'complete', label: 'Concluída', hint: 'A entrega saiu e a etapa pode avançar.' },
  { key: 'partial', label: 'Parcial', hint: 'Houve progresso, mas a mesma ação continua ativa.' },
  { key: 'learned', label: 'Aprendi', hint: 'O objetivo era clareza/aprendizado e já basta para avançar.' },
  { key: 'blocked', label: 'Bloqueou', hint: 'Existe atrito real; a etapa fica bloqueada para destravar depois.' },
]

const BLOCKER_REASONS: Array<{ key: AtlasProjectBlockerReasonCode; label: string }> = [
  { key: 'unclear', label: 'sem clareza' },
  { key: 'too_large', label: 'grande demais' },
  { key: 'boring', label: 'chato' },
  { key: 'energy', label: 'energia' },
  { key: 'waiting_external', label: 'depende de alguém' },
  { key: 'technical_unknown', label: 'dúvida técnica' },
]

const BLOCKER_SEVERITIES: Array<{ key: AtlasProjectBlockerSeverity; label: string }> = [
  { key: 'medium', label: 'normal' },
  { key: 'high', label: 'alta' },
  { key: 'low', label: 'baixa' },
]

const ENGINEERING_EVIDENCE_STATUSES: Array<{ key: AtlasEngineeringEvidenceStatus; label: string }> = [
  { key: 'passed', label: 'passou' },
  { key: 'needs_review', label: 'revisar' },
  { key: 'failed', label: 'falhou' },
  { key: 'not_applicable', label: 'n/a' },
]

const ENERGY_AFTER_OPTIONS = [1, 2, 3, 4, 5] as const

export default function ProjectsScreen() {
  const c = usePalette()
  const router = useRouter()
  const searchParams = useLocalSearchParams()
  const { showToast } = useShell()
  const domains = useAtlasStore((s) => s.domains)
  const refreshDomains = useAtlasStore((s) => s.refreshDomains)
  const [filter, setFilter] = useState<ProjectFilter>('active')
  const [projects, setProjects] = useState<AtlasProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [steps, setSteps] = useState<AtlasProjectStep[]>([])
  const [events, setEvents] = useState<AtlasProjectEvent[]>([])
  const [blockers, setBlockers] = useState<AtlasProjectBlocker[]>([])
  const [engineeringPackage, setEngineeringPackage] = useState<AtlasEngineeringPackageResponse | null>(null)
  const [projectBlueprint, setProjectBlueprint] = useState<AtlasEngineeringProjectBlueprintResponse | null>(null)
  const [engineeringLoading, setEngineeringLoading] = useState(false)
  const [reviewItems, setReviewItems] = useState<ProjectReviewItem[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [nextActionText, setNextActionText] = useState('')
  const [executionPackets, setExecutionPackets] = useState<Record<string, ProjectExecutionPacket>>({})
  const [completionProjectId, setCompletionProjectId] = useState<string | null>(null)
  const [completionDraft, setCompletionDraft] = useState<CompletionDraft>(() => defaultCompletionDraft())
  const [projectCompletionId, setProjectCompletionId] = useState<string | null>(null)
  const [projectCompletionDraft, setProjectCompletionDraft] = useState<ProjectCompletionDraft>(() => defaultProjectCompletionDraft())
  const [draft, setDraft] = useState<ProjectDraft>(() => emptyProjectDraft(domains[0]?.key ?? 'atlas'))

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )
  const selectedTaskId = selectedProject?.active_next_task?.id ?? null
  const preferredProjectId = useMemo(() => {
    const value = searchParams.projectId
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value[0] ?? null
    return null
  }, [searchParams.projectId])

  const health = useMemo(() => projectHealth(projects), [projects])

  const loadReviewQueue = useCallback(async () => {
    setReviewLoading(true)
    try {
      const response = await listProjectReviewQueue({ limit: 8 })
      setReviewItems(response.items)
    } catch {
      setReviewItems([])
    } finally {
      setReviewLoading(false)
    }
  }, [])

  const loadProjectDetails = useCallback(async (projectId: string) => {
    setDetailLoading(true)
    try {
      const [stepResponse, eventResponse, blockerResponse] = await Promise.all([
        listProjectSteps(projectId),
        listProjectEvents(projectId, { limit: 12 }),
        listProjectBlockers(projectId, { limit: 30 }),
      ])
      setSteps(stepResponse.steps)
      setEvents(eventResponse.events)
      setBlockers(blockerResponse.blockers)
    } catch {
      setSteps([])
      setEvents([])
      setBlockers([])
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadProjects = useCallback(async (preferredProjectId?: string | null) => {
    setLoading(true)
    try {
      const response = await listProjects({
        status: filter === 'all' || filter === 'attention' ? undefined : filter,
        limit: 80,
      })
      const visibleProjects = filter === 'attention'
        ? response.projects.filter(projectNeedsAttention)
        : response.projects
      setProjects(visibleProjects)
      setSelectedProjectId((current) => {
        const preferred = preferredProjectId && visibleProjects.some((project) => project.id === preferredProjectId)
          ? preferredProjectId
          : null
        if (preferred) return preferred
        if (current && visibleProjects.some((project) => project.id === current)) return current
        return visibleProjects[0]?.id ?? null
      })
      return visibleProjects
    } catch {
      setProjects([])
      setSelectedProjectId(null)
      showToast('Não consegui carregar projetos')
      return []
    } finally {
      setLoading(false)
    }
  }, [filter, showToast])

  useEffect(() => {
    void refreshDomains()
  }, [refreshDomains])

  useEffect(() => {
    setDraft((current) => ({ ...current, domain: current.domain || domains[0]?.key || 'atlas' }))
  }, [domains])

  useEffect(() => {
    void loadProjects(preferredProjectId)
    void loadReviewQueue()
  }, [loadProjects, loadReviewQueue, preferredProjectId])

  useEffect(() => {
    if (!selectedProjectId) {
      setSteps([])
      setEvents([])
      setBlockers([])
      setProjectBlueprint(null)
      return
    }

    void loadProjectDetails(selectedProjectId)
    void fetchProjectEngineeringBlueprint(selectedProjectId)
      .then(setProjectBlueprint)
      .catch(() => setProjectBlueprint(null))
  }, [loadProjectDetails, selectedProjectId])

  useEffect(() => {
    let cancelled = false

    if (!selectedTaskId) {
      setEngineeringPackage(null)
      setEngineeringLoading(false)
      return () => {
        cancelled = true
      }
    }

    setEngineeringLoading(true)
    void fetchTaskEngineering(selectedTaskId, { limit: 6 })
      .then((response) => {
        if (!cancelled) setEngineeringPackage(response)
      })
      .catch(() => {
        if (!cancelled) setEngineeringPackage(null)
      })
      .finally(() => {
        if (!cancelled) setEngineeringLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedTaskId])

  useEffect(() => {
    setNextActionText(selectedProject?.next_action ?? '')
  }, [selectedProject?.id, selectedProject?.next_action])

  const applyEngineeringEvidenceResponse = useCallback((response: AtlasEngineeringEvidenceResponse) => {
    setEngineeringPackage((current) => {
      if (!current || current.task_id !== response.task_id) return current

      return {
        ...current,
        contract: response.contract,
        blueprint: response.blueprint,
        blueprint_snapshot: response.blueprint_snapshot,
        status_snapshot: response.status_snapshot,
        latest_run: response.latest_run,
        latest_evidence: response.evidence,
        evidence_history: response.evidence_history,
      }
    })
  }, [])

  const applyEngineeringPackageResponse = useCallback((response: AtlasEngineeringPackageResponse) => {
    setEngineeringPackage((current) => {
      if (!current || current.task_id !== response.task_id) return current

      return response
    })
  }, [])

  const refreshProjectBlueprint = useCallback(async (projectId: string) => {
    const response = await fetchProjectEngineeringBlueprint(projectId)
    setProjectBlueprint(response)
    return response
  }, [])

  const reloadProject = async (projectId: string) => {
    await loadProjects(projectId)
    await loadProjectDetails(projectId)
    await loadReviewQueue()
  }

  const runProjectReview = async (
    item: ProjectReviewItem,
    action: ProjectReviewAction,
  ) => {
    if (busyAction) return

    setBusyAction(`review:${item.project.id}`)
    try {
      await reviewProject(item.project.id, {
        action,
        review_interval_days: action === 'postpone' ? 7 : (item.suggestion.review_interval_days ?? 3),
        next_action: action === 'ensure_next_action' ? item.suggestion.proposed_next_action : null,
        target_minutes: action === 'recover' ? item.suggestion.target_minutes ?? 10 : null,
        priority: normalizePriority(item.project.priority),
        metadata: { entrypoint: 'projects_review_panel' },
      })
      showToast(reviewActionToast(action), { variant: 'checkin' })
      await reloadProject(item.project.id)
    } catch {
      showToast('Não consegui revisar o projeto')
    } finally {
      setBusyAction(null)
    }
  }

  const submitProject = async () => {
    const title = draft.title.trim()
    if (!title || busyAction) return

    setBusyAction('create')
    try {
      const response = await createProject({
        title,
        domain: draft.domain,
        goal: draft.goal.trim() || title,
        project_type: draft.projectType,
        priority: draft.priority,
        metadata: { entrypoint: 'projects_screen' },
      })
      setDraft(emptyProjectDraft(draft.domain))
      setCreateOpen(false)
      showToast('Projeto criado', { variant: 'checkin' })
      await reloadProject(response.project.id)
    } catch {
      showToast('Não consegui criar o projeto')
    } finally {
      setBusyAction(null)
    }
  }

  const openCompletionPanel = (project: AtlasProject) => {
    const task = project.active_next_task
    if (!task?.id || busyAction) return

    setCompletionProjectId(project.id)
    setCompletionDraft(defaultCompletionDraft(task.estimated_minutes ?? undefined))
  }

  const completeActiveAction = async (project: AtlasProject) => {
    const task = project.active_next_task
    if (!task?.id || busyAction) return

    setBusyAction(`complete:${project.id}`)
    try {
      const actualMinutes = parsedCompletionMinutes(completionDraft.actualMinutes)
      const outcome = completionDraft.outcome.trim()
      const evidence = completionDraft.evidence.trim()
      const nextHint = completionDraft.nextHint.trim()

      await completeTask(task.id, {
        actual_minutes: actualMinutes,
        completion_quality: completionDraft.quality,
        energy_after: completionDraft.energyAfter,
        note: completionNote(completionDraft),
        outcome: outcome || null,
        evidence: evidence || null,
        blocker: completionDraft.quality === 'blocked' ? outcome || nextHint || null : null,
        blocker_reason_code: completionDraft.quality === 'blocked' ? completionDraft.blockerReasonCode : null,
        blocker_severity: completionDraft.quality === 'blocked' ? completionDraft.blockerSeverity : null,
        unblock_next_action: completionDraft.quality === 'blocked' ? nextHint || null : null,
        waiting_on: completionDraft.quality === 'blocked' ? completionDraft.waitingOn.trim() || null : null,
        next_hint: nextHint || null,
      })
      setCompletionProjectId(null)
      setCompletionDraft(defaultCompletionDraft())
      showToast(completionToast(completionDraft.quality), { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast('Não consegui registrar a execução')
    } finally {
      setBusyAction(null)
    }
  }

  const startExecution = async (project: AtlasProject) => {
    if (busyAction) return

    setBusyAction(`execute:${project.id}`)
    try {
      const response = await startProjectExecution(project.id, {
        available_minutes: project.active_next_task?.estimated_minutes ?? 25,
      })
      setExecutionPackets((current) => ({
        ...current,
        [project.id]: response.packet,
      }))
      showToast('Modo execução iniciado', { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast('Não consegui iniciar a execução')
    } finally {
      setBusyAction(null)
    }
  }

  const recoverProject = async (project: AtlasProject) => {
    if (busyAction) return

    setBusyAction(`recover:${project.id}`)
    try {
      const response = await recoverProjectExecution(project.id, {
        target_minutes: 10,
        reason: project.active_next_task?.failure_reason_last ?? 'Retomada pela tela de Projetos.',
      })
      setExecutionPackets((current) => ({
        ...current,
        [project.id]: response.packet,
      }))
      showToast('Retomada criada', { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast('Não consegui criar a retomada')
    } finally {
      setBusyAction(null)
    }
  }

  const scheduleProjectAction = async (project: AtlasProject) => {
    const task = project.active_next_task
    if (!task?.id || busyAction) return

    setBusyAction(`schedule:${project.id}`)
    try {
      await scheduleTask(task.id, {
        planned_for_date: dateAfterDays(0),
        estimated_minutes: task.estimated_minutes ?? 25,
        note: 'Agendada pela tela de Projetos.',
      })
      showToast('Próxima ação planejada para hoje', { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast('Não consegui agendar a ação')
    } finally {
      setBusyAction(null)
    }
  }

  const deferActiveAction = async (project: AtlasProject, option: DeferOption) => {
    const task = project.active_next_task
    if (!task?.id || busyAction) return

    setBusyAction(`defer:${project.id}:${option.key}`)
    try {
      await deferTask(task.id, {
        defer_until: dateAfterDays(option.days),
        reason_code: option.reasonCode,
        reason: option.reason,
      })
      showToast(`Adiada: ${option.label.toLowerCase()}`, { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast('Não consegui adiar a ação')
    } finally {
      setBusyAction(null)
    }
  }

  const changeProjectStatus = async (project: AtlasProject, status: AtlasProject['status']) => {
    if (busyAction) return

    setBusyAction(`status:${project.id}`)
    try {
      await patchProject(project.id, { status })
      showToast(status === 'active' ? 'Projeto reativado' : 'Projeto atualizado', { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast('Não consegui atualizar o projeto')
    } finally {
      setBusyAction(null)
    }
  }

  const openProjectCompletionPanel = (project: AtlasProject) => {
    if (busyAction) return

    setProjectCompletionId(project.id)
    setProjectCompletionDraft(defaultProjectCompletionDraft())
  }

  const completeProject = async (project: AtlasProject) => {
    if (busyAction) return
    const outcome = projectCompletionDraft.outcome.trim()
    if (!outcome) {
      showToast('Informe o resultado do projeto')
      return
    }

    setBusyAction(`project-complete:${project.id}`)
    try {
      await patchProject(project.id, {
        status: 'completed',
        completion_outcome: outcome,
        completion_evidence: projectCompletionDraft.evidence.trim() || null,
        completion_note: projectCompletionDraft.note.trim() || null,
        force_completion: projectCompletionDraft.force,
      })
      setProjectCompletionId(null)
      setProjectCompletionDraft(defaultProjectCompletionDraft())
      showToast('Projeto concluído', { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast(projectCompletionDraft.force ? 'Não consegui concluir o projeto' : 'Feche pendências ou confirme a conclusão')
    } finally {
      setBusyAction(null)
    }
  }

  const rebuildPlan = async (project: AtlasProject) => {
    if (busyAction) return

    setBusyAction(`rebuild:${project.id}`)
    try {
      await rebuildProjectPlan(project.id, {
        replace: true,
        goal: project.goal,
        priority: normalizePriority(project.priority),
        metadata: { entrypoint: 'projects_screen' },
      })
      showToast('Plano recalculado', { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast('Não consegui recalcular o plano')
    } finally {
      setBusyAction(null)
    }
  }

  const saveNextAction = async (project: AtlasProject) => {
    const title = nextActionText.trim()
    if (!title || busyAction) return

    setBusyAction(`next:${project.id}`)
    try {
      await createProjectNextAction(project.id, {
        title,
        next_action: title,
        priority: normalizePriority(project.priority),
        metadata: { entrypoint: 'projects_screen' },
      })
      showToast('Próxima ação ajustada', { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast('Não consegui ajustar a ação')
    } finally {
      setBusyAction(null)
    }
  }

  const changeStepStatus = async (
    project: AtlasProject,
    step: AtlasProjectStep,
    status: AtlasProjectStep['status'],
  ) => {
    if (busyAction) return

    setBusyAction(`step:${step.id}`)
    try {
      if (status === 'active') {
        await activateProjectStep(project.id, step.id)
      } else {
        await patchProjectStep(project.id, step.id, { status })
      }
      showToast(stepActionToast(status), { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast('Não consegui atualizar a etapa')
    } finally {
      setBusyAction(null)
    }
  }

  const makeBlockerTask = async (project: AtlasProject, blocker: AtlasProjectBlocker) => {
    if (busyAction) return

    setBusyAction(`blocker-task:${blocker.id}`)
    try {
      await convertProjectBlockerToTask(project.id, blocker.id, {
        priority: blocker.severity === 'high' ? 'high' : normalizePriority(project.priority),
      })
      showToast('Tarefa de desbloqueio criada', { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast('Não consegui criar a tarefa de desbloqueio')
    } finally {
      setBusyAction(null)
    }
  }

  const resolveBlocker = async (project: AtlasProject, blocker: AtlasProjectBlocker) => {
    if (busyAction) return

    setBusyAction(`blocker-resolve:${blocker.id}`)
    try {
      await resolveProjectBlocker(project.id, blocker.id, {
        resolution_note: 'Resolvido pela tela de Projetos.',
      })
      showToast('Bloqueio resolvido', { variant: 'checkin' })
      await reloadProject(project.id)
    } catch {
      showToast('Não consegui resolver o bloqueio')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadProjects(selectedProjectId) }} />}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Execução</Label>
          <Frau size={42} lineHeight={46} color={c.ink} style={{ marginTop: 6 }}>
            Projetos
          </Frau>
          <Mono size={11} lineHeight={14} letterSpacing={0.44} color={c.ink2} style={{ marginTop: 5 }}>
            {health.active} ativos · {health.blocked} bloqueados · {health.waiting} aguardando
          </Mono>
        </View>
        <Pressable
          onPress={() => router.replace('/edicao')}
          style={({ pressed }) => [
            styles.roundAction,
            { borderColor: c.border, backgroundColor: pressed ? c.surface : 'transparent' },
          ]}
        >
          <Sans weight="sb" size={12} color={c.prussian}>Edição</Sans>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => (
          <FilterChip
            key={item.key}
            label={item.label}
            active={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </View>

      <View style={[styles.summaryGrid, { borderColor: c.border }]}>
        <Metric label="ativos" value={String(health.active)} />
        <Metric label="sem próxima ação" value={String(health.withoutAction)} tone={health.withoutAction > 0 ? c.recRed : c.moss} />
        <Metric label="bloqueados" value={String(health.blocked)} tone={health.blocked > 0 ? c.bronze : c.ink} />
      </View>

      <ProjectReviewPanel
        items={reviewItems}
        loading={reviewLoading}
        busyAction={busyAction}
        onRefresh={() => { void loadReviewQueue() }}
        onSelect={(projectId) => {
          setFilter('attention')
          setSelectedProjectId(projectId)
        }}
        onRun={runProjectReview}
      />

      <Pressable
        onPress={() => setCreateOpen((open) => !open)}
        style={({ pressed }) => [
          styles.newProjectToggle,
          { backgroundColor: pressed ? c.premium : c.surface, borderColor: c.border },
        ]}
      >
        <Sans weight="sb" size={14} color={c.ink}>
          Novo projeto
        </Sans>
        <Mono size={10.5} lineHeight={14} letterSpacing={0.2} color={c.ink2}>
          {createOpen ? 'fechar' : 'abrir'}
        </Mono>
      </Pressable>

      {createOpen ? (
        <View style={[styles.createPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TextInput
            value={draft.title}
            onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
            placeholder="nome do projeto"
            placeholderTextColor={c.ink3}
            style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
          />
          <TextInput
            value={draft.goal}
            onChangeText={(goal) => setDraft((current) => ({ ...current, goal }))}
            placeholder="resultado desejado"
            placeholderTextColor={c.ink3}
            multiline
            style={[styles.input, styles.textArea, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
          />
          <Label>Domínio</Label>
          <View style={styles.chipRow}>
            {domains.map((domain) => (
              <FilterChip
                key={domain.key}
                label={domain.label}
                active={draft.domain === domain.key}
                accent={domainColor(domain.key, c, domains)}
                onPress={() => setDraft((current) => ({ ...current, domain: domain.key }))}
              />
            ))}
          </View>
          <CreateDomainPanel onCreated={(domain) => setDraft((current) => ({ ...current, domain: domain.key }))} />
          <Label>Tipo</Label>
          <View style={styles.chipRow}>
            {PROJECT_TYPES.map((type) => (
              <FilterChip
                key={type.key}
                label={type.label}
                active={draft.projectType === type.key}
                onPress={() => setDraft((current) => ({ ...current, projectType: type.key }))}
              />
            ))}
          </View>
          <Label>Prioridade</Label>
          <View style={styles.chipRow}>
            {PRIORITIES.map((priority) => (
              <FilterChip
                key={priority.key}
                label={priority.label}
                active={draft.priority === priority.key}
                onPress={() => setDraft((current) => ({ ...current, priority: priority.key }))}
              />
            ))}
          </View>
          <PrimaryButton
            label={busyAction === 'create' ? 'Criando...' : 'Criar projeto executável'}
            onPress={() => { void submitProject() }}
          />
        </View>
      ) : null}

      {projects.length === 0 && !loading ? (
        <View style={[styles.emptyState, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Sans weight="sb" size={15} lineHeight={20} color={c.ink}>
            Nenhum projeto nessa visão
          </Sans>
          <Sans size={12.5} lineHeight={18} color={c.ink2}>
            Crie um projeto ou troque o filtro para ver projetos pausados, bloqueados ou concluídos.
          </Sans>
        </View>
      ) : null}

      <View style={styles.projectList}>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            selected={selectedProjectId === project.id}
            steps={selectedProjectId === project.id ? steps : []}
            events={selectedProjectId === project.id ? events : []}
            blockers={selectedProjectId === project.id ? blockers : []}
            engineeringPackage={selectedProjectId === project.id ? engineeringPackage : null}
            projectBlueprint={selectedProjectId === project.id ? projectBlueprint : null}
            engineeringLoading={selectedProjectId === project.id ? engineeringLoading : false}
            detailLoading={detailLoading && selectedProjectId === project.id}
            nextActionText={selectedProjectId === project.id ? nextActionText : project.next_action ?? ''}
            executionPacket={selectedProjectId === project.id ? executionPackets[project.id] ?? null : null}
            completionOpen={completionProjectId === project.id}
            completionDraft={completionDraft}
            projectCompletionOpen={projectCompletionId === project.id}
            projectCompletionDraft={projectCompletionDraft}
            busyAction={busyAction}
            onSelect={() => setSelectedProjectId(project.id)}
            onNextActionTextChange={setNextActionText}
            onStartExecution={() => { void startExecution(project) }}
            onRecoverProject={() => { void recoverProject(project) }}
            onScheduleProjectAction={() => { void scheduleProjectAction(project) }}
            onOpenCompletion={() => openCompletionPanel(project)}
            onCompletionDraftChange={setCompletionDraft}
            onOpenProjectCompletion={() => openProjectCompletionPanel(project)}
            onProjectCompletionDraftChange={setProjectCompletionDraft}
            onSaveNextAction={() => { void saveNextAction(project) }}
            onCompleteActive={() => { void completeActiveAction(project) }}
            onDeferActive={(option) => { void deferActiveAction(project, option) }}
            onRebuild={() => { void rebuildPlan(project) }}
            onPause={() => { void changeProjectStatus(project, 'paused') }}
            onResume={() => { void changeProjectStatus(project, 'active') }}
            onCompleteProject={() => { void completeProject(project) }}
            onStepStatusChange={(step, status) => { void changeStepStatus(project, step, status) }}
            onMakeBlockerTask={(blocker) => { void makeBlockerTask(project, blocker) }}
            onResolveBlocker={(blocker) => { void resolveBlocker(project, blocker) }}
            onEngineeringEvidenceRecorded={applyEngineeringEvidenceResponse}
            onEngineeringBlueprintFrozen={applyEngineeringPackageResponse}
            onProjectBlueprintChanged={refreshProjectBlueprint}
            onOpenProjectMemory={() => {
              router.push({ pathname: '/memory', params: memoryProjectReviewParams(project.id) })
            }}
            onOpenActiveTaskMemory={() => {
              const taskId = project.active_next_task?.id
              if (!taskId) return
              router.push({ pathname: '/memory', params: memoryTaskReviewParams(taskId, project.id) })
            }}
          />
        ))}
      </View>
    </Screen>
  )
}

function ProjectCard({
  project,
  selected,
  steps,
  events,
  blockers,
  engineeringPackage,
  projectBlueprint,
  engineeringLoading,
  detailLoading,
  nextActionText,
  executionPacket,
  completionOpen,
  completionDraft,
  projectCompletionOpen,
  projectCompletionDraft,
  busyAction,
  onSelect,
  onNextActionTextChange,
  onStartExecution,
  onRecoverProject,
  onScheduleProjectAction,
  onOpenCompletion,
  onCompletionDraftChange,
  onOpenProjectCompletion,
  onProjectCompletionDraftChange,
  onSaveNextAction,
  onCompleteActive,
  onDeferActive,
  onRebuild,
  onPause,
  onResume,
  onCompleteProject,
  onStepStatusChange,
  onMakeBlockerTask,
  onResolveBlocker,
  onEngineeringEvidenceRecorded,
  onEngineeringBlueprintFrozen,
  onProjectBlueprintChanged,
  onOpenProjectMemory,
  onOpenActiveTaskMemory,
}: {
  project: AtlasProject
  selected: boolean
  steps: AtlasProjectStep[]
  events: AtlasProjectEvent[]
  blockers: AtlasProjectBlocker[]
  engineeringPackage: AtlasEngineeringPackageResponse | null
  projectBlueprint: AtlasEngineeringProjectBlueprintResponse | null
  engineeringLoading: boolean
  detailLoading: boolean
  nextActionText: string
  executionPacket: ProjectExecutionPacket | null
  completionOpen: boolean
  completionDraft: CompletionDraft
  projectCompletionOpen: boolean
  projectCompletionDraft: ProjectCompletionDraft
  busyAction: string | null
  onSelect: () => void
  onNextActionTextChange: (text: string) => void
  onStartExecution: () => void
  onRecoverProject: () => void
  onScheduleProjectAction: () => void
  onOpenCompletion: () => void
  onCompletionDraftChange: (draft: CompletionDraft) => void
  onOpenProjectCompletion: () => void
  onProjectCompletionDraftChange: (draft: ProjectCompletionDraft) => void
  onSaveNextAction: () => void
  onCompleteActive: () => void
  onDeferActive: (option: DeferOption) => void
  onRebuild: () => void
  onPause: () => void
  onResume: () => void
  onCompleteProject: () => void
  onStepStatusChange: (step: AtlasProjectStep, status: AtlasProjectStep['status']) => void
  onMakeBlockerTask: (blocker: AtlasProjectBlocker) => void
  onResolveBlocker: (blocker: AtlasProjectBlocker) => void
  onEngineeringEvidenceRecorded: (response: AtlasEngineeringEvidenceResponse) => void
  onEngineeringBlueprintFrozen: (response: AtlasEngineeringPackageResponse) => void
  onProjectBlueprintChanged: (projectId: string) => Promise<AtlasEngineeringProjectBlueprintResponse>
  onOpenProjectMemory: () => void
  onOpenActiveTaskMemory: () => void
}) {
  const c = usePalette()
  const domains = useAtlasStore((s) => s.domains)
  const progress = steps.length > 0
    ? Math.round((steps.filter((step) => step.status === 'done').length / steps.length) * 100)
    : null
  const accent = domainColor(project.domain, c, domains)
  const activeTaskRole = stringValue(project.active_next_task?.metadata.role)
  const canActOnTask = Boolean(project.active_next_task?.id) && (project.status === 'active' || activeTaskRole === 'unblock_action')
  const learning = projectExecutionLearning(project)
  const activeCalibration = taskEstimateCalibration(project.active_next_task ?? null)
  const deferInfo = taskDeferInfo(project.active_next_task ?? null)
  const completionInfo = projectCompletionInfo(project)
  const acceptedPlan = projectAcceptedPlanSummary(project)
  const openBlockers = blockers.filter((blocker) => blocker.status === 'open')

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.projectCard,
        {
          backgroundColor: selected ? c.premium : c.surface,
          borderColor: selected ? accent : c.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Mono size={10.5} lineHeight={14} letterSpacing={0.42} color={accent}>
            {domainLabel(project.domain, domains).toUpperCase()} · {typeLabel(project.project_type).toUpperCase()}
          </Mono>
          <Sans weight="sb" size={17} lineHeight={22} color={c.ink} style={{ marginTop: 5 }}>
            {project.title}
          </Sans>
        </View>
        <StatusPill status={project.status} />
      </View>

      {project.desired_outcome || project.goal ? (
        <Sans size={12.5} lineHeight={18} color={c.ink2} numberOfLines={2}>
          {project.desired_outcome ?? project.goal}
        </Sans>
      ) : null}

      {project.execution_health && project.execution_health.status === 'attention' ? (
        <View style={[styles.attentionBox, { borderColor: c.bronze, backgroundColor: c.bg }]}>
          <Sans weight="sb" size={12.5} lineHeight={17} color={c.bronze}>
            {executionHealthLabel(project)}
          </Sans>
          {(project.execution_health.open_blockers_count ?? project.open_blockers_count ?? 0) > 0 ? (
            <Sans size={11.5} lineHeight={16} color={c.ink2}>
              {project.execution_health.open_blockers_count ?? project.open_blockers_count} bloqueio(s) aberto(s)
            </Sans>
          ) : null}
        </View>
      ) : null}

      <View style={styles.cardFacts}>
        <Fact label="prioridade" value={priorityLabel(project.priority)} />
        <Fact label="etapas" value={String(project.steps_count ?? steps.length ?? 0)} />
        <Fact label="progresso" value={progress === null ? '--' : `${progress}%`} />
      </View>

      {learning ? (
        <View style={[styles.learningBox, { borderColor: c.border, backgroundColor: c.bg }]}>
          <Sans weight="sb" size={12.5} lineHeight={17} color={learningColor(learning.bias, c)}>
            {learningTitle(learning)}
          </Sans>
          <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
            {learningDetail(learning)}
          </Mono>
        </View>
      ) : null}

      {completionInfo ? (
        <View style={[styles.learningBox, { borderColor: c.border, backgroundColor: c.bg }]}>
          <Sans weight="sb" size={12.5} lineHeight={17} color={completionInfo.force ? c.bronze : c.moss}>
            {completionInfo.force ? 'Projeto fechado com pendências' : 'Projeto fechado'}
          </Sans>
          <Sans size={11.5} lineHeight={16} color={c.ink2} numberOfLines={2}>
            {completionInfo.outcome}
          </Sans>
          {completionInfo.evidence ? (
            <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
              evidência: {completionInfo.evidence}
            </Mono>
          ) : null}
        </View>
      ) : null}

      {project.current_step ? (
        <View style={[styles.currentStepBox, { borderColor: c.border, backgroundColor: c.bg }]}>
          <Label>Etapa atual</Label>
          <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink}>
            {project.current_step.title}
          </Sans>
          {project.current_step.expected_output ? (
            <Sans size={11.5} lineHeight={16} color={c.ink2}>
              {project.current_step.expected_output}
            </Sans>
          ) : null}
        </View>
      ) : null}

      {project.active_next_task ? (
        <View style={[styles.activeTaskBox, { borderTopColor: c.border }]}>
          <Label>{activeTaskRole === 'unblock_action' ? 'Ação de desbloqueio' : 'Próxima ação'}</Label>
          <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink}>
            {project.active_next_task.title}
          </Sans>
          <Mono size={10.5} lineHeight={14} letterSpacing={0.2} color={c.ink2}>
            {priorityLabel(project.active_next_task.priority)} · {energyLabel(project.active_next_task.energy_required)} · {project.active_next_task.estimated_minutes}min
            {project.active_next_task.recovery_count > 0 ? ` · retomadas ${project.active_next_task.recovery_count}` : ''}
          </Mono>
          {activeCalibration?.applied ? (
            <Sans size={11.5} lineHeight={16} color={c.ink2}>
              Estimativa ajustada: {activeCalibration.baseMinutes}min para {activeCalibration.calibratedMinutes}min pelo seu histórico.
            </Sans>
          ) : null}
          {project.active_next_task.failure_reason_last ? (
            <Sans size={11.5} lineHeight={16} color={c.ink2}>
              Último atrito: {project.active_next_task.failure_reason_last}
            </Sans>
          ) : null}
          {deferInfo ? (
            <Sans size={11.5} lineHeight={16} color={c.ink2}>
              Adiada: {deferInfo.reasonLabel} · próximo: {deferInfo.actionLabel}
            </Sans>
          ) : null}
        </View>
      ) : null}

      {selected ? (
        <View style={[styles.detailPanel, { borderTopColor: c.border }]}>
          {detailLoading ? (
            <Sans size={12.5} lineHeight={18} color={c.ink2}>
              Carregando plano...
            </Sans>
          ) : (
            <>
              <View style={styles.actionRow}>
                <SmallAction
                  label={busyAction === `execute:${project.id}` ? 'Iniciando' : 'Executar agora'}
                  disabled={!canActOnTask || busyAction != null}
                  onPress={onStartExecution}
                />
                <SmallAction
                  label={busyAction === `recover:${project.id}` ? 'Quebrando' : 'Quebrar menor'}
                  disabled={!canActOnTask || busyAction != null}
                  onPress={onRecoverProject}
                />
                <SmallAction
                  label={busyAction === `schedule:${project.id}` ? 'Agendando' : 'Agendar hoje'}
                  disabled={!canActOnTask || busyAction != null}
                  onPress={onScheduleProjectAction}
                />
                <SmallAction label="Fechar execução" disabled={!canActOnTask || busyAction != null} onPress={onOpenCompletion} />
                {project.status === 'active' ? (
                  <SmallAction label="Pausar" disabled={busyAction != null} onPress={onPause} />
                ) : (
                  <SmallAction label="Reativar" disabled={busyAction != null} onPress={onResume} />
                )}
              </View>

              <View style={styles.actionRow}>
                <SmallAction label="Replanejar" disabled={busyAction != null} onPress={onRebuild} />
                <SmallAction label="Fechar projeto" disabled={busyAction != null} onPress={onOpenProjectCompletion} />
                <SmallAction label="Memória do projeto" disabled={busyAction != null} onPress={onOpenProjectMemory} />
                {project.active_next_task ? (
                  <SmallAction label="Memória da task" disabled={busyAction != null} onPress={onOpenActiveTaskMemory} />
                ) : null}
              </View>

              {acceptedPlan ? (
                <View style={[styles.planAuditBox, { borderColor: c.border, backgroundColor: c.bg }]}>
                  <View style={styles.executionTop}>
                    <Label>Plano aceito</Label>
                    <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
                      {acceptedPlan.acceptedAt ? dateLabel(acceptedPlan.acceptedAt) : acceptedPlan.plannerVersion ?? 'atlas'}
                    </Mono>
                  </View>
                  {acceptedPlan.rationale ? (
                    <Sans size={11.5} lineHeight={16} color={c.ink2}>
                      {acceptedPlan.rationale}
                    </Sans>
                  ) : null}
                  {acceptedPlan.proposalId ? (
                    <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
                      proposta {acceptedPlan.proposalId.slice(0, 8)}
                    </Mono>
                  ) : null}
                </View>
              ) : null}

              {completionOpen && project.active_next_task ? (
                <CompletionPanel
                  draft={completionDraft}
                  estimatedMinutes={project.active_next_task.estimated_minutes ?? null}
                  busy={busyAction === `complete:${project.id}`}
                  disabled={busyAction != null && busyAction !== `complete:${project.id}`}
                  onChange={onCompletionDraftChange}
                  onSubmit={onCompleteActive}
                />
              ) : null}

              {projectCompletionOpen ? (
                <ProjectCompletionPanel
                  draft={projectCompletionDraft}
                  readiness={projectCompletionReadiness(project, steps)}
                  busy={busyAction === `project-complete:${project.id}`}
                  disabled={busyAction != null && busyAction !== `project-complete:${project.id}`}
                  onChange={onProjectCompletionDraftChange}
                  onSubmit={onCompleteProject}
                />
              ) : null}

              <View style={styles.deferPanel}>
                <Label>Adiar por motivo</Label>
                <View style={styles.actionRow}>
                  {DEFER_OPTIONS.map((option) => (
                    <SmallAction
                      key={option.key}
                      label={busyAction === `defer:${project.id}:${option.key}` ? 'Adiando' : option.label}
                      disabled={!canActOnTask || busyAction != null}
                      onPress={() => onDeferActive(option)}
                    />
                  ))}
                </View>
              </View>

              {executionPacket ? (
                <ExecutionPacketView packet={executionPacket} />
              ) : null}

              <ProjectBlueprintPanel
                project={project}
                blueprint={projectBlueprint}
                disabled={busyAction != null}
                onChanged={onProjectBlueprintChanged}
              />

              {project.active_next_task ? (
                <EngineeringPanel
                  packet={engineeringPackage}
                  loading={engineeringLoading}
                  onRecorded={onEngineeringEvidenceRecorded}
                  onBlueprintFrozen={onEngineeringBlueprintFrozen}
                />
              ) : null}

              <View style={[styles.nextEditor, { borderColor: c.border }]}>
                <TextInput
                  value={nextActionText}
                  onChangeText={onNextActionTextChange}
                  placeholder="próxima ação"
                  placeholderTextColor={c.ink3}
                  style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
                />
                <SmallAction label="Salvar próxima ação" disabled={!nextActionText.trim() || busyAction != null} onPress={onSaveNextAction} wide />
              </View>

              <ProjectBlockersPanel
                blockers={openBlockers}
                busyAction={busyAction}
                onMakeTask={onMakeBlockerTask}
                onResolve={onResolveBlocker}
              />

              <StepTimeline
                steps={steps}
                busyAction={busyAction}
                onStepStatusChange={onStepStatusChange}
              />

              {events.length > 0 ? (
                <View style={[styles.eventsBox, { borderTopColor: c.border }]}>
                  <Label>Histórico</Label>
                  {events.slice(0, 5).map((event) => (
                    <Mono key={event.id} size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
                      {eventLabel(event.event_type)} · {dateLabel(event.occurred_at)}
                    </Mono>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </Pressable>
  )
}

function ProjectBlockersPanel({
  blockers,
  busyAction,
  onMakeTask,
  onResolve,
}: {
  blockers: AtlasProjectBlocker[]
  busyAction: string | null
  onMakeTask: (blocker: AtlasProjectBlocker) => void
  onResolve: (blocker: AtlasProjectBlocker) => void
}) {
  const c = usePalette()
  if (blockers.length === 0) return null

  return (
    <View style={[styles.blockerPanel, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.executionTop}>
        <Label>Bloqueios abertos</Label>
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.recRed}>
          {blockers.length}
        </Mono>
      </View>
      {blockers.slice(0, 3).map((blocker) => (
        <View key={blocker.id} style={[styles.blockerItem, { borderTopColor: c.border }]}>
          <View style={styles.executionTop}>
            <Sans weight="sb" size={13} lineHeight={18} color={c.ink} style={{ flex: 1, minWidth: 0 }}>
              {blockerReasonLabel(blocker.reason_code)} · {blockerSeverityLabel(blocker.severity)}
            </Sans>
            <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
              {dateLabel(blocker.updated_at)}
            </Mono>
          </View>
          <Sans size={11.5} lineHeight={16} color={c.ink2} numberOfLines={2}>
            {blocker.description}
          </Sans>
          {blocker.unblock_next_action ? (
            <Sans weight="sb" size={11.5} lineHeight={16} color={c.prussian}>
              Próximo: {blocker.unblock_next_action}
            </Sans>
          ) : null}
          {blocker.unblock_task ? (
            <Sans size={11.5} lineHeight={16} color={c.ink2}>
              Tarefa criada: {blocker.unblock_task.title}
            </Sans>
          ) : null}
          <View style={styles.actionRow}>
            <SmallAction
              label={busyAction === `blocker-task:${blocker.id}` ? 'Criando' : blocker.unblock_task ? 'Atualizar tarefa' : 'Virar tarefa'}
              disabled={busyAction != null}
              onPress={() => onMakeTask(blocker)}
            />
            <SmallAction
              label={busyAction === `blocker-resolve:${blocker.id}` ? 'Resolvendo' : 'Resolvido'}
              disabled={busyAction != null}
              onPress={() => onResolve(blocker)}
            />
          </View>
        </View>
      ))}
    </View>
  )
}

function ExecutionPacketView({ packet }: { packet: ProjectExecutionPacket }) {
  const c = usePalette()

  return (
    <View style={[styles.executionPacket, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.executionTop}>
        <Label>Modo execução</Label>
        <Mono size={10.5} lineHeight={14} letterSpacing={0.2} color={c.prussian}>
          {packet.timebox_minutes ? `${packet.timebox_minutes}min` : 'sem ação'} · {executionModeLabel(packet.mode)}
        </Mono>
      </View>
      {packet.starter_step ? (
        <Sans weight="sb" size={13} lineHeight={18} color={c.ink}>
          {packet.starter_step}
        </Sans>
      ) : null}
      {packet.done_when ? (
        <Sans size={11.5} lineHeight={16} color={c.ink2}>
          Feito quando: {packet.done_when}
        </Sans>
      ) : null}
      {packet.if_then_plan ? (
        <Sans size={11.5} lineHeight={16} color={c.ink2}>
          Se travar: {packet.if_then_plan}
        </Sans>
      ) : null}
      {packet.avoid_now ? (
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
          evitar: {packet.avoid_now}
        </Mono>
      ) : null}
      {packet.why && packet.why.length > 0 ? (
        <View style={styles.executionWhy}>
          <Label>Por que</Label>
          {packet.why.slice(0, 3).map((reason, index) => (
            <Mono key={`${index}:${reason}`} size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
              {reason}
            </Mono>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function EngineeringPanel({
  packet,
  loading,
  onRecorded,
  onBlueprintFrozen,
}: {
  packet: AtlasEngineeringPackageResponse | null
  loading: boolean
  onRecorded: (response: AtlasEngineeringEvidenceResponse) => void
  onBlueprintFrozen: (response: AtlasEngineeringPackageResponse) => void
}) {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const [formOpen, setFormOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [freezingBlueprint, setFreezingBlueprint] = useState(false)
  const [draft, setDraft] = useState<EngineeringEvidenceDraft>(() => defaultEngineeringEvidenceDraft())
  const [qaDraft, setQaDraft] = useState<EngineeringQaDraft>(() => defaultEngineeringQaDraft())

  const targetOptions = useMemo(() => packet ? engineeringEvidenceTargets(packet) : [], [packet])

  useEffect(() => {
    setDraft(defaultEngineeringEvidenceDraft(packet))
    setQaDraft(defaultEngineeringQaDraft())
    setFormOpen(false)
  }, [packet?.task_id])

  const selectedTarget = targetOptions.find((target) => target.id === draft.targetId) ?? targetOptions[0] ?? null

  const freezeBlueprint = async () => {
    if (!packet || freezingBlueprint) return

    setFreezingBlueprint(true)
    try {
      const response = await freezeTaskEngineeringBlueprint(packet.task_id)
      onBlueprintFrozen(response)
      showToast('Blueprint fixado', { variant: 'checkin' })
    } catch {
      showToast('Não consegui fixar o blueprint')
    } finally {
      setFreezingBlueprint(false)
    }
  }

  const submitEvidence = async () => {
    if (!packet || recording) return
    const summary = draft.summary.trim()
    if (!summary) {
      showToast('Descreva a evidência')
      return
    }

    setRecording(true)
    try {
      if ((selectedTarget?.evidenceType ?? draft.evidenceType) === 'manual_qa') {
        const qaInput: AtlasEngineeringQaInput = {
          target_id: (selectedTarget?.id ?? draft.targetId) || null,
          status: draft.status,
          confidence: parsedEngineeringConfidence(draft.confidence),
          summary,
          steps: qaDraft.steps.split(/\r?\n/).map((step) => step.trim()).filter(Boolean),
          expected_result: qaDraft.expected.trim(),
          actual_result: qaDraft.actual.trim(),
          screenshot_url: qaDraft.screenshot.trim() || null,
          console_output: qaDraft.consoleOutput.trim() || null,
          network_output: qaDraft.networkOutput.trim() || null,
          risk_notes: qaDraft.riskNotes.trim() || null,
          visual_required: true,
        }
        await recordTaskEngineeringQa(packet.task_id, qaInput)
        const refreshed = await fetchTaskEngineering(packet.task_id, { limit: 6 })
        onBlueprintFrozen(refreshed)
        setDraft(defaultEngineeringEvidenceDraft(refreshed))
        setQaDraft(defaultEngineeringQaDraft())
      } else {
        const input: AtlasEngineeringEvidenceInput = {
          evidence_type: selectedTarget?.evidenceType ?? draft.evidenceType,
          target_id: (selectedTarget?.id ?? draft.targetId) || null,
          status: draft.status,
          confidence: parsedEngineeringConfidence(draft.confidence),
          summary,
        }
        const response = await recordTaskEngineeringEvidence(packet.task_id, input)
        onRecorded(response)
        setDraft(defaultEngineeringEvidenceDraft({
          ...packet,
          contract: response.contract,
          blueprint: response.blueprint,
          blueprint_snapshot: response.blueprint_snapshot,
          status_snapshot: response.status_snapshot,
          latest_run: response.latest_run,
          latest_evidence: response.evidence,
          evidence_history: response.evidence_history,
        }))
      }
      setFormOpen(false)
      showToast('Evidência registrada', { variant: 'checkin' })
    } catch {
      showToast('Não consegui registrar a evidência')
    } finally {
      setRecording(false)
    }
  }

  if (loading && !packet) {
    return (
      <View style={[styles.engineeringBox, { borderColor: c.border, backgroundColor: c.bg }]}>
        <Label>Engenharia</Label>
        <Sans size={12.5} lineHeight={18} color={c.ink2}>
          Carregando pacote técnico...
        </Sans>
      </View>
    )
  }

  if (!packet) return null

  const gates = packet.status_snapshot.review_gates
  const openGateCount = gates.filter((gate) => engineeringGateNeedsAttention(gate.status)).length
  const latestEvidence = packet.latest_evidence
  const firstAcceptance = packet.status_snapshot.acceptance_checklist[0] ?? null
  const latestDecision = packet.status_snapshot.decision.status
  const latestHarness = packet.latest_harness_run ?? packet.harness_runs?.[0] ?? null
  const latestHarnessDecision = String(latestHarness?.decision ?? latestHarness?.status ?? 'not_applicable')
  const latestHarnessTimeline = Array.isArray(latestHarness?.timeline) ? latestHarness.timeline : []
  const latestHarnessReview = latestHarness?.review_summary

  return (
    <View style={[styles.engineeringBox, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.executionTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Engenharia</Label>
          <Sans weight="sb" size={13} lineHeight={18} color={c.ink} numberOfLines={2}>
            {packet.contract.goal}
          </Sans>
        </View>
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={engineeringStatusColor(String(latestDecision), c)}>
          {engineeringStatusLabel(String(latestDecision))}
        </Mono>
      </View>

      <View style={styles.cardFacts}>
        <Fact label="aceites" value={String(packet.blueprint.acceptance_matrix.length)} />
        <Fact label="gates abertos" value={String(openGateCount)} />
        <Fact label="evidências" value={String(packet.evidence_history.length)} />
        <Fact label="harness" value={latestHarness?.score != null ? String(latestHarness.score) : 'sem'} />
      </View>

      {packet.blueprint_snapshot ? (
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={packet.blueprint_snapshot.matches_current_content ? c.ink2 : c.bronze}>
          blueprint v{packet.blueprint_snapshot.version} · {packet.blueprint_snapshot.matches_current_content ? 'fixado' : 'desatualizado'} · {dateLabel(packet.blueprint_snapshot.frozen_at)}
        </Mono>
      ) : (
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.bronze}>
          blueprint ainda não fixado
        </Mono>
      )}

      {firstAcceptance ? (
        <Sans size={11.5} lineHeight={16} color={c.ink2} numberOfLines={2}>
          Aceite: {firstAcceptance.criterion}
        </Sans>
      ) : null}

      {gates.length > 0 ? (
        <View style={styles.engineeringGateList}>
          {gates.slice(0, 4).map((gate) => (
            <View key={gate.id} style={styles.engineeringGateRow}>
              <Sans size={11.5} lineHeight={16} color={c.ink2} numberOfLines={1} style={{ flex: 1 }}>
                {gate.title}
              </Sans>
              <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={engineeringStatusColor(gate.status, c)}>
                {engineeringStatusLabel(gate.status)}
              </Mono>
            </View>
          ))}
        </View>
      ) : null}

      {latestEvidence ? (
        <View style={styles.engineeringEvidence}>
          <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={engineeringStatusColor(latestEvidence.status, c)}>
            {engineeringStatusLabel(latestEvidence.status)} · {latestEvidence.evidence_type} · {dateLabel(latestEvidence.recorded_at)}
          </Mono>
          <Sans size={11.5} lineHeight={16} color={c.ink2} numberOfLines={2}>
            {latestEvidence.summary}
          </Sans>
        </View>
      ) : null}

      {latestHarness ? (
        <View style={[styles.engineeringHarnessRun, { borderColor: c.border }]}>
          <View style={styles.engineeringGateRow}>
            <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={engineeringStatusColor(latestHarnessDecision, c)} style={{ flex: 1 }}>
              harness · {engineeringStatusLabel(latestHarnessDecision)} · score {latestHarness.score ?? '-'}
            </Mono>
            <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
              {dateLabel(typeof latestHarness.finished_at === 'string' ? latestHarness.finished_at : null)}
            </Mono>
          </View>
          <Sans size={11.5} lineHeight={16} color={c.ink2} numberOfLines={2}>
            {latestHarness.attempt_count ?? 0} attempt(s) · {latestHarness.workspace?.isolated ? 'isolado' : 'workspace'} · {latestHarnessReview?.blocking_count ?? 0} bloqueio(s)
          </Sans>
          {latestHarnessTimeline.length > 0 ? (
            <View style={styles.engineeringTimeline}>
              {latestHarnessTimeline.slice(-3).map((event, index) => (
                <View key={`${event.type}-${event.ref_id ?? index}`} style={styles.engineeringGateRow}>
                  <Sans size={11} lineHeight={15} color={c.ink2} numberOfLines={1} style={{ flex: 1 }}>
                    {event.label ?? event.type}
                  </Sans>
                  <Mono size={10} lineHeight={13} letterSpacing={0.1} color={engineeringStatusColor(event.status, c)}>
                    {engineeringStatusLabel(event.status)}
                  </Mono>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <SmallAction
          label={freezingBlueprint ? 'Fixando' : packet.blueprint_snapshot?.matches_current_content ? 'Blueprint fixado' : 'Fixar blueprint'}
          disabled={freezingBlueprint}
          onPress={() => { void freezeBlueprint() }}
        />
        <SmallAction
          label={formOpen ? 'Fechar evidência' : 'Registrar evidência'}
          disabled={recording}
          onPress={() => setFormOpen((open) => !open)}
        />
        <SmallAction
          label="Benchmarks"
          disabled={recording || freezingBlueprint}
          onPress={() => router.push('/engineering')}
        />
      </View>

      {formOpen ? (
        <View style={[styles.engineeringForm, { borderTopColor: c.border }]}>
          {targetOptions.length > 0 ? (
            <>
              <Label>Alvo</Label>
              <View style={styles.actionRow}>
                {targetOptions.slice(0, 8).map((target) => (
                  <FilterChip
                    key={target.id}
                    label={target.label}
                    active={draft.targetId === target.id}
                    accent={engineeringStatusColor(target.status, c)}
                    onPress={() => setDraft({
                      ...draft,
                      targetId: target.id,
                      evidenceType: target.evidenceType,
                    })}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Label>Status</Label>
          <View style={styles.actionRow}>
            {ENGINEERING_EVIDENCE_STATUSES.map((status) => (
              <FilterChip
                key={status.key}
                label={status.label}
                active={draft.status === status.key}
                accent={engineeringStatusColor(status.key, c)}
                onPress={() => setDraft({ ...draft, status: status.key })}
              />
            ))}
          </View>

          <View style={styles.completionGrid}>
            <View style={{ flex: 1, minWidth: 118, gap: 6 }}>
              <Label>Confiança</Label>
              <TextInput
                value={draft.confidence}
                onChangeText={(confidence) => setDraft({ ...draft, confidence: confidence.replace(/[^0-9.,]/g, '').slice(0, 4) })}
                keyboardType="decimal-pad"
                placeholder="0.86"
                placeholderTextColor={c.ink3}
                style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
              />
            </View>
            <View style={{ flex: 2, minWidth: 150, gap: 6 }}>
              <Label>Tipo</Label>
              <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
                {selectedTarget?.evidenceType ?? draft.evidenceType}
              </Mono>
            </View>
          </View>

          <TextInput
            value={draft.summary}
            onChangeText={(summary) => setDraft({ ...draft, summary })}
            placeholder="o que foi validado, comando executado, arquivo ou decisão observada"
            placeholderTextColor={c.ink3}
            multiline
            style={[styles.input, styles.textArea, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
          />

          {(selectedTarget?.evidenceType ?? draft.evidenceType) === 'manual_qa' ? (
            <View style={styles.blockerReasonBox}>
              <Label>QA manual</Label>
              <TextInput
                value={qaDraft.steps}
                onChangeText={(steps) => setQaDraft({ ...qaDraft, steps })}
                placeholder="um passo por linha"
                placeholderTextColor={c.ink3}
                multiline
                style={[styles.input, styles.textArea, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
              />
              <TextInput
                value={qaDraft.expected}
                onChangeText={(expected) => setQaDraft({ ...qaDraft, expected })}
                placeholder="resultado esperado"
                placeholderTextColor={c.ink3}
                style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
              />
              <TextInput
                value={qaDraft.actual}
                onChangeText={(actual) => setQaDraft({ ...qaDraft, actual })}
                placeholder="resultado real"
                placeholderTextColor={c.ink3}
                style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
              />
              <TextInput
                value={qaDraft.screenshot}
                onChangeText={(screenshot) => setQaDraft({ ...qaDraft, screenshot })}
                placeholder="screenshot/artifact"
                placeholderTextColor={c.ink3}
                style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
              />
              <TextInput
                value={qaDraft.riskNotes}
                onChangeText={(riskNotes) => setQaDraft({ ...qaDraft, riskNotes })}
                placeholder="notas de risco"
                placeholderTextColor={c.ink3}
                style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
              />
            </View>
          ) : null}

          <SmallAction
            label={recording ? 'Registrando' : 'Salvar evidência'}
            disabled={recording || !draft.summary.trim()}
            onPress={() => { void submitEvidence() }}
            wide
          />
        </View>
      ) : null}

      {loading ? (
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
          atualizando...
        </Mono>
      ) : null}
    </View>
  )
}

function ProjectBlueprintPanel({
  project,
  blueprint,
  disabled,
  onChanged,
}: {
  project: AtlasProject
  blueprint: AtlasEngineeringProjectBlueprintResponse | null
  disabled: boolean
  onChanged: (projectId: string) => Promise<AtlasEngineeringProjectBlueprintResponse>
}) {
  const c = usePalette()
  const { showToast } = useShell()
  const [busy, setBusy] = useState<string | null>(null)
  const record = blueprint?.latest ?? blueprint?.frozen ?? null
  const validation = (record?.validation ?? blueprint?.validation ?? {}) as Record<string, unknown>
  const summary = (validation.summary ?? {}) as Record<string, unknown>
  const missingEvidence = Array.isArray(validation.missing_evidence) ? validation.missing_evidence : []
  const blockingGates = Array.isArray(validation.blocking_gates) ? validation.blocking_gates : []

  async function run(action: 'create' | 'freeze' | 'tasks') {
    if (busy || disabled) return
    setBusy(action)
    try {
      if (action === 'create') {
        await createProjectEngineeringBlueprint(project.id)
        await onChanged(project.id)
        showToast('Blueprint de projeto criado', { variant: 'checkin' })
      } else if (action === 'freeze') {
        await freezeProjectEngineeringBlueprint(project.id)
        await onChanged(project.id)
        showToast('Blueprint de projeto fixado', { variant: 'checkin' })
      } else {
        await generateProjectEngineeringTasks(project.id)
        await onChanged(project.id)
        showToast('Tasks geradas do blueprint', { variant: 'checkin' })
      }
    } catch {
      showToast(action === 'freeze' ? 'Blueprint bloqueado por coverage' : 'Não consegui operar o blueprint')
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={[styles.engineeringBox, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.executionTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Blueprint</Label>
          <Sans weight="sb" size={13} lineHeight={18} color={c.ink} numberOfLines={2}>
            {record ? `v${record.version} · ${record.status}` : 'sem draft project-level'}
          </Sans>
        </View>
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={record?.stale ? c.bronze : engineeringStatusColor(String(validation.status ?? record?.status ?? 'draft'), c)}>
          {record?.stale ? 'stale' : String(validation.status ?? record?.status ?? 'draft')}
        </Mono>
      </View>
      <View style={styles.cardFacts}>
        <Fact label="telas" value={String(summary.screen_count ?? 0)} />
        <Fact label="APIs" value={String(summary.api_surface_count ?? 0)} />
        <Fact label="cenários" value={String(summary.scenario_count ?? 0)} />
        <Fact label="gates" value={String(blockingGates.length)} />
      </View>
      {record ? (
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
          {record.content_hash.slice(0, 12)} · {record.frozen_at ? dateLabel(record.frozen_at) : dateLabel(record.prepared_at)}
        </Mono>
      ) : null}
      {missingEvidence.length > 0 ? (
        <Sans size={11.5} lineHeight={16} color={c.bronze} numberOfLines={2}>
          evidências pendentes: {missingEvidence.length}
        </Sans>
      ) : null}
      <View style={styles.actionRow}>
        <SmallAction label={busy === 'create' ? 'Criando' : 'Criar draft'} disabled={disabled || busy != null} onPress={() => { void run('create') }} />
        <SmallAction label={busy === 'freeze' ? 'Fixando' : 'Fixar'} disabled={disabled || busy != null || !record} onPress={() => { void run('freeze') }} />
        <SmallAction label={busy === 'tasks' ? 'Gerando' : 'Gerar tasks'} disabled={disabled || busy != null || record?.status !== 'frozen'} onPress={() => { void run('tasks') }} />
      </View>
    </View>
  )
}

function CompletionPanel({
  draft,
  estimatedMinutes,
  busy,
  disabled,
  onChange,
  onSubmit,
}: {
  draft: CompletionDraft
  estimatedMinutes: number | null
  busy: boolean
  disabled: boolean
  onChange: (draft: CompletionDraft) => void
  onSubmit: () => void
}) {
  const c = usePalette()
  const selectedQuality = COMPLETION_QUALITIES.find((option) => option.key === draft.quality) ?? COMPLETION_QUALITIES[0]

  return (
    <View style={[styles.completionPanel, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.executionTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Fechamento</Label>
          <Sans size={11.5} lineHeight={16} color={c.ink2}>
            {selectedQuality.hint}
          </Sans>
        </View>
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
          estimado {estimatedMinutes ?? '--'}min
        </Mono>
      </View>

      <View style={styles.actionRow}>
        {COMPLETION_QUALITIES.map((option) => (
          <FilterChip
            key={option.key}
            label={option.label}
            active={draft.quality === option.key}
            onPress={() => onChange({ ...draft, quality: option.key })}
            accent={completionQualityColor(option.key, c)}
          />
        ))}
      </View>

      {draft.quality === 'blocked' ? (
        <View style={styles.blockerReasonBox}>
          <Label>Motivo do bloqueio</Label>
          <View style={styles.chipRow}>
            {BLOCKER_REASONS.map((option) => (
              <FilterChip
                key={option.key}
                label={option.label}
                active={draft.blockerReasonCode === option.key}
                accent={c.recRed}
                onPress={() => onChange({ ...draft, blockerReasonCode: option.key })}
              />
            ))}
          </View>
          <Label>Severidade</Label>
          <View style={styles.actionRow}>
            {BLOCKER_SEVERITIES.map((option) => (
              <FilterChip
                key={option.key}
                label={option.label}
                active={draft.blockerSeverity === option.key}
                accent={option.key === 'high' ? c.recRed : c.bronze}
                onPress={() => onChange({ ...draft, blockerSeverity: option.key })}
              />
            ))}
          </View>
          <TextInput
            value={draft.waitingOn}
            onChangeText={(waitingOn) => onChange({ ...draft, waitingOn })}
            placeholder="depende de quem/do quê?"
            placeholderTextColor={c.ink3}
            style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
          />
        </View>
      ) : null}

      <View style={styles.completionGrid}>
        <View style={{ flex: 1, minWidth: 118, gap: 6 }}>
          <Label>Tempo real</Label>
          <TextInput
            value={draft.actualMinutes}
            onChangeText={(actualMinutes) => onChange({ ...draft, actualMinutes: actualMinutes.replace(/[^0-9]/g, '').slice(0, 4) })}
            keyboardType="number-pad"
            placeholder="min"
            placeholderTextColor={c.ink3}
            style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150, gap: 6 }}>
          <Label>Energia depois</Label>
          <View style={styles.energyRow}>
            {ENERGY_AFTER_OPTIONS.map((value) => (
              <Pressable
                key={value}
                onPress={() => onChange({ ...draft, energyAfter: value })}
                style={({ pressed }) => [
                  styles.energyDot,
                  {
                    borderColor: draft.energyAfter === value ? c.prussian : c.border,
                    backgroundColor: draft.energyAfter === value ? c.prussian : 'transparent',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Mono size={10.5} lineHeight={14} letterSpacing={0} color={draft.energyAfter === value ? c.bg : c.ink2}>
                  {value}
                </Mono>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <TextInput
        value={draft.outcome}
        onChangeText={(outcome) => onChange({ ...draft, outcome })}
        placeholder={draft.quality === 'blocked' ? 'o que bloqueou?' : 'resultado gerado'}
        placeholderTextColor={c.ink3}
        multiline
        style={[styles.input, styles.textArea, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
      />
      <TextInput
        value={draft.evidence}
        onChangeText={(evidence) => onChange({ ...draft, evidence })}
        placeholder="evidência, link, arquivo ou critério observado"
        placeholderTextColor={c.ink3}
        multiline
        style={[styles.input, styles.textArea, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
      />
      <TextInput
        value={draft.nextHint}
        onChangeText={(nextHint) => onChange({ ...draft, nextHint })}
        placeholder="próximo passo percebido"
        placeholderTextColor={c.ink3}
        style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
      />

      <SmallAction
        label={busy ? 'Registrando' : completionSubmitLabel(draft.quality)}
        disabled={disabled || busy}
        onPress={onSubmit}
        wide
      />
    </View>
  )
}

function ProjectCompletionPanel({
  draft,
  readiness,
  busy,
  disabled,
  onChange,
  onSubmit,
}: {
  draft: ProjectCompletionDraft
  readiness: ProjectCompletionReadiness
  busy: boolean
  disabled: boolean
  onChange: (draft: ProjectCompletionDraft) => void
  onSubmit: () => void
}) {
  const c = usePalette()
  const needsForce = !readiness.ready

  return (
    <View style={[styles.completionPanel, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.executionTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Fechamento do projeto</Label>
          <Sans size={11.5} lineHeight={16} color={needsForce ? c.bronze : c.ink2}>
            {projectCompletionReadinessLabel(readiness)}
          </Sans>
        </View>
      </View>

      <TextInput
        value={draft.outcome}
        onChangeText={(outcome) => onChange({ ...draft, outcome })}
        placeholder="resultado real entregue"
        placeholderTextColor={c.ink3}
        multiline
        style={[styles.input, styles.textArea, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
      />
      <TextInput
        value={draft.evidence}
        onChangeText={(evidence) => onChange({ ...draft, evidence })}
        placeholder="evidência, link, arquivo, decisão ou critério cumprido"
        placeholderTextColor={c.ink3}
        multiline
        style={[styles.input, styles.textArea, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
      />
      <TextInput
        value={draft.note}
        onChangeText={(note) => onChange({ ...draft, note })}
        placeholder="nota de fechamento"
        placeholderTextColor={c.ink3}
        style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
      />

      {needsForce ? (
        <Pressable
          onPress={() => onChange({ ...draft, force: !draft.force })}
          style={({ pressed }) => [
            styles.forceToggle,
            {
              borderColor: draft.force ? c.bronze : c.border,
              backgroundColor: draft.force ? c.premium : 'transparent',
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <Sans weight="sb" size={12} lineHeight={17} color={draft.force ? c.bronze : c.ink2}>
            {draft.force ? 'Conclusão forçada confirmada' : 'Confirmar conclusão mesmo com pendências'}
          </Sans>
        </Pressable>
      ) : null}

      <SmallAction
        label={busy ? 'Fechando' : 'Concluir projeto'}
        disabled={disabled || busy || !draft.outcome.trim() || (needsForce && !draft.force)}
        onPress={onSubmit}
        wide
      />
    </View>
  )
}

function StepTimeline({
  steps,
  busyAction,
  onStepStatusChange,
}: {
  steps: AtlasProjectStep[]
  busyAction: string | null
  onStepStatusChange: (step: AtlasProjectStep, status: AtlasProjectStep['status']) => void
}) {
  const c = usePalette()
  if (steps.length === 0) {
    return (
      <View style={[styles.emptySteps, { borderColor: c.border }]}>
        <Sans size={12.5} lineHeight={18} color={c.ink2}>
          Plano ainda não criado para este projeto.
        </Sans>
      </View>
    )
  }

  return (
    <View style={styles.stepList}>
      {steps.map((step, index) => (
        <View key={step.id} style={styles.stepRow}>
          <View style={styles.stepRail}>
            <View
              style={[
                styles.stepDot,
                {
                  borderColor: stepColor(step.status, c),
                  backgroundColor: step.status === 'done' ? stepColor(step.status, c) : 'transparent',
                },
              ]}
            />
            {index < steps.length - 1 ? <View style={[styles.stepLine, { backgroundColor: c.border }]} /> : null}
          </View>
          <View style={{ flex: 1, minWidth: 0, paddingBottom: 14 }}>
            <View style={styles.stepTitleRow}>
              <Sans weight="sb" size={13} lineHeight={18} color={c.ink} style={{ flex: 1 }}>
                {String(step.step_order).padStart(2, '0')} · {step.title}
              </Sans>
              <Mono size={10} lineHeight={14} letterSpacing={0.18} color={stepColor(step.status, c)}>
                {stepStatusLabel(step.status)}
              </Mono>
            </View>
            {step.description ? (
              <Sans size={11.5} lineHeight={16} color={c.ink2}>
                {step.description}
              </Sans>
            ) : null}
            <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
              {step.estimated_minutes}min · {energyLabel(step.energy_required)} · fricção {step.friction_level}
            </Mono>
            {step.acceptance_criteria ? (
              <Sans size={11.5} lineHeight={16} color={c.ink2}>
                Aceite: {step.acceptance_criteria}
              </Sans>
            ) : null}
            <View style={styles.stepActions}>
              {step.status !== 'active' && step.status !== 'done' ? (
                <SmallAction
                  label="Ativar"
                  disabled={busyAction != null}
                  onPress={() => onStepStatusChange(step, 'active')}
                />
              ) : null}
              {step.status === 'blocked' ? (
                <SmallAction
                  label="Desbloquear"
                  disabled={busyAction != null}
                  onPress={() => onStepStatusChange(step, 'pending')}
                />
              ) : null}
              {step.status !== 'blocked' && step.status !== 'done' && step.status !== 'skipped' ? (
                <SmallAction
                  label="Bloquear"
                  disabled={busyAction != null}
                  onPress={() => onStepStatusChange(step, 'blocked')}
                />
              ) : null}
              {step.status !== 'done' && step.status !== 'skipped' ? (
                <SmallAction
                  label="Pular"
                  disabled={busyAction != null}
                  onPress={() => onStepStatusChange(step, 'skipped')}
                />
              ) : null}
              {step.status === 'done' || step.status === 'skipped' ? (
                <SmallAction
                  label="Reabrir"
                  disabled={busyAction != null}
                  onPress={() => onStepStatusChange(step, 'pending')}
                />
              ) : null}
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

function ProjectReviewPanel({
  items,
  loading,
  busyAction,
  onRefresh,
  onSelect,
  onRun,
}: {
  items: ProjectReviewItem[]
  loading: boolean
  busyAction: string | null
  onRefresh: () => void
  onSelect: (projectId: string) => void
  onRun: (
    item: ProjectReviewItem,
    action: ProjectReviewAction,
  ) => void
}) {
  const c = usePalette()
  const topItems = items.slice(0, 3)

  return (
    <View style={[styles.reviewPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.reviewHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Revisão</Label>
          <Sans weight="sb" size={15} lineHeight={20} color={c.ink}>
            {loading ? 'Verificando projetos...' : items.length > 0 ? `${items.length} projeto(s) pedem atenção` : 'Nenhum projeto pendente'}
          </Sans>
        </View>
        <SmallAction label="Atualizar" disabled={loading || busyAction != null} onPress={onRefresh} />
      </View>

      {topItems.length === 0 ? (
        <Sans size={12.5} lineHeight={18} color={c.ink2}>
          Projetos ativos têm próxima ação e revisão em dia.
        </Sans>
      ) : (
        <View style={styles.reviewList}>
          {topItems.map((item) => {
            const primaryAction = primaryReviewAction(item)
            return (
              <View key={item.project.id} style={[styles.reviewItem, { borderColor: c.border, backgroundColor: c.bg }]}>
                <Pressable onPress={() => onSelect(item.project.id)} style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}>
                  <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink} numberOfLines={1}>
                    {item.project.title}
                  </Sans>
                  <Sans size={12} lineHeight={17} color={c.ink2} numberOfLines={2}>
                    {reviewReasonLabel(item)}
                  </Sans>
                </Pressable>
                <View style={styles.reviewActions}>
                  <SmallAction
                    label={primaryReviewLabel(primaryAction)}
                    disabled={busyAction != null}
                    onPress={() => onRun(item, primaryAction)}
                  />
                  <SmallAction
                    label="Revisado"
                    disabled={busyAction != null}
                    onPress={() => onRun(item, 'mark_reviewed')}
                  />
                </View>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

function FilterChip({
  label,
  active,
  onPress,
  accent,
}: {
  label: string
  active: boolean
  onPress: () => void
  accent?: string
}) {
  const c = usePalette()
  const activeColor = accent ?? c.prussian

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          borderColor: active ? activeColor : c.border,
          backgroundColor: active ? c.surface : 'transparent',
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <Sans weight="med" size={12.5} color={active ? activeColor : c.ink2}>
        {label}
      </Sans>
    </Pressable>
  )
}

function StatusPill({ status }: { status: string }) {
  const c = usePalette()
  const color = statusColor(status, c)

  return (
    <View style={[styles.statusPill, { borderColor: color }]}>
      <Sans weight="sb" size={10.5} color={color}>
        {projectStatusLabel(status)}
      </Sans>
    </View>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const c = usePalette()

  return (
    <View style={styles.metric}>
      <Frau size={24} lineHeight={28} color={tone ?? c.ink}>
        {value}
      </Frau>
      <Mono size={10.5} lineHeight={14} letterSpacing={0.16} color={c.ink2}>
        {label}
      </Mono>
    </View>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  const c = usePalette()

  return (
    <View style={styles.fact}>
      <Mono size={10} lineHeight={14} letterSpacing={0.14} color={c.ink2}>
        {label}
      </Mono>
      <Sans weight="sb" size={12.5} lineHeight={16} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

function SmallAction({
  label,
  disabled,
  onPress,
  wide,
}: {
  label: string
  disabled?: boolean
  onPress: () => void
  wide?: boolean
}) {
  const c = usePalette()

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.smallAction,
        wide ? styles.smallActionWide : null,
        {
          borderColor: c.border,
          backgroundColor: pressed && !disabled ? c.premium : 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Sans weight="sb" size={11.5} color={c.prussian}>
        {label}
      </Sans>
    </Pressable>
  )
}

function emptyProjectDraft(domain: DomainKey): ProjectDraft {
  return {
    title: '',
    domain,
    projectType: 'personal',
    priority: 'normal',
    goal: '',
  }
}

function defaultCompletionDraft(estimatedMinutes?: number | null): CompletionDraft {
  return {
    quality: 'complete',
    actualMinutes: estimatedMinutes ? String(Math.max(1, Math.round(estimatedMinutes))) : '',
    energyAfter: 3,
    outcome: '',
    evidence: '',
    nextHint: '',
    blockerReasonCode: 'unclear',
    blockerSeverity: 'medium',
    waitingOn: '',
  }
}

function defaultEngineeringEvidenceDraft(packet?: AtlasEngineeringPackageResponse | null): EngineeringEvidenceDraft {
  const targets = packet ? engineeringEvidenceTargets(packet) : []
  const target = targets.find((item) => engineeringGateNeedsAttention(item.status)) ?? targets[0] ?? null

  return {
    targetId: target?.id ?? 'deep_code_review',
    evidenceType: target?.evidenceType ?? 'deep_code_review',
    status: 'passed',
    confidence: '0.86',
    summary: '',
  }
}

function defaultProjectCompletionDraft(): ProjectCompletionDraft {
  return {
    outcome: '',
    evidence: '',
    note: '',
    force: false,
  }
}

function defaultEngineeringQaDraft(): EngineeringQaDraft {
  return {
    steps: '',
    expected: '',
    actual: '',
    screenshot: '',
    consoleOutput: '',
    networkOutput: '',
    riskNotes: '',
  }
}

function engineeringEvidenceTargets(packet: AtlasEngineeringPackageResponse): EngineeringEvidenceTarget[] {
  const acceptanceTargets = packet.status_snapshot.acceptance_checklist.map((item) => ({
    id: item.id,
    label: item.id,
    evidenceType: 'acceptance',
    status: item.status,
  }))

  const gateTargets = packet.status_snapshot.review_gates
    .filter((gate) => gate.id !== 'acceptance_criteria')
    .map((gate) => ({
      id: gate.id,
      label: engineeringGateShortLabel(gate.id, gate.title),
      evidenceType: engineeringGateEvidenceType(gate.id),
      status: gate.status,
    }))

  return [...acceptanceTargets, ...gateTargets].sort((left, right) => (
    Number(engineeringGateNeedsAttention(right.status)) - Number(engineeringGateNeedsAttention(left.status))
  ))
}

function engineeringGateEvidenceType(gateId: string): AtlasEngineeringEvidenceType {
  switch (gateId) {
    case 'validation_evidence':
    case 'manual_qa':
    case 'deep_code_review':
    case 'database_review':
      return gateId
    case 'acceptance_criteria':
    default:
      return 'acceptance'
  }
}

function engineeringGateShortLabel(gateId: string, title: string): string {
  switch (gateId) {
    case 'acceptance_criteria': return 'aceites'
    case 'validation_evidence': return 'validação'
    case 'manual_qa': return 'QA'
    case 'deep_code_review': return 'review'
    case 'database_review': return 'database'
    default: return title.slice(0, 18)
  }
}

function projectCompletionReadiness(project: AtlasProject, steps: AtlasProjectStep[]): ProjectCompletionReadiness {
  const openStepCount = steps.filter((step) => ['active', 'pending', 'blocked'].includes(String(step.status))).length
  const blockedStepCount = steps.filter((step) => step.status === 'blocked').length
  const openTaskCount = project.active_next_task?.id ? 1 : 0

  return {
    ready: openStepCount === 0 && openTaskCount === 0,
    openStepCount,
    blockedStepCount,
    openTaskCount,
  }
}

function projectCompletionReadinessLabel(readiness: ProjectCompletionReadiness): string {
  if (readiness.ready) return 'Sem pendências abertas no plano carregado.'

  const parts = []
  if (readiness.openStepCount > 0) parts.push(`${readiness.openStepCount} etapa${readiness.openStepCount === 1 ? '' : 's'} aberta${readiness.openStepCount === 1 ? '' : 's'}`)
  if (readiness.blockedStepCount > 0) parts.push(`${readiness.blockedStepCount} bloqueada${readiness.blockedStepCount === 1 ? '' : 's'}`)
  if (readiness.openTaskCount > 0) parts.push(`${readiness.openTaskCount} ação ativa`)

  return `${parts.join(' · ')}. Fechar agora arquiva pendências.`
}

function parsedCompletionMinutes(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.min(1440, Math.max(1, parsed))
}

function parsedEngineeringConfidence(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(parsed)) return null

  return Math.min(1, Math.max(0, parsed))
}

function completionNote(draft: CompletionDraft): string {
  const parts = [
    completionQualityLabel(draft.quality),
    draft.quality === 'blocked' ? `Motivo: ${blockerReasonLabel(draft.blockerReasonCode)}` : null,
    draft.outcome.trim() ? `Resultado: ${draft.outcome.trim()}` : null,
    draft.evidence.trim() ? `Evidência: ${draft.evidence.trim()}` : null,
    draft.nextHint.trim() ? `Próximo: ${draft.nextHint.trim()}` : null,
    draft.waitingOn.trim() ? `Depende de: ${draft.waitingOn.trim()}` : null,
  ].filter(Boolean)

  return parts.join(' · ').slice(0, 500)
}

function completionQualityLabel(quality: CompletionQuality): string {
  switch (quality) {
    case 'partial': return 'Parcial'
    case 'learned': return 'Aprendi'
    case 'blocked': return 'Bloqueou'
    case 'complete':
    default: return 'Concluída'
  }
}

function completionSubmitLabel(quality: CompletionQuality): string {
  switch (quality) {
    case 'partial': return 'Registrar progresso'
    case 'learned': return 'Registrar aprendizado'
    case 'blocked': return 'Registrar bloqueio'
    case 'complete':
    default: return 'Concluir e avançar'
  }
}

function completionToast(quality: CompletionQuality): string {
  switch (quality) {
    case 'partial': return 'Progresso registrado'
    case 'learned': return 'Aprendizado registrado'
    case 'blocked': return 'Bloqueio registrado'
    case 'complete':
    default: return 'Etapa avançada'
  }
}

function completionQualityColor(quality: CompletionQuality, c: ReturnType<typeof usePalette>): string {
  switch (quality) {
    case 'partial': return c.bronze
    case 'learned': return c.prussian
    case 'blocked': return c.recRed
    case 'complete':
    default: return c.moss
  }
}

function projectHealth(projects: AtlasProject[]): { active: number; blocked: number; waiting: number; withoutAction: number } {
  return {
    active: projects.filter((project) => project.status === 'active').length,
    blocked: projects.filter((project) => project.status === 'blocked').length,
    waiting: projects.filter((project) => project.status === 'waiting').length,
    withoutAction: projects.filter((project) => project.status === 'active' && !project.active_next_task_id).length,
  }
}

function projectNeedsAttention(project: AtlasProject): boolean {
  return project.execution_health?.status === 'attention'
}

function projectExecutionLearning(project: AtlasProject): ExecutionLearningSummary | null {
  const learning = asRecord(project.metadata.execution_learning)
  if (!learning) return null
  const completedActions = numberValue(learning.completed_actions_count) ?? 0
  if (completedActions <= 0) return null

  const averageEstimateRatio = numberValue(learning.average_estimate_ratio) ?? numberValue(learning.last_estimate_ratio)
  return {
    completedActions,
    averageActualMinutes: numberValue(learning.average_actual_minutes),
    averageEstimateRatio,
    lastActualMinutes: numberValue(learning.last_actual_minutes),
    bias: stringValue(learning.estimate_bias) ?? estimateBiasFromRatio(averageEstimateRatio),
  }
}

function taskEstimateCalibration(task: AtlasProject['active_next_task']): { baseMinutes: number; calibratedMinutes: number; applied: boolean } | null {
  if (!task) return null
  const calibration = asRecord(task.metadata.estimate_calibration)
  if (!calibration) return null
  const baseMinutes = numberValue(calibration.base_minutes)
  const calibratedMinutes = numberValue(calibration.calibrated_minutes)
  if (baseMinutes === null || calibratedMinutes === null) return null

  return {
    baseMinutes,
    calibratedMinutes,
    applied: Boolean(calibration.applied) && baseMinutes !== calibratedMinutes,
  }
}

function taskDeferInfo(task: AtlasProject['active_next_task']): { reasonLabel: string; actionLabel: string } | null {
  if (!task || task.planning_status !== 'deferred') return null
  const defer = asRecord(task.metadata.defer)
  if (!defer) return null

  return {
    reasonLabel: deferReasonLabel(stringValue(defer.last_reason_code) ?? 'not_now'),
    actionLabel: deferActionLabel(stringValue(defer.recommended_action) ?? 'recover', numberValue(defer.suggested_recovery_minutes)),
  }
}

function projectCompletionInfo(project: AtlasProject): ProjectCompletionInfo | null {
  const completion = asRecord(project.metadata.completion)
  if (!completion) return null
  const outcome = stringValue(completion.outcome)
  if (!outcome) return null

  return {
    outcome,
    evidence: stringValue(completion.evidence),
    force: Boolean(completion.force),
  }
}

function projectAcceptedPlanSummary(project: AtlasProject): ProjectAcceptedPlanSummary | null {
  const metadata = asRecord(project.metadata)
  if (!metadata) return null
  const proposalId = stringValue(metadata.plan_proposal_id)
  const rationale = stringValue(metadata.plan_rationale)
  const plannerVersion = stringValue(metadata.planner_version)
  const acceptedAt = stringValue(metadata.last_plan_accepted_at)

  if (!proposalId && !rationale && !plannerVersion && !acceptedAt) return null

  return {
    proposalId,
    rationale,
    plannerVersion,
    acceptedAt,
  }
}

function deferReasonLabel(reasonCode: string): string {
  switch (reasonCode) {
    case 'low_energy': return 'energia baixa'
    case 'too_big': return 'grande demais'
    case 'unclear': return 'sem clareza'
    case 'blocked': return 'bloqueio'
    case 'waiting': return 'aguardando'
    case 'calendar': return 'agenda'
    case 'avoidance': return 'resistência'
    case 'not_now':
    default: return 'não agora'
  }
}

function blockerReasonLabel(reasonCode: string): string {
  return BLOCKER_REASONS.find((reason) => reason.key === reasonCode)?.label ?? reasonCode.replace(/_/g, ' ')
}

function blockerSeverityLabel(severity: string): string {
  return BLOCKER_SEVERITIES.find((item) => item.key === severity)?.label ?? severity
}

function deferActionLabel(action: string, minutes: number | null): string {
  switch (action) {
    case 'rebuild_plan': return 'replanejar menor'
    case 'ensure_next_action': return 'definir destravamento'
    case 'postpone': return 'manter na revisão'
    case 'recover':
    default: return `retomar ${minutes ?? 10}min`
  }
}

function learningTitle(learning: ExecutionLearningSummary): string {
  switch (learning.bias) {
    case 'underestimated': return 'Atlas está aumentando estimativas'
    case 'overestimated': return 'Atlas está reduzindo estimativas'
    case 'calibrated': return 'Estimativas calibradas'
    default: return 'Aprendizado de execução'
  }
}

function learningDetail(learning: ExecutionLearningSummary): string {
  const parts = [`${learning.completedActions} ${learning.completedActions === 1 ? 'ação concluída' : 'ações concluídas'}`]
  if (learning.averageActualMinutes !== null) {
    parts.push(`média real ${Math.round(learning.averageActualMinutes)}min`)
  } else if (learning.lastActualMinutes !== null) {
    parts.push(`última ${Math.round(learning.lastActualMinutes)}min`)
  }
  if (learning.averageEstimateRatio !== null) {
    parts.push(`real ${Math.round(learning.averageEstimateRatio * 100)}% da estimativa`)
  }

  return parts.join(' · ')
}

function learningColor(bias: string | null, c: ReturnType<typeof usePalette>): string {
  switch (bias) {
    case 'underestimated': return c.bronze
    case 'overestimated': return c.prussian
    case 'calibrated': return c.moss
    default: return c.ink2
  }
}

function estimateBiasFromRatio(ratio: number | null): string | null {
  if (ratio === null) return null
  if (ratio >= 1.35) return 'underestimated'
  if (ratio <= 0.7) return 'overestimated'
  return 'calibrated'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function primaryReviewAction(item: ProjectReviewItem): Exclude<ProjectReviewAction, 'mark_reviewed'> {
  const suggestion = item.suggestion.action
  if (suggestion === 'postpone') return 'postpone'
  if (suggestion === 'recover') return 'recover'
  if (suggestion === 'rebuild_plan' || suggestion === 'review_blocker') return 'rebuild_plan'
  if (suggestion === 'reactivate') return 'reactivate'
  return 'ensure_next_action'
}

function primaryReviewLabel(action: Exclude<ProjectReviewAction, 'mark_reviewed'>): string {
  switch (action) {
    case 'postpone': return 'Adiar revisão'
    case 'recover': return 'Retomar 10min'
    case 'rebuild_plan': return 'Replanejar'
    case 'reactivate': return 'Reativar'
    case 'ensure_next_action':
    default: return 'Próxima ação'
  }
}

function reviewReasonLabel(item: ProjectReviewItem): string {
  const reasons = item.health.reasons ?? []
  if (reasons.includes('blocked')) return 'Bloqueado: precisa desbloqueio ou replanejamento.'
  if (reasons.includes('missing_next_action')) return 'Sem próxima ação executável na agenda.'
  if (reasons.includes('overdue')) return 'Prazo vencido: precisa recalibrar escopo.'
  if (reasons.includes('deferred_ready')) return item.suggestion.reason
  if (reasons.includes('review_due')) return 'Revisão vencida: confirmar se ainda importa.'
  if (reasons.includes('stale')) return 'Parado há dias: retomar com micro-ação.'
  return item.suggestion.reason
}

function executionHealthLabel(project: AtlasProject): string {
  const reasons = project.execution_health?.reasons ?? []
  if (reasons.includes('blocked')) return 'Precisa desbloqueio'
  if (reasons.includes('missing_next_action')) return 'Sem próxima ação'
  if (reasons.includes('overdue')) return 'Prazo vencido'
  if (reasons.includes('review_due')) return 'Revisão pendente'
  if (reasons.includes('stale')) return 'Parado há dias'
  return 'Precisa atenção'
}

function reviewActionToast(action: string): string {
  switch (action) {
    case 'postpone': return 'Revisão adiada'
    case 'recover': return 'Retomada criada'
    case 'ensure_next_action': return 'Próxima ação garantida'
    case 'rebuild_plan': return 'Projeto replanejado'
    case 'reactivate': return 'Projeto reativado'
    case 'mark_reviewed':
    default: return 'Projeto revisado'
  }
}

function normalizePriority(priority: string): 'low' | 'normal' | 'high' | 'urgent' {
  return priority === 'low' || priority === 'high' || priority === 'urgent' || priority === 'normal'
    ? priority
    : 'normal'
}

function priorityLabel(priority: string): string {
  switch (priority) {
    case 'urgent': return 'urgente'
    case 'high': return 'alta'
    case 'low': return 'baixa'
    case 'normal': return 'normal'
    default: return priority
  }
}

function energyLabel(energy: string): string {
  switch (energy) {
    case 'low': return 'energia baixa'
    case 'high': return 'energia alta'
    case 'medium': return 'energia média'
    default: return energy
  }
}

function executionModeLabel(mode: string): string {
  switch (mode) {
    case 'study': return 'estudo'
    case 'deep_work': return 'foco'
    case 'quick_win': return 'rápida'
    case 'admin': return 'admin'
    case 'tedious': return 'chata'
    case 'creative': return 'criação'
    case 'decision': return 'decisão'
    case 'maintenance': return 'manutenção'
    case 'recovery': return 'retomada'
    default: return mode
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'study': return 'estudo'
    case 'technical_build': return 'app/código'
    case 'business': return 'negócio'
    case 'tedious': return 'chato'
    case 'creative': return 'criativo'
    case 'writing': return 'escrita'
    case 'health': return 'saúde'
    case 'research': return 'pesquisa'
    case 'admin': return 'admin'
    case 'routine_candidate': return 'rotina'
    default: return type
  }
}

function projectStatusLabel(status: string): string {
  switch (status) {
    case 'active': return 'ativo'
    case 'paused': return 'pausado'
    case 'blocked': return 'bloqueado'
    case 'waiting': return 'aguardando'
    case 'completed': return 'concluído'
    case 'archived': return 'arquivado'
    default: return status
  }
}

function stepStatusLabel(status: string): string {
  switch (status) {
    case 'active': return 'ativa'
    case 'pending': return 'pendente'
    case 'done': return 'feita'
    case 'blocked': return 'bloqueada'
    case 'skipped': return 'pulada'
    default: return status
  }
}

function engineeringGateNeedsAttention(status: string): boolean {
  return [
    'required',
    'needs_review',
    'manual_qa_required',
    'database_review_required',
    'failed',
  ].includes(status)
}

function engineeringStatusLabel(status: string): string {
  switch (status) {
    case 'ready': return 'pronto'
    case 'resolved': return 'resolvido'
    case 'partial': return 'parcial'
    case 'unresolved': return 'pendente'
    case 'blocked': return 'bloqueado'
    case 'unsafe': return 'risco'
    case 'passed': return 'passou'
    case 'completed': return 'concluído'
    case 'skipped': return 'pulou'
    case 'warning': return 'alerta'
    case 'evidence_recorded': return 'evidência'
    case 'needs_human_review': return 'revisar'
    case 'needs_review': return 'revisar'
    case 'manual_qa_required': return 'QA'
    case 'database_review_required': return 'DB'
    case 'not_applicable': return 'n/a'
    case 'required': return 'pendente'
    case 'failed': return 'falhou'
    default: return status.replace(/_/g, ' ')
  }
}

function engineeringStatusColor(status: string, c: ReturnType<typeof usePalette>): string {
  switch (status) {
    case 'ready':
    case 'resolved':
    case 'passed':
    case 'completed':
    case 'evidence_recorded':
      return c.moss
    case 'failed':
    case 'unresolved':
    case 'unsafe':
      return c.recRed
    case 'partial':
    case 'blocked':
    case 'skipped':
    case 'warning':
    case 'needs_human_review':
    case 'needs_review':
    case 'manual_qa_required':
    case 'database_review_required':
    case 'required':
      return c.bronze
    default:
      return c.ink2
  }
}

function eventLabel(eventType: string): string {
  switch (eventType) {
    case 'created': return 'criado'
    case 'updated': return 'editado'
    case 'plan_created': return 'plano criado'
    case 'plan_rebuilt': return 'plano recalculado'
    case 'next_action_created': return 'próxima ação criada'
    case 'next_action_updated': return 'próxima ação atualizada'
    case 'step_activated': return 'etapa ativada'
    case 'step_blocked': return 'etapa bloqueada'
    case 'step_reopened': return 'etapa reaberta'
    case 'step_skipped': return 'etapa pulada'
    case 'step_completed': return 'etapa concluída'
    case 'recovery_action_created': return 'retomada criada'
    case 'execution_completed': return 'execução registrada'
    case 'execution_progress_recorded': return 'progresso registrado'
    case 'execution_blocked': return 'execução bloqueada'
    case 'execution_started': return 'execução iniciada'
    case 'blocker_opened': return 'bloqueio aberto'
    case 'blocker_updated': return 'bloqueio atualizado'
    case 'blocker_converted_to_task': return 'bloqueio virou tarefa'
    case 'blocker_resolved': return 'bloqueio resolvido'
    case 'completed': return 'projeto concluído'
    default: return eventType
  }
}

function stepActionToast(status: string): string {
  switch (status) {
    case 'active': return 'Etapa ativada'
    case 'blocked': return 'Etapa bloqueada'
    case 'pending': return 'Etapa reaberta'
    case 'skipped': return 'Etapa pulada'
    case 'done': return 'Etapa concluída'
    default: return 'Etapa atualizada'
  }
}

function statusColor(status: string, c: ReturnType<typeof usePalette>): string {
  switch (status) {
    case 'active': return c.moss
    case 'blocked': return c.recRed
    case 'paused': return c.bronze
    case 'waiting': return c.prussian
    case 'completed': return c.ink2
    default: return c.ink2
  }
}

function stepColor(status: string, c: ReturnType<typeof usePalette>): string {
  switch (status) {
    case 'active': return c.prussian
    case 'done': return c.moss
    case 'blocked': return c.recRed
    case 'skipped': return c.bronze
    default: return c.ink3
  }
}

function dateLabel(value?: string | null): string {
  if (!value) return '--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function dateAfterDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  roundAction: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  summaryGrid: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    flexDirection: 'row',
    paddingVertical: 13,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  reviewPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 13,
    gap: 10,
    marginBottom: 14,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reviewList: {
    gap: 8,
  },
  reviewItem: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    gap: 9,
  },
  reviewActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  newProjectToggle: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  createPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 11,
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 72,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 6,
  },
  projectList: {
    gap: 12,
  },
  projectCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 15,
    gap: 11,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusPill: {
    minHeight: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  cardFacts: {
    flexDirection: 'row',
    gap: 8,
  },
  fact: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  currentStepBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
    gap: 4,
  },
  learningBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 4,
  },
  attentionBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  blockerPanel: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
    gap: 8,
  },
  blockerItem: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 9,
    gap: 6,
  },
  activeTaskBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 4,
  },
  planAuditBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
    gap: 5,
  },
  detailPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallAction: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  smallActionWide: {
    alignSelf: 'flex-start',
  },
  executionPacket: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
    gap: 6,
  },
  engineeringBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
    gap: 8,
  },
  engineeringGateList: {
    gap: 5,
  },
  engineeringGateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  engineeringEvidence: {
    gap: 3,
  },
  engineeringHarnessRun: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 5,
  },
  engineeringTimeline: {
    gap: 4,
  },
  engineeringForm: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 8,
  },
  executionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  executionWhy: {
    gap: 3,
    marginTop: 2,
  },
  completionPanel: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
    gap: 9,
  },
  blockerReasonBox: {
    gap: 8,
  },
  completionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  energyRow: {
    flexDirection: 'row',
    gap: 6,
  },
  energyDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forceToggle: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  deferPanel: {
    gap: 7,
  },
  nextEditor: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 9,
  },
  stepList: {
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepRail: {
    width: 18,
    alignItems: 'center',
  },
  stepDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    marginTop: 2,
  },
  stepLine: {
    width: 1,
    flex: 1,
    marginTop: 4,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 3,
  },
  stepActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
  },
  emptySteps: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  eventsBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 4,
  },
})
