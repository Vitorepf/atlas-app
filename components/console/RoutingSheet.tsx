import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { BottomSheet } from '../sheets/BottomSheet'
import { Frau, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { BronzeDiamond } from './BronzeDiamond'
import {
  ROUTING_DEFAULT,
  type RoutingDomain,
  type RoutingExecutor,
  type RoutingStyle,
  type RoutingState,
  type RoutingTask,
} from './StatusRouting'

interface Props {
  visible: boolean
  initial: RoutingState
  onClose: () => void
  onConfirm: (next: RoutingState) => void
}

const TASKS: Array<{ key: RoutingTask; label: string }> = [
  { key: 'direct', label: 'Responder' },
  { key: 'plan',   label: 'Planejar' },
  { key: 'review', label: 'Revisar' },
  { key: 'dev',    label: 'Dev' },
  { key: 'debug',  label: 'Debug' },
]

const DOMAINS: Array<{ key: RoutingDomain; label: string }> = [
  { key: 'auto',          label: 'Auto' },
  { key: 'vault-curador', label: 'Vault' },
  { key: 'saude',         label: 'Saúde' },
  { key: 'blackink',      label: 'BlackInk' },
  { key: 'financas',      label: 'Finanças' },
]

const EXECUTORS: Array<{ key: RoutingExecutor; label: string; gloss?: string }> = [
  { key: 'auto',         label: 'Atlas decide' },
  { key: 'claude_cli',   label: 'Claude',   gloss: 'síntese e conversa' },
  { key: 'codex_cli',    label: 'Codex',    gloss: 'engenharia e estrutura' },
  { key: 'claude_codex', label: 'Conselho', gloss: 'múltiplas vozes' },
]

const STYLES: Array<{ key: RoutingStyle; label: string; gloss?: string }> = [
  { key: 'clear',     label: 'Claro',   gloss: 'simples, sem código por padrão' },
  { key: 'brief',     label: 'Curto',   gloss: 'mínimo útil' },
  { key: 'technical', label: 'Técnico', gloss: 'com detalhes quando precisar' },
  { key: 'complete',  label: 'Completo', gloss: 'mais contexto e critérios' },
]

// Editorial override sheet. Replaces the rows of inline chips. Each dimension
// is a labelled section in lowercase Fraunces italic; options are pill-shaped
// chips with prussian fill on the active one. Selecting is not a commit —
// the operator confirms or cancels at the bottom. Pause is the point.
export function RoutingSheet({ visible, initial, onClose, onConfirm }: Props) {
  const c = usePalette()
  const [draft, setDraft] = useState<RoutingState>(initial)

  useEffect(() => {
    if (visible) setDraft(initial)
  }, [visible, initial])

  const dirty = !sameRouting(draft, initial)

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.diamondRow}>
          <BronzeDiamond size={18} />
        </View>

        <Frau size={26} lineHeight={32} align="center" color={c.ink} style={styles.heading}>
          Como Atlas deve responder?
        </Frau>

        <View style={[styles.headingRule, { backgroundColor: c.border }]} />

        <Section label="tarefa">
          <ChipRow>
            {TASKS.map((option) => (
              <ChoiceChip
                key={option.key}
                label={option.label}
                active={draft.task === option.key}
                onPress={() => setDraft((d) => ({ ...d, task: option.key }))}
              />
            ))}
          </ChipRow>
        </Section>

        <Section label="domínio">
          <ChipRow>
            {DOMAINS.map((option) => (
              <ChoiceChip
                key={option.key}
                label={option.label}
                active={draft.domain === option.key}
                onPress={() => setDraft((d) => ({ ...d, domain: option.key }))}
              />
            ))}
          </ChipRow>
        </Section>

        <Section label="executor">
          <View style={styles.executorList}>
            {EXECUTORS.map((option) => (
              <ExecutorRow
                key={option.key}
                label={option.label}
                gloss={option.gloss}
                active={draft.executor === option.key}
                onPress={() => setDraft((d) => ({ ...d, executor: option.key }))}
              />
            ))}
          </View>
        </Section>

        <Section label="forma">
          <View style={styles.executorList}>
            {STYLES.map((option) => (
              <ExecutorRow
                key={option.key}
                label={option.label}
                gloss={option.gloss}
                active={draft.style === option.key}
                onPress={() => setDraft((d) => ({ ...d, style: option.key }))}
              />
            ))}
          </View>
        </Section>

        <View style={[styles.footerRule, { backgroundColor: c.border }]} />

        <View style={styles.actions}>
          <FooterAction label="cancelar" onPress={onClose} tone="muted" />
          <FooterAction
            label="confirmar"
            tone={dirty ? 'primary' : 'muted'}
            onPress={() => {
              onConfirm(draft)
              onClose()
            }}
            disabled={!dirty}
          />
        </View>

        <Pressable onPress={() => setDraft(ROUTING_DEFAULT)} hitSlop={8} style={styles.resetRow}>
          <Frau italic size={12} lineHeight={16} color={c.ink} style={{ opacity: 0.45 }}>
            voltar a “atlas decide”
          </Frau>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  const c = usePalette()
  return (
    <View style={styles.section}>
      <Frau italic size={15} lineHeight={20} color={c.ink} style={{ opacity: 0.6 }}>
        {label}
      </Frau>
      <View style={[styles.sectionRule, { backgroundColor: c.border }]} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>
}

function ChoiceChip({
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
        styles.chip,
        {
          backgroundColor: active ? c.prussian : 'transparent',
          borderColor:     active ? c.prussian : c.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Sans weight="med" size={14} color={active ? c.bg : c.ink}>
        {label}
      </Sans>
    </Pressable>
  )
}

function ExecutorRow({
  label,
  gloss,
  active,
  onPress,
}: {
  label: string
  gloss?: string
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.executorRow,
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.executorMarker}>
        {active && <BronzeDiamond size={12} />}
      </View>
      <View style={styles.executorBody}>
        <Frau size={18} lineHeight={24} color={c.ink}>
          {label}
        </Frau>
        {gloss && (
          <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: 0.45, marginTop: 2 }}>
            — {gloss}
          </Frau>
        )}
      </View>
    </Pressable>
  )
}

function FooterAction({
  label,
  onPress,
  tone,
  disabled,
}: {
  label: string
  onPress: () => void
  tone: 'primary' | 'muted'
  disabled?: boolean
}) {
  const c = usePalette()
  const color = tone === 'primary' ? c.prussian : c.ink2
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1, paddingVertical: 8, paddingHorizontal: 14 })}
    >
      <Frau italic size={16} color={color}>
        {label}
      </Frau>
    </Pressable>
  )
}

function sameRouting(a: RoutingState, b: RoutingState): boolean {
  return a.task === b.task
    && a.domain === b.domain
    && a.executor === b.executor
    && a.style === b.style
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 32,
  },
  diamondRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  heading: {
    paddingHorizontal: 12,
  },
  headingRule: {
    width: 32,
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 28,
  },
  section: {
    marginBottom: 28,
  },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  sectionBody: {
    marginTop: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  executorList: {
    gap: 16,
  },
  executorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  executorMarker: {
    width: 24,
    paddingTop: 6,
  },
  executorBody: {
    flex: 1,
  },
  footerRule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resetRow: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
})
