import { ScrollView, StyleSheet, View } from 'react-native'
import { Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type {
  AtlasAiCompaction,
  AtlasAiContextSnapshot,
  AtlasAiProviderHandoff,
  AtlasAiSessionState,
  AtlasAiThread,
  AtlasAiTrace,
} from '../../../lib/api/client'
import { CaptionWhisper } from '../../console/CaptionWhisper'
import { BottomSheet } from '../BottomSheet'
import {
  DataList,
  DataRow,
  DataSection,
  EmptyInline,
  SheetHeading,
} from './AtlasAiDataPrimitives'
import { providerWord } from './threadHistoryModel'

export function ContextSheet({
  visible,
  thread,
  state,
  compaction,
  handoff,
  snapshots,
  latestTrace,
  onClose,
}: {
  visible: boolean
  thread: AtlasAiThread | null
  state: AtlasAiSessionState | null
  compaction: AtlasAiCompaction | null
  handoff: AtlasAiProviderHandoff | null
  snapshots: AtlasAiContextSnapshot[]
  latestTrace: AtlasAiTrace | null
  onClose: () => void
}) {
  const { c } = useTheme()
  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading title="Contexto ativo" subtitle={thread?.title ?? 'nova conversa'} />

        <DataSection title="sessão">
          <DataRow label="objetivo" value={state?.objective || 'não definido'} />
          <DataRow label="fase" value={state?.current_phase || 'não definida'} />
          <DataRow label="tópico" value={state?.current_topic || 'não definido'} />
          <DataRow label="posição" value={state?.user_position || 'não definida'} />
        </DataSection>

        <DataSection title="estado preservado">
          <DataList label="decisões" items={state?.decisions} />
          <DataList label="abertos" items={state?.open_loops} />
          <DataList label="próximos" items={state?.next_steps} />
          <DataList label="artefatos" items={state?.relevant_artifacts} />
          <DataList label="restrições" items={state?.constraints} />
          <DataList label="qualidade" items={state?.quality_notes} />
        </DataSection>

        <DataSection title="compactação">
          <DataRow
            label="última"
            value={compaction ? `${formatRelative(compaction.created_at)} · ${compaction.quality_gate_status}` : 'sem compactação'}
          />
          {compaction?.summary && (
            <Sans size={13} lineHeight={19} color={c.ink}>
              {truncateForDisplay(compaction.summary, 700)}
            </Sans>
          )}
        </DataSection>

        <DataSection title="handoff">
          <DataRow
            label="provider"
            value={handoff ? `${providerWord(handoff.from_provider) ?? 'atlas'} → ${providerWord(handoff.to_provider) ?? handoff.to_provider}` : 'sem troca recente'}
          />
          {handoff?.brief_text && (
            <Sans size={13} lineHeight={19} color={c.ink}>
              {truncateForDisplay(handoff.brief_text, 700)}
            </Sans>
          )}
        </DataSection>

        <DataSection title="fontes usadas">
          <DataList label="refs" items={latestTrace?.context_refs} />
          <DataList label="skills" items={skillVersionLabels(latestTrace)} />
        </DataSection>

        <DataSection title="snapshots">
          {snapshots.length === 0 ? (
            <EmptyInline text="nenhum snapshot de contexto carregado" />
          ) : snapshots.slice(0, 8).map((snapshot) => (
            <View key={snapshot.id} style={[styles.executionRow, { borderTopColor: c.border }]}>
              <View style={styles.rowSplit}>
                <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                  {providerWord(snapshot.provider) ?? snapshot.provider ?? 'atlas'}
                </Sans>
                <Sans size={11} lineHeight={15} color={c.ink2}>
                  {snapshot.token_estimate != null ? `${snapshot.token_estimate} tokens` : 'sem tokens'}
                </Sans>
              </View>
              <CaptionWhisper text={`${formatRelative(snapshot.created_at)} · ${shortId(snapshot.id)}`} />
              <DataList label="mensagens" items={snapshot.messages_included} />
              <DataList label="contexto" items={snapshotContextLabels(snapshot)} />
            </View>
          ))}
        </DataSection>
      </ScrollView>
    </BottomSheet>
  )
}

function skillVersionLabels(trace: AtlasAiTrace | null): string[] {
  if (!trace) return []
  return Object.entries(trace.skill_versions ?? {}).map(([slug, data]) => {
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>
      const version = typeof record.version === 'string' ? record.version : null
      const hash = typeof record.hash === 'string' ? shortId(record.hash) : null
      return [slug, version, hash].filter(Boolean).join(' · ')
    }
    return slug
  })
}

function snapshotContextLabels(snapshot: AtlasAiContextSnapshot): string[] {
  const pack = snapshot.context_pack ?? {}
  const labels: string[] = []

  for (const key of ['conversation', 'semantic', 'task_request', 'execution_plan', 'session_state']) {
    const value = pack[key]
    if (value !== undefined) labels.push(`${key}: ${compactUnknown(value)}`)
  }

  return labels
}

function compactUnknown(value: unknown): string {
  if (typeof value === 'string') return truncateForDisplay(value, 160)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `${value.length} itens`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).slice(0, 5)
    return keys.length ? keys.join(', ') : 'objeto'
  }
  return 'n/a'
}

function truncateForDisplay(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`
}

function formatRelative(value: string | null | undefined): string {
  if (!value) return 'agora'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.round(hours / 24)
  return `${days} d`
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
  },
  executionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 7,
  },
  rowSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
})
