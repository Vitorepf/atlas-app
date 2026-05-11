import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import type { InboxItem } from '../components/InboxCard'
import { atlasStorage } from './storage'
import {
  acceptProjectPlanProposal,
  proposeCaptureProjectPlan,
  regenerateProjectPlanProposal,
  type AtlasProjectPlanProposal,
  type CaptureTriageInput,
} from './api/client'
import {
  ARCHIVE_HINT_STORAGE_KEY,
} from './inboxConstants'
import {
  daysFromNowIso,
  defaultProjectPlanDraft,
  draftFromProposal,
  minutesFromDraft,
  quickActionMessage,
  taskPriorityLabel,
  triageInputFor,
} from './inboxActionModels'
import {
  compactTitle,
  isOpenInboxItem,
} from './inboxCaptureModels'
import type { BulkAction, ProjectPlanDraft, QuickAction, TaskPriority } from './inboxTypes'

interface UseInboxCaptureActionsParams {
  items: InboxItem[]
  openItems: InboxItem[]
  openDetail: (item: InboxItem) => void
  showToast: (message: string) => void
  sync: () => Promise<void>
  triageCapture: (
    id: string,
    input: CaptureTriageInput,
  ) => Promise<unknown>
}

export function useInboxCaptureActions({
  items,
  openItems,
  openDetail,
  showToast,
  sync,
  triageCapture,
}: UseInboxCaptureActionsParams) {
  const router = useRouter()
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [busyCaptureId, setBusyCaptureId] = useState<string | null>(null)
  const [taskPriorityItem, setTaskPriorityItem] = useState<InboxItem | null>(null)
  const [snoozeTarget, setSnoozeTarget] = useState<InboxItem | 'bulk' | null>(null)
  const [projectPlanItem, setProjectPlanItem] = useState<InboxItem | null>(null)
  const [projectProposal, setProjectProposal] = useState<AtlasProjectPlanProposal | null>(null)
  const [projectPlanDraft, setProjectPlanDraft] = useState<ProjectPlanDraft>(() => defaultProjectPlanDraft())
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  useEffect(() => {
    const openIds = new Set(openItems.map((item) => item.id))
    setSelectedIds((current) => {
      const next = current.filter((id) => openIds.has(id))
      return next.length === current.length ? current : next
    })
  }, [openItems])

  const resetTransientState = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds([])
    setTaskPriorityItem(null)
    setSnoozeTarget(null)
  }, [])

  const toggleSelected = useCallback((item: InboxItem) => {
    if (!isOpenInboxItem(item)) return

    setSelectedIds((current) => current.includes(item.id) ? current.filter((x) => x !== item.id) : [...current, item.id])
  }, [])

  const runQuickAction = useCallback(async (
    item: InboxItem,
    action: QuickAction,
    overrides: Partial<CaptureTriageInput> = {},
  ) => {
    if (item.isLocal || busyCaptureId) return

    setBusyCaptureId(item.id)
    try {
      const result = await triageCapture(item.id, triageInputFor(item, action, overrides))
      if (result && action === 'archive') {
        const seen = await atlasStorage.getItem(ARCHIVE_HINT_STORAGE_KEY)
        if (!seen) {
          showToast('arquivado · vira filtro "arquivadas". nada se perde.')
          await atlasStorage.setItem(ARCHIVE_HINT_STORAGE_KEY, '1')
        } else {
          showToast(quickActionMessage(action))
        }
      } else {
        showToast(result ? quickActionMessage(action) : 'falha ao aplicar ação')
      }
    } finally {
      setBusyCaptureId(null)
    }
  }, [busyCaptureId, showToast, triageCapture])

  const askTaskPriority = useCallback((item: InboxItem) => {
    if (item.isLocal || busyCaptureId) return
    setTaskPriorityItem(item)
  }, [busyCaptureId])

  const askSnooze = useCallback((item: InboxItem) => {
    if (item.isLocal || busyCaptureId) return
    setSnoozeTarget(item)
  }, [busyCaptureId])

  const askProjectPlan = useCallback(async (item: InboxItem) => {
    if (item.isLocal || busyCaptureId) return

    setBusyCaptureId(item.id)
    try {
      const proposal = await proposeCaptureProjectPlan(item.id, {
        title: compactTitle(item),
        metadata: { entrypoint: 'inbox_project_button' },
      })
      setProjectPlanItem(item)
      setProjectProposal(proposal)
      setProjectPlanDraft(draftFromProposal(proposal))
      showToast('proposta de projeto criada')
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'falha ao criar proposta')
    } finally {
      setBusyCaptureId(null)
    }
  }, [busyCaptureId, showToast])

  const confirmProjectPlan = useCallback(async () => {
    if (!projectProposal || busyCaptureId) return

    setBusyCaptureId(projectPlanItem?.id ?? projectProposal.id)
    try {
      await acceptProjectPlanProposal(projectProposal.id, {
        title: projectPlanDraft.title.trim() || projectProposal.proposed_title,
        next_action: projectPlanDraft.nextAction.trim() || projectProposal.first_next_action,
        priority: projectPlanDraft.priority,
        estimated_minutes: minutesFromDraft(projectPlanDraft.estimatedMinutes, projectProposal.estimated_duration_minutes),
      })
      setProjectPlanItem(null)
      setProjectProposal(null)
      setProjectPlanDraft(defaultProjectPlanDraft())
      await sync()
      showToast('projeto criado com próxima ação')
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'falha ao confirmar projeto')
    } finally {
      setBusyCaptureId(null)
    }
  }, [busyCaptureId, projectPlanDraft, projectPlanItem?.id, projectProposal, showToast, sync])

  const regenerateProjectPlan = useCallback(async () => {
    if (!projectProposal || busyCaptureId) return

    setBusyCaptureId(projectPlanItem?.id ?? projectProposal.id)
    try {
      const proposal = await regenerateProjectPlanProposal(projectProposal.id, {
        title: projectPlanDraft.title.trim() || projectProposal.proposed_title,
        next_action: projectPlanDraft.nextAction.trim() || projectProposal.first_next_action,
        priority: projectPlanDraft.priority,
        estimated_minutes: minutesFromDraft(projectPlanDraft.estimatedMinutes, projectProposal.estimated_duration_minutes),
        instruction: 'Gerar uma versão mais clara, menor e mais executável para TDAH.',
        metadata: { entrypoint: 'inbox_project_regenerate' },
      })
      setProjectProposal(proposal)
      setProjectPlanDraft(draftFromProposal(proposal))
      showToast('proposta recalculada')
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'falha ao regenerar proposta')
    } finally {
      setBusyCaptureId(null)
    }
  }, [busyCaptureId, projectPlanDraft, projectPlanItem?.id, projectProposal, showToast])

  const cancelProjectPlan = useCallback(() => {
    setProjectPlanItem(null)
    setProjectProposal(null)
    setProjectPlanDraft(defaultProjectPlanDraft())
  }, [])

  const openDestination = useCallback((item: InboxItem) => {
    if ((item.targetType === 'project' || item.triageDestination === 'project') && item.targetId) {
      router.push({ pathname: '/projects', params: { projectId: item.targetId } })
      return
    }

    if ((item.targetType === 'task' || item.triageDestination === 'task') && item.targetId) {
      router.push('/')
      return
    }

    openDetail(item)
  }, [openDetail, router])

  const runTaskWithPriority = useCallback(async (priority: TaskPriority) => {
    const item = taskPriorityItem
    if (!item || busyCaptureId) return

    setTaskPriorityItem(null)
    await runQuickAction(item, 'create_task', {
      priority,
      reason: `Tarefa criada pelo Inbox com prioridade ${taskPriorityLabel(priority)}.`,
    })
  }, [busyCaptureId, runQuickAction, taskPriorityItem])

  const runBulkAction = useCallback(async (
    action: BulkAction,
    overrides: Partial<CaptureTriageInput> = {},
  ) => {
    if (selectedIds.length === 0 || busyCaptureId) return

    setBusyCaptureId('bulk')
    let ok = 0
    try {
      for (const id of selectedIds) {
        const item = itemById.get(id)
        if (!item) continue
        const result = await triageCapture(id, triageInputFor(item, action, overrides))
        if (result) ok++
      }
      showToast(`${ok} ${ok === 1 ? 'captura atualizada' : 'capturas atualizadas'}`)
      setSelectedIds([])
      setSelectionMode(false)
    } finally {
      setBusyCaptureId(null)
    }
  }, [busyCaptureId, itemById, selectedIds, showToast, triageCapture])

  const runSnoozeChoice = useCallback(async (days: number, reason: string) => {
    const target = snoozeTarget
    if (!target || busyCaptureId) return

    setSnoozeTarget(null)
    const snoozed_until = daysFromNowIso(days)
    if (target === 'bulk') {
      await runBulkAction('snooze', { snoozed_until, reason })
      return
    }

    await runQuickAction(target, 'snooze', { snoozed_until, reason })
  }, [busyCaptureId, runBulkAction, runQuickAction, snoozeTarget])

  return {
    askProjectPlan,
    askSnooze,
    askTaskPriority,
    busyCaptureId,
    cancelProjectPlan,
    confirmProjectPlan,
    openDestination,
    projectPlanDraft,
    projectPlanItem,
    projectProposal,
    regenerateProjectPlan,
    resetTransientState,
    runBulkAction,
    runQuickAction,
    runSnoozeChoice,
    runTaskWithPriority,
    selectedIds,
    selectionMode,
    setProjectPlanDraft,
    setSelectedIds,
    setSelectionMode,
    setSnoozeTarget,
    setTaskPriorityItem,
    snoozeTarget,
    taskPriorityItem,
    toggleSelected,
  }
}
