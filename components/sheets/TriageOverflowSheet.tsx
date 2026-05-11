import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { BottomSheet } from './BottomSheet'
import { Frau } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'

// =============================================================================
// TriageOverflowSheet · canon mockup (v18 · sub-sheet do DetailSheet)
// =============================================================================
//
// Acessado via tap em ⋯ no header do DetailSheet de capturas. Menu editorial
// vertical com 8 ações em 3 grupos (HIG: destructive at end).
//
//   Triagem (5):
//     - snooze            · "Adiar"               · dormir e voltar amanhã/semana/mês
//     - attach_note       · "Anexar a uma nota"    · virar bloco em nota viva existente
//     - create_task       · "Criar tarefa"         · vira ação no projeto
//     - create_project    · "Criar projeto"        · vira projeto novo no atlas
//     - create_hypothesis · "Criar hipótese"       · vira hipótese no laboratório
//   Registro (2):
//     - edit              · "Editar texto"         · ajustar transcrição ou conteúdo
//     - move              · "Mover de domínio"     · reatribuir antes da triagem
//   Destrutivo (1):
//     - delete            · "Excluir captura"      · apaga em definitivo · não há undo
//
// Vocabulário canon:
//   - label: Frau medium upright 22 (peso de "ato editorial")
//   - subtitle: Frau italic 14 ink2 (sussurro explicativo)
//   - group label: Frau italic 13 ink2 (etiqueta de grupo)
//   - hairlines horizontais 12% ink separando grupos
//   - destrutivo no final em rec-red (HIG conformante)
// =============================================================================

export type OverflowAction =
  | 'snooze'
  | 'attach_note'
  | 'create_task'
  | 'create_project'
  | 'create_hypothesis'
  | 'edit'
  | 'move'
  | 'delete'

interface RowSpec {
  action: OverflowAction
  label: string
  subtitle: string
  destructive?: boolean
}

const TRIAGE_ROWS: RowSpec[] = [
  { action: 'snooze',            label: 'Adiar',              subtitle: 'dormir e voltar amanhã, semana, mês' },
  { action: 'attach_note',       label: 'Anexar a uma nota',  subtitle: 'virar bloco em nota viva existente' },
  { action: 'create_task',       label: 'Criar tarefa',       subtitle: 'vira ação no projeto' },
  { action: 'create_project',    label: 'Criar projeto',      subtitle: 'vira projeto novo no atlas' },
  { action: 'create_hypothesis', label: 'Criar hipótese',     subtitle: 'vira hipótese no laboratório' },
]

const RECORD_ROWS: RowSpec[] = [
  { action: 'edit', label: 'Editar texto',     subtitle: 'ajustar transcrição ou conteúdo' },
  { action: 'move', label: 'Mover de domínio', subtitle: 'reatribuir antes da triagem' },
]

const DESTRUCTIVE_ROW: RowSpec = {
  action: 'delete',
  label: 'Excluir captura',
  subtitle: 'apaga em definitivo · não há undo',
  destructive: true,
}

export function TriageOverflowSheet() {
  const open = useOverlays((s) => s.open)
  const cb = useOverlays((s) => s.onTriageOverflow)
  const close = useOverlays((s) => s.close)
  const visible = open === 'triageOverflow'

  const finish = (action: OverflowAction | null) => {
    cb?.(action)
    close()
  }

  return (
    <BottomSheet visible={visible} onClose={() => finish(null)} height="85%">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Group label="triagem" rows={TRIAGE_ROWS} onSelect={finish} />
        <Divider />
        <Group label="registro" rows={RECORD_ROWS} onSelect={finish} />
        <Divider />
        <Row row={DESTRUCTIVE_ROW} onSelect={finish} />
      </ScrollView>
    </BottomSheet>
  )
}

function Group({
  label,
  rows,
  onSelect,
}: {
  label: string
  rows: RowSpec[]
  onSelect: (action: OverflowAction) => void
}) {
  const { c } = useTheme()
  return (
    <View>
      <Frau italic size={13} lineHeight={18} color={c.ink2} style={styles.groupLabel}>
        {label}
      </Frau>
      {rows.map((row) => (
        <Row key={row.action} row={row} onSelect={onSelect} />
      ))}
    </View>
  )
}

function Row({ row, onSelect }: { row: RowSpec; onSelect: (action: OverflowAction) => void }) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={() => onSelect(row.action)}
      accessibilityRole="button"
      accessibilityLabel={row.label}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed ? 0.55 : 1 },
      ]}
    >
      <Frau
        weight="med"
        size={22}
        lineHeight={29}
        letterSpacing={-0.1}
        color={row.destructive ? c.recRed : c.ink}
        style={styles.label}
      >
        {row.label}
      </Frau>
      <Frau italic size={14} lineHeight={20} color={c.ink2}>
        {row.subtitle}
      </Frau>
    </Pressable>
  )
}

function Divider() {
  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: 'rgba(26,22,18,0.12)' },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 4,
    paddingBottom: 32,
  },
  groupLabel: {
    marginHorizontal: 32,
    marginBottom: 14,
    marginTop: 4,
  },
  row: {
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 32,
  },
  label: {
    marginBottom: 4,
  },
  divider: {
    height: 1,
    marginHorizontal: 32,
    marginTop: 14,
    marginBottom: 26,
  },
})
