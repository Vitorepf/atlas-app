import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomSheet } from '../BottomSheet'
import { Frau, Mono, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import { snoozeDateLabel, type TriageAction } from './detailHelpers'

// QuickActionBar · v7 mockup · 5 ações editoriais fixas no rodapé do sheet.
// Frau italic 14pt · hairlines verticais · arquivar em recRed (destrutivo).
// Cada ação é um Pressable com flex:1 · respiração igual entre verbos.
// + ícone ••• discreto à direita pra acessar o overflow (Anexar/Hipótese/Edit/Move/Excluir).
//
// Princípio: usuário pica destino direto sem rolar tudo · Atlas é foco e performance.
// Pós-triagem (hasDestination=true), Promover vira o label do destino ("Abrir nota viva")
// e os outros 4 ficam disabled · estado consistente, ação retroativa explícita.
export function QuickActionBar({
  hasDestination,
  destinationLabel,
  triaging,
  disabled,
  promoteReady,
  onPromote,
  onTask,
  onProject,
  onSnooze,
  onArchive,
}: {
  hasDestination: boolean
  destinationLabel: string | null
  triaging: TriageAction | null
  disabled: boolean
  promoteReady: boolean
  onPromote: () => void
  onTask: () => void
  onProject: () => void
  onSnooze: () => void
  onArchive: () => void
}) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const promoteLabel = hasDestination
    ? (destinationLabel ?? 'Abrir')
    : (triaging === 'promote' ? 'promovendo…' : 'promover')
  const archiveLabel = triaging === 'archive' ? 'arquivando…' : 'arquivar'
  return (
    <View
      style={[
        actionBarStyles.bar,
        {
          backgroundColor: c.bg,
          borderTopColor: c.border,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <QuickAction
        label={promoteLabel}
        onPress={onPromote}
        disabled={disabled || (!hasDestination && !promoteReady)}
        divider
      />
      <QuickAction
        label="tarefa"
        onPress={onTask}
        disabled={disabled || hasDestination}
        divider
      />
      <QuickAction
        label="projeto"
        onPress={onProject}
        disabled={disabled || hasDestination}
        divider
      />
      <QuickAction
        label="adiar"
        onPress={onSnooze}
        disabled={disabled || hasDestination}
        divider
      />
      <QuickAction
        label={archiveLabel}
        onPress={onArchive}
        disabled={disabled}
        danger
      />
    </View>
  )
}

function QuickAction({
  label,
  onPress,
  disabled,
  divider,
  danger,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  divider?: boolean
  danger?: boolean
}) {
  const { c } = useTheme()
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        actionBarStyles.action,
        divider && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border },
        {
          opacity: disabled ? 0.32 : pressed ? 0.55 : 1,
        },
      ]}
    >
      <Frau
        italic
        size={14}
        lineHeight={18}
        color={danger ? c.recRed : c.ink}
        numberOfLines={1}
      >
        {label}
      </Frau>
    </Pressable>
  )
}

const actionBarStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 0,
    minHeight: 56,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 4,
  },
})

type OverflowAction =
  | 'snooze'
  | 'attach_note'
  | 'create_task'
  | 'create_project'
  | 'create_hypothesis'
  | 'edit'
  | 'move'
  | 'delete'

// BottomSheet com ações secundárias agrupadas por intenção · 3 grupos:
// (1) Triagem complementar · (2) Edição · (3) Destrutivo (Excluir, vermelho discreto).
// HIG: destructive at end + .destructive role; aqui = recRed text + hairline isolada.
export function TriageOverflowSheet({
  visible,
  onClose,
  onAction,
  triaging,
  disabled,
  hasDestination,
}: {
  visible: boolean
  onClose: () => void
  onAction: (act: OverflowAction) => void
  triaging: TriageAction | null
  disabled: boolean
  hasDestination: boolean
}) {
  const { c } = useTheme()
  // Sheet 75% · 8 OverflowRows + 2 dividers + 2 group labels não cabem em 520.
  // ScrollView interno garante que se vier mais ação no futuro nada quebra.
  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView
        style={overflowStyles.scroll}
        contentContainerStyle={overflowStyles.wrap}
        showsVerticalScrollIndicator={false}
      >
        <Frau italic size={13} lineHeight={18} color={c.ink2} style={overflowStyles.groupLabel}>
          Triagem
        </Frau>
        <OverflowRow
          label="Adiar"
          subtitle="dormir e voltar amanhã, semana, mês"
          disabled={disabled}
          onPress={() => onAction('snooze')}
        />
        <OverflowRow
          label="Anexar a uma nota"
          subtitle="virar bloco em nota viva existente"
          disabled={disabled}
          onPress={() => onAction('attach_note')}
        />
        <OverflowRow
          label="Criar tarefa"
          subtitle="vira ação no projeto"
          disabled={disabled}
          onPress={() => onAction('create_task')}
        />
        <OverflowRow
          label="Criar projeto"
          subtitle="vira projeto novo no atlas"
          disabled={disabled}
          onPress={() => onAction('create_project')}
        />
        <OverflowRow
          label={triaging === 'create_hypothesis' ? 'Criando hipótese…' : 'Criar hipótese'}
          subtitle="vira hipótese no laboratório"
          disabled={disabled || triaging === 'create_hypothesis'}
          onPress={() => onAction('create_hypothesis')}
        />

        <View style={[overflowStyles.divider, { backgroundColor: c.border }]} />

        <Frau italic size={13} lineHeight={18} color={c.ink2} style={overflowStyles.groupLabel}>
          Registro
        </Frau>
        <OverflowRow
          label="Editar texto"
          subtitle="ajustar transcrição ou conteúdo"
          onPress={() => onAction('edit')}
        />
        <OverflowRow
          label="Mover de domínio"
          subtitle={hasDestination ? 'já triada · pode reatribuir' : 'reatribuir antes da triagem'}
          onPress={() => onAction('move')}
        />

        <View style={[overflowStyles.divider, { backgroundColor: c.border }]} />

        <OverflowRow
          label="Excluir captura"
          subtitle="apaga em definitivo · não há undo"
          danger
          onPress={() => onAction('delete')}
        />
      </ScrollView>
    </BottomSheet>
  )
}

// SnoozeSheet · v8 Frente 5 mockup · "ADIAR PARA" + 3 rows editoriais.
// Cada row: Frau italic label (esq) + Mono date (dir) + chevron sutil.
// Datas calculadas dinamicamente via daysFromNow + abreviação PT-BR.
export function SnoozeSheet({
  visible,
  onClose,
  onSelect,
  disabled,
}: {
  visible: boolean
  onClose: () => void
  onSelect: (days: number, reason: string) => void
  disabled: boolean
}) {
  const { c } = useTheme()
  const options: Array<{ days: number; label: string; reason: string }> = [
    { days: 1, label: 'amanhã', reason: 'Adiada para revisão amanhã' },
    { days: 7, label: '7 dias', reason: 'Adiada por uma semana' },
    { days: 30, label: '30 dias', reason: 'Adiada por trinta dias' },
  ]
  return (
    <BottomSheet visible={visible} onClose={onClose} height={340}>
      <View style={snoozeStyles.wrap}>
        <Sans
          weight="med"
          size={11}
          letterSpacing={1.4}
          color={c.ink2}
          style={[snoozeStyles.title, { color: c.ink2 }]}
        >
          ADIAR PARA
        </Sans>
        <View style={[snoozeStyles.divider, { backgroundColor: c.border }]} />
        {options.map((opt, idx) => (
          <View key={opt.days}>
            <Pressable
              onPress={() => onSelect(opt.days, opt.reason)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`adiar para ${opt.label}`}
              style={({ pressed }) => [
                snoozeStyles.row,
                { opacity: disabled ? 0.4 : pressed ? 0.55 : 1 },
              ]}
            >
              <Frau italic size={20} lineHeight={26} letterSpacing={-0.1} color={c.ink}>
                {opt.label}
              </Frau>
              <View style={snoozeStyles.rowRight}>
                <Mono size={12} letterSpacing={0.4} color={c.ink2}>
                  {snoozeDateLabel(opt.days)}
                </Mono>
                <Frau size={14} lineHeight={18} color={c.ink3} style={{ marginLeft: 8 }}>
                  ›
                </Frau>
              </View>
            </Pressable>
            {idx < options.length - 1 && (
              <View style={[snoozeStyles.divider, { backgroundColor: c.border }]} />
            )}
          </View>
        ))}
      </View>
    </BottomSheet>
  )
}

const snoozeStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 28,
    paddingTop: 4,
    paddingBottom: 32,
  },
  title: {
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
})

function OverflowRow({
  label,
  subtitle,
  danger,
  disabled,
  onPress,
}: {
  label: string
  subtitle?: string
  danger?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        overflowStyles.row,
        {
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Frau
        size={17}
        lineHeight={22}
        letterSpacing={-0.07}
        color={danger ? c.recRed : c.ink}
      >
        {label}
      </Frau>
      {subtitle && (
        <Frau italic size={12.5} lineHeight={17} color={c.ink2} style={{ marginTop: 1 }}>
          {subtitle}
        </Frau>
      )}
    </Pressable>
  )
}

const overflowStyles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  wrap: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
  },
  groupLabel: {
    marginTop: 14,
    marginBottom: 4,
    letterSpacing: 0.24,
    textTransform: 'lowercase',
  },
  row: {
    paddingVertical: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
})
