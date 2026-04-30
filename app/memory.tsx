import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { SectionHeader } from '../components/SectionHeader'
import { PrimaryButton } from '../components/PrimaryButton'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { fonts } from '../design/tokens'
import {
  acceptSemanticCurationProposal,
  createSemanticActivations,
  dismissSemanticActivation,
  dismissSemanticCurationProposal,
  feedbackSemanticActivation,
  getTodayCognitiveGame,
  getVaultHealth,
  listSemanticActivations,
  listSemanticCurationProposals,
  listSemanticNotes,
  listSuggestionAudit,
  markSemanticActivationShown,
  reindexSemanticVault,
  searchSemanticNotes,
  startCognitiveGame,
  type AtlasAuditItem,
  type AtlasCognitiveReturn,
  type AtlasCognitiveGameRun,
  type AtlasSemanticActivation,
  type AtlasSemanticCurationProposal,
  type AtlasSemanticNote,
  type AtlasVaultHealthSnapshot,
} from '../lib/api/client'

export default function MemoryScreen() {
  const c = usePalette()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [health, setHealth] = useState<AtlasVaultHealthSnapshot | null>(null)
  const [activations, setActivations] = useState<AtlasSemanticActivation[]>([])
  const [proposals, setProposals] = useState<AtlasSemanticCurationProposal[]>([])
  const [notes, setNotes] = useState<AtlasSemanticNote[]>([])
  const [auditItems, setAuditItems] = useState<AtlasAuditItem[]>([])
  const [game, setGame] = useState<AtlasCognitiveGameRun | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [vaultHealth, activationPage, proposalPage, notePage, auditPage, todayGame] = await Promise.all([
        getVaultHealth(),
        listSemanticActivations({ limit: 8 }),
        listSemanticCurationProposals({ limit: 8 }),
        listSemanticNotes({ limit: 20 }),
        listSuggestionAudit({ limit: 8 }),
        getTodayCognitiveGame(),
      ])
      setHealth(vaultHealth)
      setActivations(activationPage.activations)
      setProposals(proposalPage.proposals)
      setNotes(notePage.notes)
      setAuditItems(auditPage.items)
      setGame(todayGame.game)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar memória semântica.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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

  return (
    <Screen>
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

      <View style={{ marginBottom: 24 }}>
        <Label>Memória semântica</Label>
        <Frau size={42} lineHeight={44} color={c.ink} style={{ marginTop: 6 }}>
          Segundo cérebro ativo
        </Frau>
        <Mono size={12} lineHeight={18} color={c.ink2} letterSpacing={0.24} style={{ marginTop: 10 }}>
          Obsidian local + PostgreSQL + ativações contextuais.
        </Mono>
      </View>

      {error ? (
        <View style={[styles.errorBox, { borderColor: c.recRed, backgroundColor: c.surface }]}>
          <Sans size={14} lineHeight={20} color={c.recRed}>
            {error}
          </Sans>
        </View>
      ) : null}

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
