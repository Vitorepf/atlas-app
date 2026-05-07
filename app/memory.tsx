import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { CodexReveal } from '../components/CodexReveal'
import { SectionHeader } from '../components/SectionHeader'
import { PrimaryButton } from '../components/PrimaryButton'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { fonts } from '../design/tokens'
import {
  buildProviderReviewDiff,
  detectProviderSafetyIssues,
  type ProviderReviewDiff,
  type ProviderSafetyIssue,
} from '../lib/memoryReviewSafety'
import {
  PROVIDER_PROJECTION_AUDIT_INITIATOR_OPTIONS,
  PROVIDER_PROJECTION_AUDIT_RESULT_OPTIONS,
  PROVIDER_PROJECTION_TARGET_OPTIONS,
  providerProjectionAuditFilterLine,
  providerProjectionAuditItems,
  providerProjectionAuditMetaLine,
  providerProjectionAuditOverviewLine,
  providerProjectionAuditOverviewPeriodLine,
  providerProjectionAuditPurgeCanApply,
  providerProjectionAuditPurgeFromError,
  providerProjectionAuditPurgeInput,
  providerProjectionAuditPurgeLine,
  providerProjectionAuditPurgePermissionLine,
  providerProjectionAuditPurgePolicyLine,
  providerProjectionAuditQuery,
  providerProjectionAuditSummaryQuery,
  providerProjectionAuditStatusLabel,
  providerProjectionAuditSummaryLine,
  providerProjectionCanApply,
  providerProjectionDiffKey,
  providerProjectionDiffLineKind,
  providerProjectionDiffReview,
  providerProjectionDiffToggleLabel,
  providerProjectionFileLine,
  providerProjectionItems,
  providerProjectionManualDriftCount,
  providerProjectionSummaryLine,
  type ProviderProjectionAuditInitiatorFilter,
  type ProviderProjectionAuditResultFilter,
} from '../lib/memoryProviderProjection'
import {
  buildMemoryReviewBatchPlan,
  selectableReviewItemIds,
  type MemoryReviewBatchAction,
} from '../lib/memoryReviewBatch'
import {
  memoryReviewShortcutActionFromKey,
  nextMemoryReviewItemId,
} from '../lib/memoryReviewShortcuts'
import {
  DEFAULT_REVIEW_FILTERS,
  REVIEW_AREA_OPTIONS,
  REVIEW_PRIVACY_OPTIONS,
  REVIEW_SEVERITY_OPTIONS,
  clearSavedMemoryReviewFilters,
  hasActiveReviewFilters,
  loadSavedMemoryReviewFilters,
  memoryReviewFiltersFromParams,
  memoryReviewFiltersToParams,
  normalizeReviewFilters,
  sameReviewFilters,
  saveMemoryReviewFilters,
  type ReviewAreaFilter,
  type ReviewFilters,
  type ReviewPrivacyFilter,
  type ReviewSeverityFilter,
} from '../lib/memoryReviewFilters'
import {
  acceptSemanticCurationProposal,
  applyAtlasMemoryProviderProjection,
  createSemanticActivations,
  dismissSemanticActivation,
  dismissSemanticCurationProposal,
  feedbackSemanticActivation,
  getAtlasMemoryProviderProjectionStatus,
  getAtlasMemoryEntry,
  getAtlasVerbatimMemory,
  getTodayCognitiveGame,
  getVaultHealth,
  listAtlasMemoryProviderProjectionAudits,
  listAtlasMemoryReviewQueue,
  purgeAtlasMemoryProviderProjectionAudits,
  listSemanticActivations,
  listSemanticCurationProposals,
  listSemanticNotes,
  listSuggestionAudit,
  markSemanticActivationShown,
  reindexSemanticVault,
  reviewAtlasMemoryPrivacy,
  reviewAtlasMemoryProviderProjection,
  reviewAtlasMemoryRelation,
  reviewAtlasVerbatimMemory,
  searchSemanticNotes,
  startCognitiveGame,
  summarizeAtlasMemoryProviderProjectionAudits,
  type AtlasAuditItem,
  type AtlasCognitiveReturn,
  type AtlasCognitiveGameRun,
  type AtlasMemoryProviderProjection,
  type AtlasMemoryProviderProjectionAudit,
  type AtlasMemoryProviderProjectionAuditPurge,
  type AtlasMemoryProviderProjectionAuditSummary,
  type AtlasMemoryProviderProjectionItem,
  type AtlasMemoryProviderProjectionTarget,
  type AtlasMemoryRegistryEntry,
  type AtlasMemoryReviewQueue,
  type AtlasMemoryReviewQueueItem,
  type AtlasSemanticActivation,
  type AtlasSemanticCurationProposal,
  type AtlasSemanticNote,
  type AtlasVaultHealthSnapshot,
  type AtlasVerbatimMemoryEntry,
} from '../lib/api/client'

type ReviewQueueParams = NonNullable<Parameters<typeof listAtlasMemoryReviewQueue>[0]>

type ReviewDraft = {
  reviewNote: string
  redactedTitle: string
  redactedBody: string
  safeSummary: string
  redactedText: string
}

type ReviewDetailState = {
  loading: boolean
  error: string | null
  memory?: AtlasMemoryRegistryEntry
  verbatim?: AtlasVerbatimMemoryEntry
}

const EMPTY_REVIEW_DRAFT: ReviewDraft = {
  reviewNote: '',
  redactedTitle: '',
  redactedBody: '',
  safeSummary: '',
  redactedText: '',
}

export default function MemoryScreen() {
  const c = usePalette()
  const router = useRouter()
  const routeParams = useLocalSearchParams<Record<string, string | string[]>>()
  const initialReviewFilters = useMemo(() => initialFiltersFromParamsOrStorage(routeParams), [])
  const routeFilterKey = useMemo(() => JSON.stringify(memoryReviewFiltersToParams(memoryReviewFiltersFromParams(routeParams))), [routeParams])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [health, setHealth] = useState<AtlasVaultHealthSnapshot | null>(null)
  const [activations, setActivations] = useState<AtlasSemanticActivation[]>([])
  const [proposals, setProposals] = useState<AtlasSemanticCurationProposal[]>([])
  const [notes, setNotes] = useState<AtlasSemanticNote[]>([])
  const [auditItems, setAuditItems] = useState<AtlasAuditItem[]>([])
  const [reviewQueue, setReviewQueue] = useState<AtlasMemoryReviewQueue | null>(null)
  const [providerProjection, setProviderProjection] = useState<AtlasMemoryProviderProjection | null>(null)
  const [providerProjectionReview, setProviderProjectionReview] = useState<AtlasMemoryProviderProjection | null>(null)
  const [providerProjectionAudits, setProviderProjectionAudits] = useState<AtlasMemoryProviderProjectionAudit[]>([])
  const [providerProjectionAuditSummary, setProviderProjectionAuditSummary] = useState<AtlasMemoryProviderProjectionAuditSummary | null>(null)
  const [providerProjectionAuditPurge, setProviderProjectionAuditPurge] = useState<AtlasMemoryProviderProjectionAuditPurge | null>(null)
  const [providerProjectionTarget, setProviderProjectionTarget] = useState<AtlasMemoryProviderProjectionTarget>('all')
  const [providerProjectionAuditResult, setProviderProjectionAuditResult] = useState<ProviderProjectionAuditResultFilter>('all')
  const [providerProjectionAuditInitiator, setProviderProjectionAuditInitiator] = useState<ProviderProjectionAuditInitiatorFilter>('all')
  const [providerProjectionAuditPurgeConfirmArmed, setProviderProjectionAuditPurgeConfirmArmed] = useState(false)
  const [providerProjectionConfirmArmed, setProviderProjectionConfirmArmed] = useState(false)
  const [reviewFilters, setReviewFilters] = useState<ReviewFilters>(initialReviewFilters)
  const [reviewFilterDraft, setReviewFilterDraft] = useState<ReviewFilters>(initialReviewFilters)
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({})
  const [reviewDetails, setReviewDetails] = useState<Record<string, ReviewDetailState>>({})
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([])
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null)
  const [game, setGame] = useState<AtlasCognitiveGameRun | null>(null)
  const [partialFailure, setPartialFailure] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)

    // allSettled: uma falha (ex: jogo cognitivo offline) não descarta os
    // outros datasets que vieram OK. Cada seção atualiza ou mantém estado
    // anterior. Falha global só se TUDO falhar; falha parcial mostra banner
    // discreto pra usuário saber que algo não atualizou.
    const results = await Promise.allSettled([
      getVaultHealth(),
      listSemanticActivations({ limit: 8 }),
      listSemanticCurationProposals({ limit: 8 }),
      listSemanticNotes({ limit: 20 }),
      listSuggestionAudit({ limit: 8 }),
      listAtlasMemoryReviewQueue(reviewQueueParamsFromFilters(reviewFilters)),
      getAtlasMemoryProviderProjectionStatus({ target: providerProjectionTarget }),
      listAtlasMemoryProviderProjectionAudits(providerProjectionAuditQuery(
        providerProjectionTarget,
        providerProjectionAuditResult,
        providerProjectionAuditInitiator,
        5,
      )),
      summarizeAtlasMemoryProviderProjectionAudits(providerProjectionAuditSummaryQuery(
        providerProjectionTarget,
        providerProjectionAuditResult,
        providerProjectionAuditInitiator,
      )),
      getTodayCognitiveGame(),
    ])

    if (results[0].status === 'fulfilled') setHealth(results[0].value)
    if (results[1].status === 'fulfilled') setActivations(results[1].value.activations)
    if (results[2].status === 'fulfilled') setProposals(results[2].value.proposals)
    if (results[3].status === 'fulfilled') setNotes(results[3].value.notes)
    if (results[4].status === 'fulfilled') setAuditItems(results[4].value.items)
    if (results[5].status === 'fulfilled') setReviewQueue(results[5].value.review_queue)
    if (results[6].status === 'fulfilled') {
      setProviderProjection(results[6].value.provider_projection)
      setProviderProjectionReview(null)
      setProviderProjectionConfirmArmed(false)
    }
    if (results[7].status === 'fulfilled') setProviderProjectionAudits(results[7].value.provider_projection_audits)
    if (results[8].status === 'fulfilled') setProviderProjectionAuditSummary(results[8].value.provider_projection_audit_summary)
    if (results[9].status === 'fulfilled') setGame(results[9].value.game)

    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length === results.length) {
      const reason = (failures[0] as PromiseRejectedResult).reason
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar memória semântica.')
      setPartialFailure(false)
    } else {
      setPartialFailure(failures.length > 0)
    }

    setLoading(false)
  }, [providerProjectionAuditInitiator, providerProjectionAuditResult, providerProjectionTarget, reviewFilters])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const routeFilters = memoryReviewFiltersFromParams(routeParams)
    if (!hasActiveReviewFilters(routeFilters)) return

    setReviewFilters(routeFilters)
    setReviewFilterDraft(routeFilters)
    setSelectedReviewIds([])
    setExpandedReviewId(null)
  }, [routeFilterKey])

  useEffect(() => {
    if (activations.length === 0) return
    activations
      .filter((activation) => !activation.shown_at)
      .slice(0, 3)
      .forEach((activation) => {
        markSemanticActivationShown(activation.id).catch(() => {})
      })
  }, [activations])

  const recommendations = useMemo(
    () => (health?.recommendations ?? []).map((item) => String(item)).slice(0, 3),
    [health],
  )
  const cognitiveReturn = useMemo(() => cognitiveReturnFromHealth(health), [health])
  const reviewItems = useMemo(
    () => filterReviewQueueItems(reviewQueue?.items ?? [], reviewFilters),
    [reviewFilters, reviewQueue],
  )
  const reviewBatchPlan = useMemo(
    () => buildMemoryReviewBatchPlan(reviewItems, selectedReviewIds),
    [reviewItems, selectedReviewIds],
  )
  const reviewItemIds = useMemo(() => reviewItems.map((item) => item.id), [reviewItems])
  const activeReviewItemId = expandedReviewId ?? reviewItemIds[0] ?? null
  const activeReviewItem = useMemo(
    () => reviewItems.find((item) => item.id === activeReviewItemId) ?? null,
    [activeReviewItemId, reviewItems],
  )
  const activeReviewIndex = activeReviewItemId ? reviewItemIds.indexOf(activeReviewItemId) : -1

  async function runAction<T>(key: string, action: () => Promise<T>, reload = true): Promise<T | null> {
    setBusy(key)
    setError(null)
    try {
      const result = await action()
      if (reload) await load()
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operação falhou.')
      return null
    } finally {
      setBusy(null)
    }
  }

  async function search(): Promise<void> {
    await runAction('search', async () => {
      const result = await searchSemanticNotes({ query, limit: 20 })
      setNotes(result.notes)
      return result
    }, false)
  }

  async function reviewProviderProjection(): Promise<void> {
    const result = await runAction('provider-projection-review', () => (
      reviewAtlasMemoryProviderProjection({ target: providerProjectionTarget })
    ), false)

    if (result) {
      setProviderProjection(result.provider_projection)
      setProviderProjectionReview(result.provider_projection)
      setProviderProjectionConfirmArmed(false)
    }
  }

  async function applyProviderProjection(): Promise<void> {
    if (!providerProjectionConfirmArmed) {
      setProviderProjectionConfirmArmed(true)
      return
    }

    const result = await runAction('provider-projection-apply', () => (
      applyAtlasMemoryProviderProjection({ target: providerProjectionTarget, confirm: true })
    ), false)

    if (result) {
      setProviderProjection(result.provider_projection)
      setProviderProjectionReview(null)
      setProviderProjectionConfirmArmed(false)
      await load()
      return
    }

    setProviderProjectionConfirmArmed(false)
  }

  function changeProviderProjectionTarget(target: AtlasMemoryProviderProjectionTarget): void {
    setProviderProjectionTarget(target)
    setProviderProjectionReview(null)
    setProviderProjectionAudits([])
    setProviderProjectionAuditSummary(null)
    setProviderProjectionAuditPurge(null)
    setProviderProjectionAuditPurgeConfirmArmed(false)
    setProviderProjectionConfirmArmed(false)
  }

  function changeProviderProjectionAuditResult(result: ProviderProjectionAuditResultFilter): void {
    setProviderProjectionAuditResult(result)
    setProviderProjectionAudits([])
    setProviderProjectionAuditSummary(null)
    setProviderProjectionAuditPurge(null)
    setProviderProjectionAuditPurgeConfirmArmed(false)
  }

  function changeProviderProjectionAuditInitiator(initiator: ProviderProjectionAuditInitiatorFilter): void {
    setProviderProjectionAuditInitiator(initiator)
    setProviderProjectionAudits([])
    setProviderProjectionAuditSummary(null)
    setProviderProjectionAuditPurge(null)
    setProviderProjectionAuditPurgeConfirmArmed(false)
  }

  async function simulateProviderProjectionAuditPurge(): Promise<void> {
    const result = await runAction('provider-projection-audit-purge-dry-run', () => (
      purgeAtlasMemoryProviderProjectionAudits(providerProjectionAuditPurgeInput(
        providerProjectionTarget,
        providerProjectionAuditResult,
        providerProjectionAuditInitiator,
        true,
        false,
      ))
    ), false)

    if (result) {
      setProviderProjectionAuditPurge(result.provider_projection_audit_purge)
      setProviderProjectionAuditPurgeConfirmArmed(false)
    }
  }

  async function applyProviderProjectionAuditPurge(): Promise<void> {
    const canApply = providerProjectionAuditPurgeCanApply(
      providerProjectionAuditPurge,
      providerProjectionTarget,
      providerProjectionAuditResult,
      providerProjectionAuditInitiator,
    )
    if (!canApply) {
      setProviderProjectionAuditPurgeConfirmArmed(false)
      setError(providerProjectionAuditPurgePolicyLine(
        providerProjectionAuditPurge,
        providerProjectionTarget,
        providerProjectionAuditResult,
        providerProjectionAuditInitiator,
      ))
      return
    }

    if (!providerProjectionAuditPurgeConfirmArmed) {
      setProviderProjectionAuditPurgeConfirmArmed(true)
      return
    }

    setBusy('provider-projection-audit-purge-apply')
    setError(null)
    try {
      const result = await purgeAtlasMemoryProviderProjectionAudits(providerProjectionAuditPurgeInput(
        providerProjectionTarget,
        providerProjectionAuditResult,
        providerProjectionAuditInitiator,
        false,
        true,
        undefined,
        providerProjectionAuditPurge?.confirmation_fingerprint,
      ))
      setProviderProjectionAuditPurge(result.provider_projection_audit_purge)
      setProviderProjectionAuditPurgeConfirmArmed(false)
      await load()
      return
    } catch (err) {
      const purge = providerProjectionAuditPurgeFromError(err)
      if (purge) {
        setProviderProjectionAuditPurge(purge)
        setError(providerProjectionAuditPurgePolicyLine(
          purge,
          providerProjectionTarget,
          providerProjectionAuditResult,
          providerProjectionAuditInitiator,
        ))
      } else {
        setError(err instanceof Error ? err.message : 'Operação falhou.')
      }
    } finally {
      setBusy(null)
    }

    setProviderProjectionAuditPurgeConfirmArmed(false)
  }

  async function reviewQueueAction(item: AtlasMemoryReviewQueueItem, action: 'release' | 'block' | 'resolve' | 'dismiss') {
    const draft = reviewDrafts[item.id] ?? EMPTY_REVIEW_DRAFT
    if (action === 'release' && item.kind !== 'relation') {
      const detail = reviewDetails[item.id]
      const preview = reviewProviderPreview(item, draft, detail)
      const issues = reviewProviderSafetyIssues(preview)
      if (!draftAllowsProviderRelease(item, draft, detail) || hasBlockingProviderSafetyIssue(issues)) {
        setError('Revise o preview provider-safe antes de liberar esta memória.')
        return
      }
    }

    const reviewNote = cleanText(draft.reviewNote) ?? reviewDefaultNote(item, action)
    const redactedTitle = cleanText(draft.redactedTitle)
    const redactedBody = cleanText(draft.redactedBody)
    const safeSummary = cleanText(draft.safeSummary)
    const redactedText = cleanText(draft.redactedText)
    const result = await runAction(`review-${action}-${item.id}`, async () => {
      if (item.kind === 'memory_privacy' && item.memory_entry_id) {
        return reviewAtlasMemoryPrivacy(item.memory_entry_id, {
          privacy_class: action === 'release' ? 'normal' : item.privacy_class ?? undefined,
          external_ai_allowed: action === 'release',
          redacted_title: redactedTitle,
          redacted_body: redactedBody,
          redacted_summary: safeSummary,
          reviewed_by: 'atlas-app',
          review_note: reviewNote,
          metadata: reviewMetadata(reviewFilters),
        })
      }

      if (item.kind === 'verbatim_privacy' && item.verbatim_memory_id) {
        return reviewAtlasVerbatimMemory(item.verbatim_memory_id, {
          privacy_class: action === 'release' ? 'normal' : item.privacy_class ?? undefined,
          external_ai_allowed: action === 'release',
          redacted_text: redactedText,
          summary: safeSummary,
          re_redact: !redactedText,
          status: 'active',
          reviewed_by: 'atlas-app',
          review_action: `app_${action}`,
          review_note: reviewNote,
          metadata: reviewMetadata(reviewFilters),
        })
      }

      if (item.kind === 'relation' && item.relation_id) {
        return reviewAtlasMemoryRelation(item.relation_id, {
          status: action === 'dismiss' ? 'dismissed' : 'resolved',
          resolution_action: action === 'dismiss' ? 'app_dismissed' : 'app_resolved',
          reviewed_by: 'atlas-app',
          review_note: reviewNote,
          metadata: reviewMetadata(reviewFilters),
        })
      }

      throw new Error('Item de revisão não possui alvo válido.')
    })

    if (result) {
      setReviewDrafts((current) => {
        const { [item.id]: _removed, ...next } = current
        return next
      })
      setSelectedReviewIds((current) => current.filter((id) => id !== item.id))
      setExpandedReviewId((current) => (current === item.id ? null : current))
    }
  }

  async function reviewQueueBatchAction(action: MemoryReviewBatchAction): Promise<void> {
    const items = action === 'block_privacy'
      ? reviewBatchPlan.privacy_items
      : reviewBatchPlan.relation_items
    if (items.length === 0) return

    const result = await runAction(`review-batch-${action}`, async () => {
      for (const item of items) {
        if (action === 'block_privacy' && item.kind === 'memory_privacy' && item.memory_entry_id) {
          await reviewAtlasMemoryPrivacy(item.memory_entry_id, {
            privacy_class: item.privacy_class ?? undefined,
            external_ai_allowed: false,
            reviewed_by: 'atlas-app',
            review_note: 'Bloqueado em lote pela fila visual do Atlas app.',
            metadata: reviewBatchMetadata(reviewFilters, action),
          })
        }

        if (action === 'block_privacy' && item.kind === 'verbatim_privacy' && item.verbatim_memory_id) {
          await reviewAtlasVerbatimMemory(item.verbatim_memory_id, {
            privacy_class: item.privacy_class ?? undefined,
            external_ai_allowed: false,
            status: 'active',
            reviewed_by: 'atlas-app',
            review_action: 'app_batch_block',
            review_note: 'Bloqueado em lote pela fila visual do Atlas app.',
            metadata: reviewBatchMetadata(reviewFilters, action),
          })
        }

        if (action === 'dismiss_relations' && item.kind === 'relation' && item.relation_id) {
          await reviewAtlasMemoryRelation(item.relation_id, {
            status: 'dismissed',
            resolution_action: 'app_batch_dismissed',
            reviewed_by: 'atlas-app',
            review_note: 'Relacao dispensada em lote pela fila visual do Atlas app.',
            metadata: reviewBatchMetadata(reviewFilters, action),
          })
        }
      }

      return { reviewed: items.length }
    })

    if (result) {
      const reviewedIds = new Set(items.map((item) => item.id))
      setSelectedReviewIds((current) => current.filter((id) => !reviewedIds.has(id)))
    }
  }

  async function toggleReviewEditor(item: AtlasMemoryReviewQueueItem): Promise<void> {
    if (expandedReviewId === item.id) {
      setExpandedReviewId(null)
      return
    }

    setExpandedReviewId(item.id)
    if ((item.kind === 'memory_privacy' || item.kind === 'verbatim_privacy') && !reviewDetails[item.id]) {
      await loadReviewDetail(item)
    }
  }

  async function loadReviewDetail(item: AtlasMemoryReviewQueueItem): Promise<void> {
    setReviewDetails((current) => ({
      ...current,
      [item.id]: { loading: true, error: null },
    }))

    try {
      if (item.kind === 'memory_privacy' && item.memory_entry_id) {
        const { memory } = await getAtlasMemoryEntry(item.memory_entry_id)
        setReviewDetails((current) => ({
          ...current,
          [item.id]: { loading: false, error: null, memory },
        }))
        seedReviewDraft(item.id, draftFromMemoryDetail(memory, item))
        return
      }

      if (item.kind === 'verbatim_privacy' && item.verbatim_memory_id) {
        const { verbatim_memory: verbatim } = await getAtlasVerbatimMemory(item.verbatim_memory_id)
        setReviewDetails((current) => ({
          ...current,
          [item.id]: { loading: false, error: null, verbatim },
        }))
        seedReviewDraft(item.id, draftFromVerbatimDetail(verbatim, item))
        return
      }

      setReviewDetails((current) => ({
        ...current,
        [item.id]: { loading: false, error: null },
      }))
    } catch (err) {
      setReviewDetails((current) => ({
        ...current,
        [item.id]: {
          loading: false,
          error: err instanceof Error ? err.message : 'Falha ao carregar detalhe da memória.',
        },
      }))
    }
  }

  function seedReviewDraft(id: string, draft: Partial<ReviewDraft>): void {
    setReviewDrafts((current) => {
      const existing = current[id]
      if (existing && Object.values(existing).some((value) => value.trim().length > 0)) {
        return current
      }

      return {
        ...current,
        [id]: {
          ...EMPTY_REVIEW_DRAFT,
          ...draft,
        },
      }
    })
  }

  function updateReviewDraft(id: string, patch: Partial<ReviewDraft>): void {
    setReviewDrafts((current) => ({
      ...current,
      [id]: {
        ...EMPTY_REVIEW_DRAFT,
        ...(current[id] ?? {}),
        ...patch,
      },
    }))
  }

  function applyReviewFilters(): void {
    const next = normalizeReviewFilters(reviewFilterDraft)
    setReviewFilters(next)
    setSelectedReviewIds([])
    void saveMemoryReviewFilters(next)
    router.replace({ pathname: '/memory', params: memoryReviewFiltersToParams(next) })
  }

  function clearReviewFilters(): void {
    setReviewFilterDraft(DEFAULT_REVIEW_FILTERS)
    setReviewFilters(DEFAULT_REVIEW_FILTERS)
    setExpandedReviewId(null)
    setSelectedReviewIds([])
    void clearSavedMemoryReviewFilters()
    router.replace('/memory')
  }

  function toggleReviewSelection(id: string): void {
    setSelectedReviewIds((current) => (
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    ))
  }

  function selectAllVisibleBatchItems(): void {
    setSelectedReviewIds(selectableReviewItemIds(reviewItems))
  }

  function openReviewQueueItem(id: string | null): void {
    if (!id) return
    const item = reviewItems.find((candidate) => candidate.id === id)
    if (item) void toggleReviewEditor(item)
  }

  function moveReviewQueueFocus(direction: 'next' | 'previous'): void {
    openReviewQueueItem(nextMemoryReviewItemId(reviewItemIds, activeReviewItemId, direction))
  }

  function closeReviewQueueFocus(): void {
    if (expandedReviewId) {
      setExpandedReviewId(null)
      return
    }

    if (selectedReviewIds.length > 0) setSelectedReviewIds([])
  }

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const action = memoryReviewShortcutActionFromKey({
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        defaultPrevented: event.defaultPrevented,
        targetTagName: target?.tagName,
        targetRole: target?.getAttribute?.('role') ?? null,
        isContentEditable: target?.isContentEditable,
      })

      if (!action || busy != null) return

      if (action === 'next_item' || action === 'previous_item') {
        event.preventDefault()
        moveReviewQueueFocus(action === 'next_item' ? 'next' : 'previous')
        return
      }

      if (action === 'toggle_editor') {
        event.preventDefault()
        if (activeReviewItem) void toggleReviewEditor(activeReviewItem)
        return
      }

      if (action === 'toggle_selection') {
        event.preventDefault()
        if (activeReviewItemId) toggleReviewSelection(activeReviewItemId)
        return
      }

      if (action === 'select_all') {
        event.preventDefault()
        selectAllVisibleBatchItems()
        return
      }

      if (action === 'clear_focus') {
        event.preventDefault()
        closeReviewQueueFocus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [activeReviewItem, activeReviewItemId, busy, expandedReviewId, reviewItemIds, reviewItems, selectedReviewIds.length])

  return (
    <Screen>
      <CodexReveal index={0}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.backButton, { backgroundColor: pressed ? c.surface : c.premium, borderColor: c.border }]}
          >
            <Sans size={26} lineHeight={28} color={c.ink}>‹</Sans>
          </Pressable>
          <Mono size={11} color={c.ink2} letterSpacing={0.44}>
            {health ? `Vault · ${health.health_state}` : 'Vault'}
          </Mono>
        </View>
      </CodexReveal>

      <CodexReveal index={1}>
        <View style={{ marginBottom: 24 }}>
          <Label>Memória semântica</Label>
          <Frau size={42} lineHeight={44} color={c.ink} style={{ marginTop: 6 }}>
            Segundo cérebro ativo
          </Frau>
          <Mono size={12} lineHeight={18} color={c.ink2} letterSpacing={0.24} style={{ marginTop: 10 }}>
            Obsidian local + PostgreSQL + ativações contextuais.
          </Mono>
        </View>
      </CodexReveal>

      {error ? (
        <CodexReveal index={2}>
          <View style={[styles.errorBox, { borderColor: c.recRed, backgroundColor: c.surface }]}>
            <Sans size={14} lineHeight={20} color={c.recRed}>
              {error}
            </Sans>
          </View>
        </CodexReveal>
      ) : partialFailure ? (
        <CodexReveal index={2}>
          <View style={[styles.errorBox, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Sans size={13} lineHeight={19} color={c.ink2}>
              Algumas seções não atualizaram desta vez. Toque em recarregar para tentar de novo.
            </Sans>
          </View>
        </CodexReveal>
      ) : null}

      <CodexReveal index={error || partialFailure ? 3 : 2}>
        <View style={styles.actionsGrid}>
          <PrimaryButton
            label={busy === 'reindex' ? 'Indexando...' : 'Indexar vault'}
            variant="secondary"
            onPress={() => {
              void runAction('reindex', () => reindexSemanticVault())
            }}
            style={styles.actionButton}
          />
          <PrimaryButton
            label={busy === 'activate' ? 'Criando...' : 'Ativar agora'}
            onPress={() => {
              void runAction('activate', () => createSemanticActivations({ context_type: 'manual_search' }))
            }}
            style={styles.actionButton}
          />
        </View>
      </CodexReveal>

      <SectionHeader label="Provider projection" />
      <View style={{ gap: 10 }}>
        <ProviderProjectionCard
          projection={providerProjectionReview ?? providerProjection}
          target={providerProjectionTarget}
          reviewMode={providerProjectionReview != null}
          loading={loading && !providerProjection}
          busy={busy}
          confirmArmed={providerProjectionConfirmArmed}
          onTargetChange={changeProviderProjectionTarget}
          onReview={() => {
            void reviewProviderProjection()
          }}
          onApply={() => {
            void applyProviderProjection()
          }}
          onCancelApply={() => setProviderProjectionConfirmArmed(false)}
        />
        <ProviderProjectionAuditHistory
          audits={providerProjectionAudits}
          summary={providerProjectionAuditSummary}
          purge={providerProjectionAuditPurge}
          target={providerProjectionTarget}
          resultFilter={providerProjectionAuditResult}
          initiatorFilter={providerProjectionAuditInitiator}
          busy={busy}
          loading={loading && providerProjectionAudits.length === 0}
          purgeConfirmArmed={providerProjectionAuditPurgeConfirmArmed}
          onResultChange={changeProviderProjectionAuditResult}
          onInitiatorChange={changeProviderProjectionAuditInitiator}
          onSimulatePurge={() => {
            void simulateProviderProjectionAuditPurge()
          }}
          onApplyPurge={() => {
            void applyProviderProjectionAuditPurge()
          }}
          onCancelPurge={() => setProviderProjectionAuditPurgeConfirmArmed(false)}
        />
      </View>

      <SectionHeader label="Fila de revisão" />
      <ReviewQueueFilters
        filters={reviewFilterDraft}
        activeFilters={reviewFilters}
        loading={loading}
        onChange={setReviewFilterDraft}
        onApply={applyReviewFilters}
        onClear={clearReviewFilters}
      />
      <View style={{ gap: 10 }}>
        {reviewQueue ? (
          <ReviewQueueSummary
            queue={reviewQueue}
            visibleCount={reviewItems.length}
            filters={reviewFilters}
          />
        ) : null}
        <ReviewQueueNavigator
          currentIndex={activeReviewIndex}
          total={reviewItems.length}
          selected={Boolean(activeReviewItemId && selectedReviewIds.includes(activeReviewItemId))}
          disabled={busy != null || reviewItems.length === 0}
          onPrevious={() => moveReviewQueueFocus('previous')}
          onNext={() => moveReviewQueueFocus('next')}
          onToggleSelected={() => {
            if (activeReviewItemId) toggleReviewSelection(activeReviewItemId)
          }}
          onClose={closeReviewQueueFocus}
        />
        <ReviewBatchToolbar
          plan={reviewBatchPlan}
          busy={busy}
          totalVisible={reviewItems.length}
          onSelectAll={selectAllVisibleBatchItems}
          onClear={() => setSelectedReviewIds([])}
          onBlockPrivacy={() => {
            void reviewQueueBatchAction('block_privacy')
          }}
          onDismissRelations={() => {
            void reviewQueueBatchAction('dismiss_relations')
          }}
        />
        {loading && !reviewQueue ? <LoadingCard /> : null}
        {!loading && reviewItems.length === 0 ? (
          <EmptyCard text="Nenhuma revisão de memória pendente." />
        ) : null}
        {reviewItems.map((item) => (
          <ReviewQueueCard
            key={item.id}
            item={item}
            busy={busy}
            draft={reviewDrafts[item.id] ?? EMPTY_REVIEW_DRAFT}
            detail={reviewDetails[item.id]}
            selected={selectedReviewIds.includes(item.id)}
            expanded={expandedReviewId === item.id}
            onToggleSelected={() => toggleReviewSelection(item.id)}
            onToggleEditor={() => {
              void toggleReviewEditor(item)
            }}
            onDraftChange={(patch) => updateReviewDraft(item.id, patch)}
            onRelease={() => reviewQueueAction(item, 'release')}
            onBlock={() => reviewQueueAction(item, 'block')}
            onResolve={() => reviewQueueAction(item, 'resolve')}
            onDismiss={() => reviewQueueAction(item, 'dismiss')}
          />
        ))}
      </View>

      <SectionHeader label="Estado do vault" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {loading && !health ? (
          <LoadingRow />
        ) : health ? (
          <>
            <MetricRow label="Notas totais" value={String(health.total_notes)} />
            <MetricRow label="Ativas" value={String(health.active_notes)} />
            <MetricRow label="Inbox" value={String(health.inbox_notes)} />
            <MetricRow label="Sem gatilho" value={String(health.notes_without_triggers)} />
            <MetricRow label="Ativações 7d" value={`${health.useful_activations_7d}/${health.activations_7d} úteis`} last />
          </>
        ) : (
          <EmptyText text="Sem snapshot de governança." />
        )}
      </View>

      <SectionHeader label="Cognitive Return on Notes" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {loading && !health ? (
          <LoadingRow />
        ) : cognitiveReturn ? (
          <>
            <MetricRow label="Score CRON" value={`${cognitiveReturn.score ?? 0}/100 · ${cognitiveReturn.label ?? 'sem rótulo'}`} />
            <MetricRow label="Taxa útil 7d" value={percent(cognitiveReturn.utility_rate_7d)} />
            <MetricRow label="Cobertura ativa 7d" value={percent(cognitiveReturn.active_note_coverage_7d)} />
            <MetricRow label="Notas por retorno útil" value={cognitiveReturn.notes_per_useful_activation_7d == null ? 'sem retorno' : String(cognitiveReturn.notes_per_useful_activation_7d)} last />
            {cognitiveReturn.interpretation ? (
              <Sans size={13} lineHeight={19} color={c.ink2} style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                {cognitiveReturn.interpretation}
              </Sans>
            ) : null}
          </>
        ) : (
          <EmptyText text="Sem métrica CRON ainda. Recalcule o vault para gerar retorno cognitivo." />
        )}
      </View>

      {recommendations.length > 0 ? (
        <View style={[styles.recommendations, { borderColor: c.border }]}>
          {recommendations.map((item, index) => (
            <Sans key={`${item}-${index}`} size={13} lineHeight={19} color={c.ink2}>
              {item}
            </Sans>
          ))}
        </View>
      ) : null}

      <SectionHeader label="Ativações" />
      <View style={{ gap: 10 }}>
        {loading && activations.length === 0 ? <LoadingCard /> : null}
        {!loading && activations.length === 0 ? (
          <EmptyCard text="Nenhuma memória foi ativada ainda. Indexe o vault e crie ativações quando houver notas ativas." />
        ) : null}
        {activations.map((activation) => (
          <ActivationCard
            key={activation.id}
            activation={activation}
            onUseful={() => runAction(`useful-${activation.id}`, () => feedbackSemanticActivation(activation.id, 5, 'useful'))}
            onUseless={() => runAction(`useless-${activation.id}`, () => feedbackSemanticActivation(activation.id, 1, 'not_useful'))}
            onTooEarly={() => runAction(`early-${activation.id}`, () => feedbackSemanticActivation(activation.id, 2, 'too_early'))}
            onTooLate={() => runAction(`late-${activation.id}`, () => feedbackSemanticActivation(activation.id, 3, 'too_late'))}
            onDismiss={() => runAction(`dismiss-${activation.id}`, () => dismissSemanticActivation(activation.id))}
            busy={busy}
          />
        ))}
      </View>

      <SectionHeader label="Curadoria" />
      <View style={{ gap: 10 }}>
        {!loading && proposals.length === 0 ? (
          <EmptyCard text="Nenhuma proposta pendente. Capturas densas viram propostas depois da análise do servidor." />
        ) : null}
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            onAccept={() => runAction(`accept-${proposal.id}`, () => acceptSemanticCurationProposal(proposal.id))}
            onDismiss={() => runAction(`proposal-dismiss-${proposal.id}`, () => dismissSemanticCurationProposal(proposal.id))}
            busy={busy}
          />
        ))}
      </View>

      <SectionHeader label="Auditoria IA" />
      <View style={{ gap: 10 }}>
        {!loading && auditItems.length === 0 ? (
          <EmptyCard text="Sem logs de auditoria. Propostas, ativações e jobs de IA aparecerão aqui com a explicação da decisão." />
        ) : null}
        {auditItems.map((item) => (
          <AuditCard key={item.id} item={item} />
        ))}
      </View>

      <SectionHeader label="Busca" />
      <View style={[styles.searchBox, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="conceito, tese, gatilho..."
          placeholderTextColor={c.ink2}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            void search()
          }}
          style={[styles.input, { color: c.ink }]}
        />
        <Pressable onPress={() => void search()} style={styles.searchButton}>
          <Mono size={11} color={c.prussian} letterSpacing={0.44}>
            BUSCAR
          </Mono>
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        {notes.length === 0 ? (
          <EmptyCard text="Nenhuma nota indexada ainda." />
        ) : notes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </View>

      <SectionHeader label="Jogo cognitivo" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {game ? (
          <>
            <MetricRow label={game.title} value={game.score != null ? `${Math.round(game.score * 100)}%` : 'aberto'} />
            <Sans size={14} lineHeight={21} color={c.ink} style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              {game.prompt}
            </Sans>
            {game.atlas_feedback ? (
              <Sans size={13} lineHeight={19} color={c.ink2} style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                {game.atlas_feedback}
              </Sans>
            ) : null}
          </>
        ) : (
          <EmptyText text="Sem jogo criado para hoje." />
        )}
      </View>
      <PrimaryButton
        label={busy === 'game' ? 'Criando jogo...' : 'Novo jogo de recall'}
        variant="secondary"
        onPress={() => {
          void runAction('game', () => startCognitiveGame({ game_key: 'recall' }))
        }}
        style={{ marginTop: 12 }}
      />
    </Screen>
  )
}

function LoadingRow() {
  const c = usePalette()
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator color={c.prussian} />
      <Mono size={12} color={c.ink2}>Carregando...</Mono>
    </View>
  )
}

function LoadingCard() {
  const c = usePalette()
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <LoadingRow />
    </View>
  )
}

function EmptyText({ text }: { text: string }) {
  const c = usePalette()
  return (
    <Sans size={14} lineHeight={20} color={c.ink2} style={{ padding: 16 }}>
      {text}
    </Sans>
  )
}

function EmptyCard({ text }: { text: string }) {
  const c = usePalette()
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <EmptyText text={text} />
    </View>
  )
}

function MetricRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const c = usePalette()
  return (
    <View style={[styles.metricRow, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Sans size={15} color={c.ink2}>{label}</Sans>
      <Mono size={14} color={c.ink}>{value}</Mono>
    </View>
  )
}

function ProviderProjectionCard({
  projection,
  target,
  reviewMode,
  loading,
  busy,
  confirmArmed,
  onTargetChange,
  onReview,
  onApply,
  onCancelApply,
}: {
  projection: AtlasMemoryProviderProjection | null
  target: AtlasMemoryProviderProjectionTarget
  reviewMode: boolean
  loading: boolean
  busy: string | null
  confirmArmed: boolean
  onTargetChange: (target: AtlasMemoryProviderProjectionTarget) => void
  onReview: () => void
  onApply: () => void
  onCancelApply: () => void
}) {
  const c = usePalette()
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setExpandedDiffs({})
  }, [target, reviewMode, projection?.status])

  if (loading && !projection) return <LoadingCard />
  if (!projection) return <EmptyCard text="Provider projection indisponível." />

  const summary = projection.summary ?? {}
  const manualDrift = providerProjectionManualDriftCount(summary)
  const disabled = busy != null
  const canApply = providerProjectionCanApply(projection, reviewMode)
  const providerFiles = providerProjectionItems(projection)
  const files = providerFiles.slice(0, 3)
  const ready = projection.status === 'passed'

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.cardInner}>
        <View style={styles.noteMeta}>
          <Mono size={10} color={ready ? c.prussian : c.bronze} letterSpacing={0.8} style={{ textTransform: 'uppercase' }}>
            {reviewMode ? 'review carregada' : projection.status}
          </Mono>
          <Mono size={10} color={c.ink2}>{projection.targets?.join(' · ') ?? projection.target ?? 'all'}</Mono>
        </View>
        <Sans weight="sb" size={16} lineHeight={21} color={c.ink} style={{ marginTop: 6 }}>
          {ready ? 'Provider files em dia' : 'Provider files precisam de revisão'}
        </Sans>
        <Sans size={13} lineHeight={19} color={c.ink2} style={{ marginTop: 8 }}>
          {projection.detail ?? providerProjectionSummaryLine(summary)}
        </Sans>
        <ProviderProjectionTargetSelector
          target={target}
          disabled={disabled}
          onChange={onTargetChange}
        />
        <View style={styles.proposalTemplate}>
          <TemplateRow label="Resumo" value={providerProjectionSummaryLine(summary)} />
          <TemplateRow label="Workspace" value={clip(projection.workspace ?? '-', 110)} />
          {files.map((file) => (
            <TemplateRow
              key={`${file.target}-${file.path ?? file.change_type ?? 'projection'}`}
              label={file.target}
              value={providerProjectionFileLine(file, clip)}
            />
          ))}
        </View>
        {reviewMode && files.length > 0 ? (
          <ProviderProjectionDiffList
            files={providerFiles}
            expandedDiffs={expandedDiffs}
            onToggle={(key) => {
              setExpandedDiffs((current) => ({
                ...current,
                [key]: current[key] !== true,
              }))
            }}
          />
        ) : null}
        {manualDrift > 0 ? (
          <AuditLine label="Bloqueio" value="Drift manual detectado. Resolva o arquivo gerenciado antes do apply." />
        ) : confirmArmed ? (
          <AuditLine label="Confirmação" value="Apply confirmado no próximo toque. A revisão será revalidada antes da escrita." />
        ) : null}
      </View>
      <View style={[styles.cardActions, { borderTopColor: c.border }]}>
        <SmallAction
          label={busy === 'provider-projection-review' ? 'Revisando' : 'Revisar'}
          onPress={onReview}
          disabled={disabled}
        />
        <SmallAction
          label={confirmArmed ? 'Confirmar apply' : 'Aplicar review'}
          onPress={onApply}
          disabled={disabled || !canApply}
          danger={confirmArmed}
        />
        {confirmArmed ? (
          <SmallAction label="Cancelar" onPress={onCancelApply} disabled={disabled} />
        ) : null}
      </View>
    </View>
  )
}

function ProviderProjectionTargetSelector({
  target,
  disabled,
  onChange,
}: {
  target: AtlasMemoryProviderProjectionTarget
  disabled: boolean
  onChange: (target: AtlasMemoryProviderProjectionTarget) => void
}) {
  const c = usePalette()
  return (
    <View style={styles.providerTargetChips}>
      {PROVIDER_PROJECTION_TARGET_OPTIONS.map((option) => {
        const active = option.key === target
        return (
          <Pressable
            key={option.key}
            disabled={disabled}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.providerTargetChip,
              {
                backgroundColor: active ? c.ink : pressed ? c.premium : 'transparent',
                borderColor: active ? c.ink : c.border,
                opacity: disabled ? 0.48 : 1,
              },
            ]}
          >
            <Mono size={10.5} letterSpacing={0.35} color={active ? c.bg : c.ink2}>
              {option.label}
            </Mono>
          </Pressable>
        )
      })}
    </View>
  )
}

function ProviderProjectionDiffList({
  files,
  expandedDiffs,
  onToggle,
}: {
  files: AtlasMemoryProviderProjectionItem[]
  expandedDiffs: Record<string, boolean>
  onToggle: (key: string) => void
}) {
  const c = usePalette()
  const previews = files
    .map((file) => {
      const key = providerProjectionDiffKey(file)
      return {
        key,
        file,
        preview: providerProjectionDiffReview(file, expandedDiffs[key] === true),
      }
    })
    .filter(({ preview }) => preview.lines.length > 0)

  if (previews.length === 0) return null

  return (
    <View style={[styles.providerDiff, { borderColor: c.border }]}>
      <Mono size={10} letterSpacing={0.6} color={c.ink2} style={{ textTransform: 'uppercase' }}>
        Diff provider projection
      </Mono>
      {previews.map(({ key, file, preview }) => (
        <View key={key} style={styles.providerDiffRow}>
          <View style={styles.noteMeta}>
            <Mono size={10.5} color={c.prussian}>{file.target}</Mono>
            <Mono size={10} color={c.ink2}>
              {preview.hidden > 0 ? `+${preview.hidden} linhas ocultas` : 'completo'}
            </Mono>
          </View>
          <View style={[styles.providerDiffCode, { backgroundColor: c.bg, borderColor: c.border }]}>
            {preview.lines.map((line, index) => (
              <Mono
                key={`${key}-${index}`}
                size={10.5}
                lineHeight={15}
                color={providerProjectionDiffLineColor(providerProjectionDiffLineKind(line), c)}
                style={styles.providerDiffLine}
              >
                {clip(line, 140)}
              </Mono>
            ))}
          </View>
          {(preview.hidden > 0 || preview.expanded) ? (
            <Pressable
              onPress={() => onToggle(key)}
              style={({ pressed }) => [
                styles.providerDiffToggle,
                {
                  backgroundColor: pressed ? c.premium : 'transparent',
                  borderColor: c.border,
                },
              ]}
            >
              <Mono size={10.5} color={c.prussian} letterSpacing={0.32}>
                {providerProjectionDiffToggleLabel(preview.expanded, preview.hidden)}
              </Mono>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  )
}

function providerProjectionDiffLineColor(
  kind: ReturnType<typeof providerProjectionDiffLineKind>,
  c: ReturnType<typeof usePalette>,
): string {
  if (kind === 'addition') return c.prussian
  if (kind === 'removal') return c.recRed
  if (kind === 'hunk') return c.bronze
  if (kind === 'file') return c.ink

  return c.ink2
}

function ProviderProjectionAuditHistory({
  audits,
  summary,
  purge,
  target,
  resultFilter,
  initiatorFilter,
  busy,
  loading,
  purgeConfirmArmed,
  onResultChange,
  onInitiatorChange,
  onSimulatePurge,
  onApplyPurge,
  onCancelPurge,
}: {
  audits: AtlasMemoryProviderProjectionAudit[]
  summary: AtlasMemoryProviderProjectionAuditSummary | null
  purge: AtlasMemoryProviderProjectionAuditPurge | null
  target: AtlasMemoryProviderProjectionTarget
  resultFilter: ProviderProjectionAuditResultFilter
  initiatorFilter: ProviderProjectionAuditInitiatorFilter
  busy: string | null
  loading: boolean
  purgeConfirmArmed: boolean
  onResultChange: (result: ProviderProjectionAuditResultFilter) => void
  onInitiatorChange: (initiator: ProviderProjectionAuditInitiatorFilter) => void
  onSimulatePurge: () => void
  onApplyPurge: () => void
  onCancelPurge: () => void
}) {
  const c = usePalette()
  if (loading) return <LoadingCard />
  const purgeReady = providerProjectionAuditPurgeCanApply(purge, target, resultFilter, initiatorFilter)
  const purgeBusy = busy === 'provider-projection-audit-purge-dry-run' || busy === 'provider-projection-audit-purge-apply'

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.cardInner}>
        <View style={styles.noteMeta}>
          <Mono size={10} color={c.prussian} letterSpacing={0.8} style={{ textTransform: 'uppercase' }}>
            Histórico de apply
          </Mono>
          <Mono size={10} color={c.ink2}>{target}</Mono>
        </View>
        <Sans weight="sb" size={15} lineHeight={20} color={c.ink} style={{ marginTop: 6 }}>
          Auditoria provider projection
        </Sans>
        <Mono size={10.5} lineHeight={15} color={c.ink2} style={{ marginTop: 6 }}>
          {providerProjectionAuditFilterLine(resultFilter, initiatorFilter)}
        </Mono>
        <ProviderProjectionAuditFilters
          resultFilter={resultFilter}
          initiatorFilter={initiatorFilter}
          onResultChange={onResultChange}
          onInitiatorChange={onInitiatorChange}
        />
        <View style={styles.proposalTemplate}>
          <TemplateRow label="Resumo 30d" value={providerProjectionAuditOverviewLine(summary)} />
          <TemplateRow label="Periodo" value={providerProjectionAuditOverviewPeriodLine(summary)} />
          <TemplateRow label="Retencao 90d" value={providerProjectionAuditPurgeLine(purge)} />
          <TemplateRow label="Politica" value={providerProjectionAuditPurgePolicyLine(purge, target, resultFilter, initiatorFilter)} />
          <TemplateRow label="Permissao" value={providerProjectionAuditPurgePermissionLine(purge)} />
        </View>
        {purgeConfirmArmed ? (
          <AuditLine label="Confirmacao" value="O proximo toque remove auditorias antigas que batem com os filtros atuais." />
        ) : null}
        {audits.length === 0 ? (
          <AuditLine label="Histórico" value="Sem apply auditado para os filtros atuais." />
        ) : (
          <View style={styles.providerAuditList}>
            {audits.slice(0, 5).map((audit, index) => (
              <ProviderProjectionAuditRow
                key={audit.id}
                audit={audit}
                borderTop={index > 0}
              />
            ))}
          </View>
        )}
      </View>
      <View style={[styles.cardActions, { borderTopColor: c.border }]}>
        <SmallAction
          label={busy === 'provider-projection-audit-purge-dry-run' ? 'Simulando' : 'Simular purge'}
          onPress={onSimulatePurge}
          disabled={purgeBusy}
        />
        <SmallAction
          label={purgeConfirmArmed ? 'Confirmar purge' : 'Aplicar purge'}
          onPress={onApplyPurge}
          disabled={purgeBusy || !purgeReady}
          danger={purgeConfirmArmed}
        />
        {purgeConfirmArmed ? (
          <SmallAction label="Cancelar" onPress={onCancelPurge} disabled={purgeBusy} />
        ) : null}
      </View>
    </View>
  )
}

function ProviderProjectionAuditFilters({
  resultFilter,
  initiatorFilter,
  onResultChange,
  onInitiatorChange,
}: {
  resultFilter: ProviderProjectionAuditResultFilter
  initiatorFilter: ProviderProjectionAuditInitiatorFilter
  onResultChange: (result: ProviderProjectionAuditResultFilter) => void
  onInitiatorChange: (initiator: ProviderProjectionAuditInitiatorFilter) => void
}) {
  return (
    <View style={styles.providerAuditFilters}>
      <ProviderProjectionAuditChipGroup
        options={PROVIDER_PROJECTION_AUDIT_RESULT_OPTIONS}
        value={resultFilter}
        onChange={onResultChange}
      />
      <ProviderProjectionAuditChipGroup
        options={PROVIDER_PROJECTION_AUDIT_INITIATOR_OPTIONS}
        value={initiatorFilter}
        onChange={onInitiatorChange}
      />
    </View>
  )
}

function ProviderProjectionAuditChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  const c = usePalette()

  return (
    <View style={styles.providerAuditChips}>
      {options.map((option) => {
        const active = option.key === value
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.providerAuditChip,
              {
                backgroundColor: active ? c.ink : pressed ? c.premium : 'transparent',
                borderColor: active ? c.ink : c.border,
              },
            ]}
          >
            <Mono size={10.5} letterSpacing={0.32} color={active ? c.bg : c.ink2}>
              {option.label}
            </Mono>
          </Pressable>
        )
      })}
    </View>
  )
}

function ProviderProjectionAuditRow({
  audit,
  borderTop,
}: {
  audit: AtlasMemoryProviderProjectionAudit
  borderTop: boolean
}) {
  const c = usePalette()
  const items = providerProjectionAuditItems(audit).slice(0, 2)

  return (
    <View style={[
      styles.providerAuditRow,
      borderTop && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
    ]}>
      <View style={styles.noteMeta}>
        <Mono size={10.5} color={audit.ok ? c.prussian : c.recRed} letterSpacing={0.35}>
          {providerProjectionAuditStatusLabel(audit)} · {audit.target}
        </Mono>
        <Mono size={10} color={c.ink2}>{providerProjectionAuditMetaLine(audit)}</Mono>
      </View>
      <TemplateRow label="Resumo" value={providerProjectionAuditSummaryLine(audit)} />
      {items.map((item) => (
        <TemplateRow
          key={`${audit.id}-${item.target}-${item.path ?? item.change_type ?? 'item'}`}
          label={item.target}
          value={providerProjectionFileLine(item, clip)}
        />
      ))}
    </View>
  )
}

function ActivationCard({
  activation,
  onUseful,
  onUseless,
  onTooEarly,
  onTooLate,
  onDismiss,
  busy,
}: {
  activation: AtlasSemanticActivation
  onUseful: () => void
  onUseless: () => void
  onTooEarly: () => void
  onTooLate: () => void
  onDismiss: () => void
  busy: string | null
}) {
  const c = usePalette()
  const disabled = busy != null

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.cardInner}>
        <Mono size={10} color={c.bronze} letterSpacing={0.8} style={{ textTransform: 'uppercase' }}>
          {activation.activation_type} · {activation.note?.type ?? 'nota'}
        </Mono>
        <Sans weight="sb" size={16} lineHeight={21} color={c.ink} style={{ marginTop: 6 }}>
          {activation.note?.title ?? 'Memória sem título'}
        </Sans>
        <Sans size={14} lineHeight={21} color={c.ink2} style={{ marginTop: 8 }}>
          {activation.prompt}
        </Sans>
        {activation.metadata?.fatigue_policy ? (
          <Mono size={10.5} lineHeight={15} color={c.ink2} style={{ marginTop: 10 }}>
            Fadiga: {activationRelevance(activation)} · poucos disparos, alta relevância
          </Mono>
        ) : null}
        <AuditLine
          label="Por que"
          value={activationWhy(activation)}
        />
      </View>
      <View style={[styles.cardActions, { borderTopColor: c.border }]}>
        <SmallAction label="Útil" onPress={onUseful} disabled={disabled} />
        <SmallAction label="Inútil" onPress={onUseless} disabled={disabled} danger />
        <SmallAction label="Cedo" onPress={onTooEarly} disabled={disabled} />
        <SmallAction label="Tarde" onPress={onTooLate} disabled={disabled} />
        <SmallAction label="Dispensar" onPress={onDismiss} disabled={disabled} danger />
      </View>
    </View>
  )
}

function ProposalCard({
  proposal,
  onAccept,
  onDismiss,
  busy,
}: {
  proposal: AtlasSemanticCurationProposal
  onAccept: () => void
  onDismiss: () => void
  busy: string | null
}) {
  const c = usePalette()
  const disabled = busy != null
  const template = proposalTemplate(proposal)

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.cardInner}>
        <Mono size={10} color={c.bronze} letterSpacing={0.8} style={{ textTransform: 'uppercase' }}>
          {proposal.proposed_note_type} · {proposal.score != null ? `${Math.round(proposal.score * 100)}%` : 'sem score'}
        </Mono>
        <Sans weight="sb" size={16} lineHeight={21} color={c.ink} style={{ marginTop: 6 }}>
          {proposal.proposed_title}
        </Sans>
        <Sans size={14} lineHeight={21} color={c.ink2} style={{ marginTop: 8 }}>
          {proposal.proposed_summary}
        </Sans>
        <View style={styles.proposalTemplate}>
          <TemplateRow label="Tese" value={template.thesis} />
          <TemplateRow label="Próxima ação" value={template.nextAction} />
          <TemplateRow label="Maturidade" value={template.maturity} />
          <TemplateRow label="Fonte" value={template.rawSource} />
        </View>
        <AuditLine label="Por que" value={proposal.reason} />
      </View>
      <View style={[styles.cardActions, { borderTopColor: c.border }]}>
        <SmallAction label="Ratificar" onPress={onAccept} disabled={disabled} />
        <SmallAction label="Ignorar" onPress={onDismiss} disabled={disabled} danger />
      </View>
    </View>
  )
}

function AuditCard({ item }: { item: AtlasAuditItem }) {
  const c = usePalette()
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.cardInner}>
        <View style={styles.noteMeta}>
          <Mono size={10} color={auditTypeColor(item.type, c)} letterSpacing={0.8} style={{ textTransform: 'uppercase' }}>
            {auditTypeLabel(item.type)} · {item.status}
          </Mono>
          <Mono size={10} color={c.ink2}>{auditPrivacy(item)}</Mono>
        </View>
        <Sans weight="sb" size={15} lineHeight={20} color={c.ink} style={{ marginTop: 6 }}>
          {item.title}
        </Sans>
        <Sans size={13} lineHeight={19} color={c.ink2} style={{ marginTop: 8 }}>
          {item.why}
        </Sans>
        <View style={styles.auditFacts}>
          <TemplateRow label="Evidência" value={auditEvidenceDetail(item)} />
          <TemplateRow label="Referência" value={auditRef(item)} />
        </View>
      </View>
    </View>
  )
}

function ReviewQueueFilters({
  filters,
  activeFilters,
  loading,
  onChange,
  onApply,
  onClear,
}: {
  filters: ReviewFilters
  activeFilters: ReviewFilters
  loading: boolean
  onChange: (filters: ReviewFilters) => void
  onApply: () => void
  onClear: () => void
}) {
  const c = usePalette()
  const hasActiveFilters = !sameReviewFilters(activeFilters, DEFAULT_REVIEW_FILTERS)

  return (
    <View style={[styles.filterPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <FilterChipGroup
        label="Área"
        options={REVIEW_AREA_OPTIONS}
        value={filters.area}
        onChange={(area) => onChange({ ...filters, area })}
      />
      <FilterChipGroup
        label="Severidade"
        options={REVIEW_SEVERITY_OPTIONS}
        value={filters.severity}
        onChange={(severity) => onChange({ ...filters, severity })}
      />
      <FilterChipGroup
        label="Privacidade"
        options={REVIEW_PRIVACY_OPTIONS}
        value={filters.privacyClass}
        onChange={(privacyClass) => onChange({ ...filters, privacyClass })}
      />
      <View style={styles.filterToggles}>
        <FilterToggle
          label="Sem review"
          active={filters.includeUnreviewed}
          onPress={() => onChange({ ...filters, includeUnreviewed: !filters.includeUnreviewed })}
        />
        <FilterToggle
          label="Inativas"
          active={filters.includeInactive}
          onPress={() => onChange({ ...filters, includeInactive: !filters.includeInactive })}
        />
      </View>
      <View style={styles.filterInputs}>
        <FilterInput
          label="Escopo"
          value={filters.scopeType}
          placeholder="project"
          onChangeText={(scopeType) => onChange({ ...filters, scopeType })}
        />
        <FilterInput
          label="ID escopo"
          value={filters.scopeId}
          placeholder="uuid ou chave"
          onChangeText={(scopeId) => onChange({ ...filters, scopeId })}
        />
        <FilterInput
          label="Projeto"
          value={filters.projectId}
          placeholder="uuid"
          onChangeText={(projectId) => onChange({ ...filters, projectId })}
        />
        <FilterInput
          label="Task"
          value={filters.taskId}
          placeholder="uuid"
          onChangeText={(taskId) => onChange({ ...filters, taskId })}
        />
        <FilterInput
          label="Run"
          value={filters.engineeringRunId}
          placeholder="uuid"
          onChangeText={(engineeringRunId) => onChange({ ...filters, engineeringRunId })}
        />
      </View>
      <View style={[styles.filterActions, { borderTopColor: c.border }]}>
        <SmallAction label={loading ? 'Carregando' : 'Aplicar'} onPress={onApply} disabled={loading} />
        <SmallAction label={hasActiveFilters ? 'Limpar' : 'Limpo'} onPress={onClear} disabled={loading || !hasActiveFilters} danger={hasActiveFilters} />
      </View>
    </View>
  )
}

function ReviewQueueSummary({
  queue,
  visibleCount,
  filters,
}: {
  queue: AtlasMemoryReviewQueue
  visibleCount: number
  filters: ReviewFilters
}) {
  const c = usePalette()
  const active = activeReviewFilterLabels(filters)
  const counts = [
    `registry ${queue.counts.memory_privacy ?? 0}`,
    `verbatim ${queue.counts.verbatim_privacy ?? 0}`,
    `relações ${queue.counts.relation ?? 0}`,
  ].join(' · ')

  return (
    <View style={[styles.reviewSummary, { borderColor: c.border }]}>
      <Mono size={10.5} lineHeight={15} letterSpacing={0.24} color={c.ink2}>
        {visibleCount}/{queue.total} visíveis · {counts}
      </Mono>
      {active.length > 0 ? (
        <Mono size={10.5} lineHeight={15} letterSpacing={0.24} color={c.ink2}>
          {active.join(' · ')}
        </Mono>
      ) : null}
    </View>
  )
}

function ReviewQueueNavigator({
  currentIndex,
  total,
  selected,
  disabled,
  onPrevious,
  onNext,
  onToggleSelected,
  onClose,
}: {
  currentIndex: number
  total: number
  selected: boolean
  disabled: boolean
  onPrevious: () => void
  onNext: () => void
  onToggleSelected: () => void
  onClose: () => void
}) {
  const c = usePalette()
  if (total === 0) return null

  const position = currentIndex >= 0 ? `${currentIndex + 1}/${total}` : `0/${total}`

  return (
    <View style={[styles.reviewNavigator, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.reviewNavigatorText}>
        <Mono size={10} letterSpacing={0.6} color={c.ink2} style={{ textTransform: 'uppercase' }}>
          Foco da fila
        </Mono>
        <Mono size={11} lineHeight={15} letterSpacing={0.24} color={c.ink}>
          {position}
        </Mono>
      </View>
      <View style={[styles.reviewNavigatorActions, { borderTopColor: c.border }]}>
        <SmallAction label="Anterior" onPress={onPrevious} disabled={disabled} />
        <SmallAction label="Próximo" onPress={onNext} disabled={disabled} />
        <SmallAction label={selected ? 'Selecionado' : 'Selecionar'} onPress={onToggleSelected} disabled={disabled} />
        <SmallAction label="Fechar" onPress={onClose} disabled={disabled} />
      </View>
    </View>
  )
}

function ReviewBatchToolbar({
  plan,
  busy,
  totalVisible,
  onSelectAll,
  onClear,
  onBlockPrivacy,
  onDismissRelations,
}: {
  plan: ReturnType<typeof buildMemoryReviewBatchPlan>
  busy: string | null
  totalVisible: number
  onSelectAll: () => void
  onClear: () => void
  onBlockPrivacy: () => void
  onDismissRelations: () => void
}) {
  const c = usePalette()
  const disabled = busy != null || totalVisible === 0
  const hasSelection = plan.selected_count > 0

  return (
    <View style={[styles.batchToolbar, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.batchToolbarText}>
        <Mono size={10} letterSpacing={0.6} color={c.ink2} style={{ textTransform: 'uppercase' }}>
          Revisão em lote
        </Mono>
        <Sans size={12.5} lineHeight={18} color={c.ink2}>
          {hasSelection
            ? `${plan.selected_count} selecionado(s) · ${plan.privacy_count} privacidade · ${plan.relation_count} relações`
            : 'Selecione itens para bloquear privacidade ou dispensar relações.'}
        </Sans>
        {plan.unsupported_count > 0 ? (
          <Sans size={12.5} lineHeight={18} color={c.bronze}>
            {plan.unsupported_count} item(ns) não entram nas ações em lote.
          </Sans>
        ) : null}
      </View>
      <View style={[styles.batchActions, { borderTopColor: c.border }]}>
        <SmallAction label="Selecionar" onPress={onSelectAll} disabled={disabled} />
        <SmallAction label="Limpar" onPress={onClear} disabled={disabled || !hasSelection} />
        <SmallAction label={`Bloquear ${plan.privacy_count || ''}`.trim()} onPress={onBlockPrivacy} disabled={disabled || !plan.can_block_privacy} danger />
        <SmallAction label={`Dispensar ${plan.relation_count || ''}`.trim()} onPress={onDismissRelations} disabled={disabled || !plan.can_dismiss_relations} danger />
      </View>
    </View>
  )
}

function FilterChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ key: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  const c = usePalette()
  return (
    <View style={styles.filterBlock}>
      <Mono size={10} letterSpacing={0.6} color={c.ink2} style={{ textTransform: 'uppercase' }}>
        {label}
      </Mono>
      <View style={styles.filterChips}>
        {options.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.filterChip,
              {
                backgroundColor: value === option.key ? c.ink : pressed ? c.premium : 'transparent',
                borderColor: value === option.key ? c.ink : c.border,
              },
            ]}
          >
            <Sans weight="sb" size={12} lineHeight={16} color={value === option.key ? c.bg : c.ink}>
              {option.label}
            </Sans>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function FilterToggle({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterToggle,
        {
          backgroundColor: active ? c.ink : pressed ? c.premium : 'transparent',
          borderColor: active ? c.ink : c.border,
        },
      ]}
    >
      <Sans weight="sb" size={12} lineHeight={16} color={active ? c.bg : c.ink}>
        {label}
      </Sans>
    </Pressable>
  )
}

function FilterInput({
  label,
  value,
  placeholder,
  onChangeText,
}: {
  label: string
  value: string
  placeholder: string
  onChangeText: (value: string) => void
}) {
  const c = usePalette()
  return (
    <View style={[styles.filterInputWrap, { borderColor: c.border }]}>
      <Mono size={10} letterSpacing={0.4} color={c.ink2}>{label}</Mono>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.ink2}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.filterInput, { color: c.ink }]}
      />
    </View>
  )
}

function ReviewQueueCard({
  item,
  busy,
  draft,
  detail,
  selected,
  expanded,
  onToggleSelected,
  onToggleEditor,
  onDraftChange,
  onRelease,
  onBlock,
  onResolve,
  onDismiss,
}: {
  item: AtlasMemoryReviewQueueItem
  busy: string | null
  draft: ReviewDraft
  detail?: ReviewDetailState
  selected: boolean
  expanded: boolean
  onToggleSelected: () => void
  onToggleEditor: () => void
  onDraftChange: (patch: Partial<ReviewDraft>) => void
  onRelease: () => void
  onBlock: () => void
  onResolve: () => void
  onDismiss: () => void
}) {
  const c = usePalette()
  const disabled = busy != null
  const relation = item.kind === 'relation'
  const preview = reviewProviderPreview(item, draft, detail)
  const safetyIssues = reviewProviderSafetyIssues(preview)
  const diffs = reviewProviderDiffs(item, detail, preview)
  const releaseDisabled = disabled || (item.kind !== 'relation' && (
    !draftAllowsProviderRelease(item, draft, detail) || hasBlockingProviderSafetyIssue(safetyIssues)
  ))

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: selected ? c.bronze : c.border }]}>
      <View style={styles.cardInner}>
        <View style={styles.noteMeta}>
          <Mono size={10} color={reviewSeverityColor(item.severity, c)} letterSpacing={0.8} style={{ textTransform: 'uppercase' }}>
            {reviewKindLabel(item)} · {item.severity}
          </Mono>
          <Mono size={10} color={c.ink2}>P{item.priority}</Mono>
        </View>
        <Sans weight="sb" size={16} lineHeight={21} color={c.ink} style={{ marginTop: 6 }}>
          {reviewItemTitle(item)}
        </Sans>
        <Sans size={13} lineHeight={19} color={c.ink2} style={{ marginTop: 8 }}>
          {reviewItemSummary(item)}
        </Sans>
        <View style={styles.auditFacts}>
          <TemplateRow label="Motivo" value={item.reason ?? 'Revisão pendente.'} />
          <TemplateRow label="Escopo" value={item.scope ?? reviewRelationScope(item)} />
          <TemplateRow label="Política" value={reviewPolicyLabel(item)} />
        </View>
      </View>
      {expanded ? (
        <View style={[styles.reviewEditor, { borderTopColor: c.border }]}>
          {detail?.loading ? (
            <LoadingRow />
          ) : detail?.error ? (
            <Sans size={13} lineHeight={19} color={c.recRed}>
              {detail.error}
            </Sans>
          ) : null}
          <ReviewTextArea
            label="Nota"
            value={draft.reviewNote}
            placeholder="Motivo da decisão"
            onChangeText={(reviewNote) => onDraftChange({ reviewNote })}
          />
          {item.kind === 'memory_privacy' ? (
            <>
              <ReviewTextArea
                label="Título seguro"
                value={draft.redactedTitle}
                placeholder="Título liberável para provider"
                onChangeText={(redactedTitle) => onDraftChange({ redactedTitle })}
              />
              <ReviewTextArea
                label="Body seguro"
                value={draft.redactedBody}
                placeholder="Conteúdo liberável para provider"
                onChangeText={(redactedBody) => onDraftChange({ redactedBody })}
                tall
              />
              <ReviewTextArea
                label="Resumo seguro"
                value={draft.safeSummary}
                placeholder="Resumo liberável para provider"
                onChangeText={(safeSummary) => onDraftChange({ safeSummary })}
              />
            </>
          ) : item.kind === 'verbatim_privacy' ? (
            <>
              <ReviewTextArea
                label="Resumo seguro"
                value={draft.safeSummary}
                placeholder="Resumo liberável para provider"
                onChangeText={(safeSummary) => onDraftChange({ safeSummary })}
              />
              <ReviewTextArea
                label="Texto redigido"
                value={draft.redactedText}
                placeholder="Texto verbatim redigido para provider"
                onChangeText={(redactedText) => onDraftChange({ redactedText })}
                tall
              />
              <Mono size={10.5} lineHeight={15} color={c.ink2}>
                O verbatim bruto nao e carregado aqui; o preview usa apenas texto redigido.
              </Mono>
            </>
          ) : null}
          <ProviderPreview
            title={preview.title}
            body={preview.body}
            summary={preview.summary}
            blocked={item.kind !== 'relation' && (
              !draftAllowsProviderRelease(item, draft, detail) || hasBlockingProviderSafetyIssue(safetyIssues)
            )}
          />
          {diffs.length > 0 ? <ProviderReviewDiffList diffs={diffs} /> : null}
          <ProviderSafetyWarnings issues={safetyIssues} />
        </View>
      ) : null}
      <View style={[styles.cardActions, { borderTopColor: c.border }]}>
        {relation ? (
          <>
            <SmallAction label={selected ? 'Selecionado' : 'Selecionar'} onPress={onToggleSelected} disabled={disabled} />
            <SmallAction label={expanded ? 'Fechar' : 'Editar'} onPress={onToggleEditor} disabled={disabled} />
            <SmallAction label="Resolver" onPress={onResolve} disabled={disabled} />
            <SmallAction label="Dispensar" onPress={onDismiss} disabled={disabled} danger />
          </>
        ) : (
          <>
            <SmallAction label={selected ? 'Selecionado' : 'Selecionar'} onPress={onToggleSelected} disabled={disabled} />
            <SmallAction label={expanded ? 'Fechar' : 'Editar'} onPress={onToggleEditor} disabled={disabled} />
            <SmallAction label="Liberar" onPress={onRelease} disabled={releaseDisabled} />
            <SmallAction label="Bloquear" onPress={onBlock} disabled={disabled} danger />
          </>
        )}
      </View>
    </View>
  )
}

function ReviewTextArea({
  label,
  value,
  placeholder,
  onChangeText,
  tall,
}: {
  label: string
  value: string
  placeholder: string
  onChangeText: (value: string) => void
  tall?: boolean
}) {
  const c = usePalette()
  return (
    <View style={styles.reviewTextAreaWrap}>
      <Mono size={10} letterSpacing={0.4} color={c.ink2}>{label}</Mono>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.ink2}
        autoCapitalize="sentences"
        multiline
        style={[styles.reviewTextArea, tall ? styles.reviewTextAreaTall : null, { color: c.ink, borderColor: c.border }]}
      />
    </View>
  )
}

function ProviderPreview({
  title,
  body,
  summary,
  blocked,
}: {
  title: string | null
  body: string | null
  summary: string | null
  blocked: boolean
}) {
  const c = usePalette()
  return (
    <View style={[styles.providerPreview, { borderColor: blocked ? c.recRed : c.border }]}>
      <View style={styles.noteMeta}>
        <Mono size={10} letterSpacing={0.6} color={blocked ? c.recRed : c.prussian} style={{ textTransform: 'uppercase' }}>
          Preview provider-safe
        </Mono>
        <Mono size={10} color={c.ink2}>{blocked ? 'incompleto' : 'pronto'}</Mono>
      </View>
      {title ? <TemplateRow label="Título" value={clip(title, 180)} /> : null}
      {summary ? <TemplateRow label="Resumo" value={clip(summary, 240)} /> : null}
      <TemplateRow label="Conteúdo" value={clip(body || 'Sem body seguro preenchido.', 520)} />
    </View>
  )
}

function ProviderReviewDiffList({ diffs }: { diffs: ProviderReviewDiff[] }) {
  const c = usePalette()
  return (
    <View style={[styles.providerDiff, { borderColor: c.border }]}>
      <Mono size={10} letterSpacing={0.6} color={c.ink2} style={{ textTransform: 'uppercase' }}>
        Diff de revisão
      </Mono>
      {diffs.map((diff) => (
        <View key={diff.key} style={styles.providerDiffRow}>
          <View style={styles.noteMeta}>
            <Mono size={10} color={diff.changed ? c.bronze : c.ink2}>{diff.label}</Mono>
            <Mono size={10} color={diff.changed ? c.bronze : c.ink2}>{diff.changed ? 'alterado' : 'igual'}</Mono>
          </View>
          <TemplateRow label="Atual" value={diff.current_excerpt} />
          <TemplateRow label="Proposto" value={diff.proposed_excerpt} />
        </View>
      ))}
    </View>
  )
}

function ProviderSafetyWarnings({ issues }: { issues: ProviderSafetyIssue[] }) {
  const c = usePalette()
  if (issues.length === 0) {
    return (
      <View style={[styles.providerSafety, { borderColor: c.border }]}>
        <Mono size={10} letterSpacing={0.6} color={c.moss} style={{ textTransform: 'uppercase' }}>
          Alerta local
        </Mono>
        <Sans size={12.5} lineHeight={18} color={c.ink2}>
          Nenhum padrão óbvio de segredo foi detectado no preview.
        </Sans>
      </View>
    )
  }

  const highRisk = hasBlockingProviderSafetyIssue(issues)
  return (
    <View style={[styles.providerSafety, { borderColor: highRisk ? c.recRed : c.bronze }]}>
      <Mono size={10} letterSpacing={0.6} color={highRisk ? c.recRed : c.bronze} style={{ textTransform: 'uppercase' }}>
        Alerta local
      </Mono>
      {issues.map((issue) => (
        <Sans key={`${issue.key}-${issue.sample}`} size={12.5} lineHeight={18} color={highRisk ? c.recRed : c.ink2}>
          {issue.label}: {issue.detail} ({issue.sample})
        </Sans>
      ))}
    </View>
  )
}

function AuditLine({ label, value }: { label: string; value: string }) {
  const c = usePalette()
  if (!value) return null

  return (
    <View style={styles.auditLine}>
      <Mono size={10} letterSpacing={0.4} color={c.ink2}>{label}</Mono>
      <Sans size={12.5} lineHeight={17} color={c.ink2}>{value}</Sans>
    </View>
  )
}

function TemplateRow({ label, value }: { label: string; value: string }) {
  const c = usePalette()
  return (
    <View style={styles.templateRow}>
      <Mono size={10} letterSpacing={0.4} color={c.ink2}>{label}</Mono>
      <Sans size={12.5} lineHeight={17} color={c.ink}>{value}</Sans>
    </View>
  )
}

function proposalTemplate(proposal: AtlasSemanticCurationProposal) {
  const frontmatter = proposal.proposed_frontmatter ?? {}
  return {
    thesis: stringValue(frontmatter.thesis) || proposal.proposed_summary,
    nextAction: stringValue(frontmatter.next_action) || 'Vitor ratificar, editar ou descartar.',
    maturity: stringValue(frontmatter.maturity) || 'seed',
    rawSource: clip(stringValue(frontmatter.raw_source) || sourceRef(proposal), 120),
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function sourceRef(proposal: AtlasSemanticCurationProposal): string {
  const captureId = proposal.source_refs?.capture_id
  return typeof captureId === 'string' ? `capture:${captureId.slice(0, 8)}` : proposal.source_type
}

function cognitiveReturnFromHealth(health: AtlasVaultHealthSnapshot | null): AtlasCognitiveReturn | null {
  if (!health) return null
  if (health.cognitive_return && Object.keys(health.cognitive_return).length > 0) {
    return health.cognitive_return
  }

  const metadataReturn = health.metadata?.cognitive_return
  if (metadataReturn && typeof metadataReturn === 'object' && !Array.isArray(metadataReturn)) {
    return metadataReturn as AtlasCognitiveReturn
  }

  return {
    score: health.activations_7d > 0 ? Math.round((health.useful_activations_7d / health.activations_7d) * 100) : 0,
    label: health.activations_7d > 0 ? 'básico' : 'sem sinal',
    activations_7d: health.activations_7d,
    useful_activations_7d: health.useful_activations_7d,
    utility_rate_7d: health.activations_7d > 0 ? health.useful_activations_7d / health.activations_7d : 0,
    notes_per_useful_activation_7d: health.useful_activations_7d > 0 ? health.active_notes / health.useful_activations_7d : null,
    interpretation: 'Métrica básica derivada do snapshot atual; recalcule o vault para CRON completo.',
  }
}

function percent(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'sem dado'
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value
}

function activationRelevance(activation: AtlasSemanticActivation): string {
  const score = activation.context_payload?.score ?? activation.metadata?.relevance_score
  if (typeof score === 'number') return String(score)
  if (typeof score === 'string') return score
  return 'sem score'
}

function activationWhy(activation: AtlasSemanticActivation): string {
  const matches = activation.context_payload?.matched_signals
  if (Array.isArray(matches) && matches.length > 0) {
    return `Sinais casaram: ${matches.slice(0, 5).join(' · ')}.`
  }

  return `Contexto: ${activation.context_type}.`
}

function auditTypeLabel(type: string): string {
  switch (type) {
    case 'curation_proposal':
      return 'proposta'
    case 'semantic_activation':
      return 'ativação'
    case 'ai_audit':
      return 'ia'
    default:
      return type.replace(/_/g, ' ')
  }
}

function auditTypeColor(type: string, c: ReturnType<typeof usePalette>): string {
  if (type === 'semantic_activation') return c.moss
  if (type === 'ai_audit') return c.prussian
  return c.bronze
}

function auditPrivacy(item: AtlasAuditItem): string {
  const sensitivity = item.privacy?.sensitivity
  return typeof sensitivity === 'string' && sensitivity ? sensitivity : 'normal'
}

function auditEvidenceDetail(item: AtlasAuditItem): string {
  const evidence = item.evidence ?? {}
  const pieces = [
    stringValue(evidence.main_thesis),
    signalList(evidence.matched_signals),
    stringValue(evidence.provider),
    stringValue(evidence.context_type),
  ].filter(Boolean)

  return clip(pieces.join(' · ') || 'Sem evidência resumida.', 180)
}

function auditRef(item: AtlasAuditItem): string {
  const refs = item.raw_refs ?? {}
  const keys = ['capture_id', 'note_id', 'trace_id', 'job_id', 'activation_id']
  const found = keys
    .map((key) => {
      const value = refs[key]
      return typeof value === 'string' && value ? `${key}:${value.slice(0, 8)}` : null
    })
    .filter(Boolean)

  return found.join(' · ') || item.id
}

function signalList(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null

  return value.slice(0, 5).map((item) => String(item)).join(' · ')
}

function reviewSeverityColor(severity: string, c: ReturnType<typeof usePalette>): string {
  if (severity === 'high') return c.recRed
  if (severity === 'medium') return c.bronze
  return c.prussian
}

function reviewKindLabel(item: AtlasMemoryReviewQueueItem): string {
  if (item.kind === 'memory_privacy') return 'registry'
  if (item.kind === 'verbatim_privacy') return 'verbatim'
  if (item.kind === 'relation') return item.relation_type === 'duplicate' ? 'duplicata' : 'conflito'

  return item.kind.replace(/_/g, ' ')
}

function reviewItemTitle(item: AtlasMemoryReviewQueueItem): string {
  if (item.title) return item.title
  if (item.kind === 'relation') {
    return [
      recordString(item.source_memory, 'title') ?? item.source_memory_entry_id,
      recordString(item.target_memory, 'title') ?? item.target_memory_entry_id,
    ].filter(Boolean).join(' ↔ ') || 'Relação de memória'
  }

  return item.id
}

function reviewItemSummary(item: AtlasMemoryReviewQueueItem): string {
  if (item.summary) return clip(item.summary, 220)
  if (item.kind === 'relation') {
    const source = recordString(item.source_memory, 'summary') ?? recordString(item.source_memory, 'title')
    const target = recordString(item.target_memory, 'summary') ?? recordString(item.target_memory, 'title')
    return clip([source, target].filter(Boolean).join(' · ') || item.reason || 'Relação aberta para revisão.', 220)
  }

  return item.action_hint ?? 'Revisão pendente.'
}

function reviewPolicyLabel(item: AtlasMemoryReviewQueueItem): string {
  if (item.kind === 'relation') return `${item.relation_type ?? 'relation'} · ${item.status ?? 'open'}`

  const external = item.external_ai_allowed === false ? 'provider bloqueado' : 'provider permitido'
  return `${item.privacy_class ?? 'normal'} · ${item.redaction_status ?? 'clean'} · ${external}`
}

function reviewRelationScope(item: AtlasMemoryReviewQueueItem): string {
  const source = recordString(item.source_memory, 'scope')
  const target = recordString(item.target_memory, 'scope')

  return [source, target].filter(Boolean).join(' · ') || 'global'
}

function recordString(record: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = record?.[key]

  return typeof value === 'string' && value.trim() ? value : null
}

function initialFiltersFromParamsOrStorage(params: Record<string, string | string[]>): ReviewFilters {
  const routeFilters = memoryReviewFiltersFromParams(params)
  if (hasActiveReviewFilters(routeFilters)) return routeFilters

  return loadSavedMemoryReviewFilters() ?? DEFAULT_REVIEW_FILTERS
}

function reviewQueueParamsFromFilters(filters: ReviewFilters): ReviewQueueParams {
  const params: ReviewQueueParams = {
    limit: filters.severity === 'all' ? 12 : 50,
  }
  if (filters.area !== 'all') params.area = filters.area
  if (filters.privacyClass !== 'all') params.privacy_class = filters.privacyClass
  if (filters.includeUnreviewed) params.include_unreviewed = true
  if (filters.includeInactive) params.include_inactive = true

  const scopeType = cleanText(filters.scopeType)
  const scopeId = cleanText(filters.scopeId)
  const projectId = cleanText(filters.projectId)
  const taskId = cleanText(filters.taskId)
  const engineeringRunId = cleanText(filters.engineeringRunId)
  if (scopeType) params.scope_type = scopeType
  if (scopeId) params.scope_id = scopeId
  if (projectId) params.project_id = projectId
  if (taskId) params.task_id = taskId
  if (engineeringRunId) params.engineering_run_id = engineeringRunId

  return params
}

function filterReviewQueueItems(items: AtlasMemoryReviewQueueItem[], filters: ReviewFilters): AtlasMemoryReviewQueueItem[] {
  return items.filter((item) => {
    if (filters.area !== 'all' && item.kind !== filters.area) return false
    if (filters.severity !== 'all' && item.severity !== filters.severity) return false
    if (filters.privacyClass !== 'all' && item.kind !== 'relation' && item.privacy_class !== filters.privacyClass) return false
    return true
  })
}

function reviewMetadata(filters: ReviewFilters): Record<string, unknown> {
  return {
    review_surface: 'atlas-app-memory',
    review_filters: reviewQueueParamsFromFilters(filters),
  }
}

function reviewBatchMetadata(filters: ReviewFilters, action: MemoryReviewBatchAction): Record<string, unknown> {
  return {
    ...reviewMetadata(filters),
    review_batch: true,
    review_batch_action: action,
  }
}

function reviewDefaultNote(item: AtlasMemoryReviewQueueItem, action: 'release' | 'block' | 'resolve' | 'dismiss'): string {
  if (item.kind === 'relation') {
    return action === 'dismiss'
      ? 'Relacao dispensada pela fila visual do Atlas app.'
      : 'Relacao resolvida pela fila visual do Atlas app.'
  }

  return action === 'release'
    ? 'Liberado pela fila visual do Atlas app.'
    : 'Bloqueado pela fila visual do Atlas app.'
}

function activeReviewFilterLabels(filters: ReviewFilters): string[] {
  const labels = []
  if (filters.area !== 'all') labels.push(`área ${reviewOptionLabel(REVIEW_AREA_OPTIONS, filters.area)}`)
  if (filters.severity !== 'all') labels.push(`sev ${reviewOptionLabel(REVIEW_SEVERITY_OPTIONS, filters.severity)}`)
  if (filters.privacyClass !== 'all') labels.push(`priv ${reviewOptionLabel(REVIEW_PRIVACY_OPTIONS, filters.privacyClass)}`)
  if (filters.includeUnreviewed) labels.push('sem review')
  if (filters.includeInactive) labels.push('inativas')
  if (filters.scopeType) labels.push(`escopo ${filters.scopeType}`)
  if (filters.scopeId) labels.push(`id ${clip(filters.scopeId, 12)}`)
  if (filters.projectId) labels.push(`projeto ${clip(filters.projectId, 8)}`)
  if (filters.taskId) labels.push(`task ${clip(filters.taskId, 8)}`)
  if (filters.engineeringRunId) labels.push(`run ${clip(filters.engineeringRunId, 8)}`)

  return labels
}

function reviewOptionLabel<T extends string>(options: Array<{ key: T; label: string }>, key: T): string {
  return options.find((option) => option.key === key)?.label ?? key
}

function cleanText(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function draftFromMemoryDetail(memory: AtlasMemoryRegistryEntry, item: AtlasMemoryReviewQueueItem): Partial<ReviewDraft> {
  return {
    redactedTitle: memory.redacted_title ?? item.title ?? '',
    redactedBody: memory.redacted_body ?? '',
    safeSummary: memory.redacted_summary ?? memory.summary ?? item.summary ?? '',
  }
}

function draftFromVerbatimDetail(verbatim: AtlasVerbatimMemoryEntry, item: AtlasMemoryReviewQueueItem): Partial<ReviewDraft> {
  return {
    safeSummary: verbatim.summary ?? item.summary ?? '',
    redactedText: verbatim.redacted_text ?? '',
  }
}

function reviewProviderPreview(
  item: AtlasMemoryReviewQueueItem,
  draft: ReviewDraft,
  detail?: ReviewDetailState,
): { title: string | null; body: string | null; summary: string | null } {
  if (item.kind === 'memory_privacy') {
    return {
      title: cleanText(draft.redactedTitle) ?? detail?.memory?.redacted_title ?? item.title ?? null,
      body: cleanText(draft.redactedBody) ?? detail?.memory?.redacted_body ?? null,
      summary: cleanText(draft.safeSummary) ?? detail?.memory?.redacted_summary ?? item.summary ?? null,
    }
  }

  if (item.kind === 'verbatim_privacy') {
    return {
      title: item.title ?? detail?.verbatim?.title ?? null,
      body: cleanText(draft.redactedText) ?? detail?.verbatim?.redacted_text ?? null,
      summary: cleanText(draft.safeSummary) ?? detail?.verbatim?.summary ?? item.summary ?? null,
    }
  }

  return {
    title: reviewItemTitle(item),
    body: reviewItemSummary(item),
    summary: item.reason,
  }
}

function draftAllowsProviderRelease(
  item: AtlasMemoryReviewQueueItem,
  draft: ReviewDraft,
  detail?: ReviewDetailState,
): boolean {
  const preview = reviewProviderPreview(item, draft, detail)

  return Boolean(cleanText(preview.body ?? ''))
}

function reviewProviderSafetyIssues(preview: { title: string | null; body: string | null; summary: string | null }): ProviderSafetyIssue[] {
  return detectProviderSafetyIssues([
    preview.title,
    preview.summary,
    preview.body,
  ].filter(Boolean).join('\n'))
}

function hasBlockingProviderSafetyIssue(issues: ProviderSafetyIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'high')
}

function reviewProviderDiffs(
  item: AtlasMemoryReviewQueueItem,
  detail: ReviewDetailState | undefined,
  preview: { title: string | null; body: string | null; summary: string | null },
): ProviderReviewDiff[] {
  if (item.kind === 'memory_privacy') {
    return buildProviderReviewDiff([
      {
        key: 'title',
        label: 'Título',
        current: detail?.memory?.title ?? item.title ?? null,
        proposed: preview.title,
      },
      {
        key: 'summary',
        label: 'Resumo',
        current: detail?.memory?.summary ?? item.summary ?? null,
        proposed: preview.summary,
      },
      {
        key: 'body',
        label: 'Body',
        current: detail?.memory?.body ?? null,
        proposed: preview.body,
      },
    ])
  }

  if (item.kind === 'verbatim_privacy') {
    return buildProviderReviewDiff([
      {
        key: 'summary',
        label: 'Resumo',
        current: detail?.verbatim?.summary ?? item.summary ?? null,
        proposed: preview.summary,
      },
      {
        key: 'redacted_text',
        label: 'Texto',
        current: detail?.verbatim?.redacted_text ?? null,
        proposed: preview.body,
      },
    ])
  }

  return []
}

function NoteCard({ note }: { note: AtlasSemanticNote }) {
  const c = usePalette()
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.cardInner}>
        <View style={styles.noteMeta}>
          <Mono size={10} color={c.bronze} letterSpacing={0.8} style={{ textTransform: 'uppercase' }}>
            {note.type} · {note.status}
          </Mono>
          {note.score != null ? <Mono size={10} color={c.ink2}>{Math.round(note.score * 100)}%</Mono> : null}
        </View>
        <Sans weight="sb" size={16} lineHeight={21} color={c.ink} style={{ marginTop: 6 }}>
          {note.title}
        </Sans>
        <Sans size={13} lineHeight={19} color={c.ink2} style={{ marginTop: 8 }}>
          {note.summary ?? note.body_excerpt ?? note.path}
        </Sans>
        <Mono size={10.5} lineHeight={16} color={c.ink2} style={{ marginTop: 10 }}>
          {note.path}
        </Mono>
        {(note.source_links_count || note.target_links_count) ? (
          <Mono size={10.5} lineHeight={16} color={c.ink2} style={{ marginTop: 8 }}>
            Links sugeridos: {(note.source_links_count ?? 0) + (note.target_links_count ?? 0)}
          </Mono>
        ) : null}
      </View>
    </View>
  )
}

function SmallAction({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  danger?: boolean
}) {
  const c = usePalette()
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallAction,
        {
          backgroundColor: pressed ? c.premium : 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Sans weight="sb" size={13} color={danger ? c.recRed : c.prussian} align="center">
        {label}
      </Sans>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  topBar: {
    marginBottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 14,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  actionButton: {
    flex: 1,
  },
  filterPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    overflow: 'hidden',
  },
  filterBlock: {
    paddingHorizontal: 14,
    paddingTop: 14,
    gap: 8,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  filterToggle: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterInputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  filterInputWrap: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: '47%',
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 4,
  },
  filterInput: {
    minHeight: 34,
    paddingVertical: 4,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  filterActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  reviewSummary: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 3,
  },
  reviewNavigator: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  reviewNavigatorText: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewNavigatorActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  batchToolbar: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  batchToolbarText: {
    padding: 14,
    gap: 4,
  },
  batchActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  panel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 16,
  },
  cardActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  reviewEditor: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  reviewTextAreaWrap: {
    gap: 6,
  },
  reviewTextArea: {
    minHeight: 72,
    maxHeight: 160,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  reviewTextAreaTall: {
    minHeight: 118,
  },
  providerPreview: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
  },
  providerTargetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  providerTargetChip: {
    minHeight: 32,
    minWidth: 72,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  providerDiff: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  providerDiffRow: {
    gap: 6,
  },
  providerDiffCode: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 1,
  },
  providerDiffLine: {
    minHeight: 15,
  },
  providerDiffToggle: {
    minHeight: 30,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  providerAuditList: {
    marginTop: 12,
    gap: 2,
  },
  providerAuditFilters: {
    marginTop: 12,
    gap: 8,
  },
  providerAuditChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerAuditChip: {
    minHeight: 30,
    minWidth: 68,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  providerAuditRow: {
    paddingVertical: 10,
    gap: 7,
  },
  providerSafety: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 6,
  },
  smallAction: {
    flexGrow: 1,
    minWidth: '33.33%',
    paddingVertical: 13,
    paddingHorizontal: 6,
  },
  proposalTemplate: {
    marginTop: 12,
    gap: 8,
  },
  templateRow: {
    gap: 3,
  },
  auditLine: {
    marginTop: 10,
    gap: 3,
  },
  auditFacts: {
    marginTop: 12,
    gap: 8,
  },
  metricRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  loadingRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recommendations: {
    borderLeftWidth: 2,
    paddingLeft: 14,
    marginTop: 12,
    gap: 8,
  },
  searchBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 16,
    fontFamily: fonts.mono,
    fontSize: 14,
  },
  searchButton: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
})
