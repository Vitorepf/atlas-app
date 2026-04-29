import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { SectionHeader } from '../components/SectionHeader'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import {
  formatRelativeSync,
  useAtlasStore,
  visibleBehaviorLogs,
  visibleBehaviors,
} from '../lib/atlasStore'
import type { AtlasBehavior, BehaviorCategory } from '../lib/api/client'
import { useShell } from '../components/AtlasShell'

const CATEGORIES: Array<{ key: BehaviorCategory; label: string }> = [
  { key: 'bebida', label: 'Bebida' },
  { key: 'alimentacao', label: 'Alimentação' },
  { key: 'treino', label: 'Treino' },
  { key: 'sono', label: 'Sono' },
  { key: 'trabalho', label: 'Trabalho' },
  { key: 'conflito', label: 'Conflito' },
  { key: 'suplemento', label: 'Suplemento' },
  { key: 'social', label: 'Social' },
  { key: 'outro', label: 'Outro' },
]

export default function BitaculaScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const behaviors = useAtlasStore((s) => s.behaviors)
  const queuedBehaviors = useAtlasStore((s) => s.queuedBehaviors)
  const behaviorLogs = useAtlasStore((s) => s.behaviorLogs)
  const queuedBehaviorLogs = useAtlasStore((s) => s.queuedBehaviorLogs)
  const createBehavior = useAtlasStore((s) => s.createBehavior)
  const lastSyncAt = useAtlasStore((s) => s.lastSyncAt)
  const syncing = useAtlasStore((s) => s.syncing)
  const sync = useAtlasStore((s) => s.sync)

  const allBehaviors = useMemo(
    () => visibleBehaviors({ behaviors, queuedBehaviors }),
    [behaviors, queuedBehaviors],
  )
  const allLogs = useMemo(
    () => visibleBehaviorLogs({ behaviorLogs, queuedBehaviorLogs }),
    [behaviorLogs, queuedBehaviorLogs],
  )
  const activeBehaviors = useMemo(
    () => allBehaviors.filter((behavior) => !behavior.archived_at && behavior.show_in_morning_briefing),
    [allBehaviors],
  )

  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [category, setCategory] = useState<BehaviorCategory>('outro')
  const [relationalPrivacy, setRelationalPrivacy] = useState(false)
  const [saving, setSaving] = useState(false)
  const canCreate = name.trim().length > 0 && activeBehaviors.length < 12 && !saving

  const saveBehavior = async () => {
    if (!canCreate) return

    setSaving(true)
    try {
      await createBehavior({
        name,
        category,
        questionText: question,
        relationalPrivacy,
        metadata: { entrypoint: 'bitacula_screen' },
      })
      setName('')
      setQuestion('')
      setCategory('outro')
      setRelationalPrivacy(false)
      showToast('Comportamento adicionado à Bitácula', { variant: 'checkin' })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao criar comportamento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <BackArrow color={c.ink2} />
        </Pressable>
        <Mono size={11} letterSpacing={0.44} color={c.ink2}>
          Sync · {formatRelativeSync(lastSyncAt)}
        </Mono>
      </View>

      <View style={styles.header}>
        <Label>Bitácula</Label>
        <Frau size={42} lineHeight={44} letterSpacing={-1.05} color={c.ink} style={{ marginTop: 8 }}>
          Caderno de bordo
        </Frau>
        <Mono size={12} letterSpacing={0.24} color={c.ink2} style={{ marginTop: 8 }}>
          {activeBehaviors.length}/12 ativos · {allLogs.length} registros
        </Mono>
      </View>

      <SectionHeader label="Novo comportamento" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ex.: café após 14h"
          placeholderTextColor={c.ink3}
          autoCapitalize="sentences"
          autoCorrect={false}
          selectionColor={c.prussian}
          style={[styles.input, { color: c.ink, borderBottomColor: c.border }]}
        />
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Pergunta opcional para o briefing"
          placeholderTextColor={c.ink3}
          autoCapitalize="sentences"
          selectionColor={c.prussian}
          style={[styles.input, { color: c.ink, borderBottomColor: c.border }]}
        />

        <Label style={{ marginTop: 16 }}>Categoria</Label>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((item) => (
            <CategoryPill
              key={item.key}
              label={item.label}
              active={category === item.key}
              onPress={() => setCategory(item.key)}
            />
          ))}
        </View>

        <View style={[styles.privacyRow, { borderTopColor: c.border }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Sans weight="med" size={15} color={c.ink}>
              Privacidade relacional
            </Sans>
            <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 2 }}>
              Use quando envolve outra pessoa. Atlas correlaciona só com a sua fisiologia.
            </Sans>
          </View>
          <Switch
            value={relationalPrivacy}
            onValueChange={setRelationalPrivacy}
            trackColor={{ false: c.border, true: c.prussian }}
            thumbColor={c.bg}
          />
        </View>

        <Pressable
          onPress={() => {
            void saveBehavior()
          }}
          disabled={!canCreate}
          style={({ pressed }) => [
            styles.createButton,
            {
              backgroundColor: canCreate ? c.ink : 'transparent',
              borderColor: canCreate ? c.ink : c.border,
              opacity: pressed ? 0.9 : canCreate ? 1 : 0.55,
            },
          ]}
        >
          <Sans weight="sb" size={14} color={canCreate ? c.bg : c.ink2} align="center">
            {activeBehaviors.length >= 12 ? 'Arquive um ativo antes de adicionar' : saving ? 'Salvando…' : 'Adicionar à Bitácula'}
          </Sans>
        </Pressable>
      </View>

      <SectionHeader label="Ativos no briefing" />
      <View style={[styles.listPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {activeBehaviors.length === 0 ? (
          <EmptyRow />
        ) : activeBehaviors.map((behavior, index) => (
          <BehaviorRow
            key={behavior.client_id}
            behavior={behavior}
            last={index === activeBehaviors.length - 1}
            logs={allLogs}
          />
        ))}
      </View>

      <View style={{ height: 18 }} />
      <Pressable
        onPress={() => {
          void sync()
        }}
        disabled={syncing}
        style={({ pressed }) => [
          styles.syncButton,
          { borderColor: c.prussian, backgroundColor: pressed ? c.surface : 'transparent', opacity: syncing ? 0.55 : 1 },
        ]}
      >
        <Sans weight="sb" size={15} color={c.prussian} align="center">
          {syncing ? 'Sincronizando…' : 'Atualizar servidor'}
        </Sans>
      </Pressable>
    </Screen>
  )
}

function CategoryPill({
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
        styles.categoryPill,
        {
          backgroundColor: active ? c.prussian : 'transparent',
          borderColor: active ? c.prussian : c.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Sans weight="med" size={12} color={active ? c.bg : c.ink2}>
        {label}
      </Sans>
    </Pressable>
  )
}

function BehaviorRow({
  behavior,
  logs,
  last,
}: {
  behavior: AtlasBehavior
  logs: ReturnType<typeof visibleBehaviorLogs>
  last?: boolean
}) {
  const c = usePalette()
  const behaviorLogs = logs.filter((log) => log.behavior_client_id === behavior.client_id && !log.reverted_at)
  const latestLog = behaviorLogs[0]
  const yesCount = behavior.total_yes_count + behaviorLogs.filter((log) => log.value === 'yes').length

  return (
    <View style={[styles.behaviorRow, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={16} color={c.ink}>
          {behavior.name}{behavior.relational_privacy ? ' · privado' : ''}
        </Sans>
        <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 2 }}>
          {behavior.question_text}
        </Sans>
      </View>
      <View style={styles.rowMeta}>
        <Mono size={12} letterSpacing={0.24} color={c.ink}>
          {yesCount} sim
        </Mono>
        <Mono size={10.5} letterSpacing={0.21} color={c.ink2}>
          {latestLog ? latestLog.log_date.slice(5).replace('-', '/') : 'sem log'}
        </Mono>
      </View>
    </View>
  )
}

function EmptyRow() {
  const c = usePalette()
  return (
    <View style={styles.emptyRow}>
      <Sans size={14} lineHeight={20} color={c.ink2}>
        Nenhum comportamento ativo ainda. Adicione algo factual, pequeno e rastreável.
      </Sans>
    </View>
  )
}

function BackArrow({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 18, transform: [{ rotate: '45deg' }] }}>
      <View style={{ position: 'absolute', left: 2, top: 2, width: 13, height: 3, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ position: 'absolute', left: 2, top: 2, width: 3, height: 13, backgroundColor: color, borderRadius: 2 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { marginBottom: 8 },
  panel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  input: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  categoryPill: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
    paddingTop: 14,
  },
  createButton: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  listPanel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  behaviorRow: {
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  emptyRow: {
    padding: 16,
  },
  syncButton: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
})
