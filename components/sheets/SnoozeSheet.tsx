import { useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { BottomSheet } from './BottomSheet'
import { Frau, Mono } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'
import { buildSnoozeOptions, type SnoozeOption } from '../../lib/snoozeOptions'

// =============================================================================
// SnoozeSheet · canon mockup "Adiar para" (v18)
// =============================================================================
//
// Sub-sheet de adiamento. Acessado via "Adiar" no Triage Overflow ou no
// QuickActionBar do Detail. 3 option-rows com label italic Frau 22 + leader
// dotted + meta calculada PT-BR ("qua, 09.05") + chevron `›`.
//
// Vocabulário canon: cada opção é um "ato de adiamento", não config de
// notificação. Sheet pequeno (340h) — escolha rápida, sem ritual longo.
//
// Props via overlay context · `useOverlays` carrega o callback
// (`onSnooze: (option) => void`).
// =============================================================================

export function SnoozeSheet() {
  const open = useOverlays((s) => s.open)
  const cb = useOverlays((s) => s.onSnooze)
  const close = useOverlays((s) => s.close)
  const visible = open === 'snooze'
  const options = useMemo(() => buildSnoozeOptions(new Date()), [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (opt: SnoozeOption | null) => {
    cb?.(opt)
    close()
  }

  return (
    <BottomSheet visible={visible} onClose={() => finish(null)} height={340}>
      <Body options={options} onSelect={finish} />
    </BottomSheet>
  )
}

function Body({ options, onSelect }: { options: SnoozeOption[]; onSelect: (opt: SnoozeOption) => void }) {
  const { c } = useTheme()
  return (
    <View style={styles.wrap}>
      <Mono
        size={11}
        lineHeight={14}
        letterSpacing={1.6}
        color={c.ink2}
        weight="med"
        style={styles.title}
      >
        ADIAR PARA
      </Mono>

      {options.map((opt, idx) => (
        <Pressable
          key={opt.key}
          onPress={() => onSelect(opt)}
          accessibilityRole="button"
          accessibilityLabel={`Adiar para ${opt.label} · ${opt.metaLabel}`}
          style={({ pressed }) => [
            styles.row,
            {
              borderTopColor: 'rgba(26,22,18,0.10)',
              borderBottomColor: 'rgba(26,22,18,0.10)',
              borderTopWidth: idx === 0 ? 1 : 0,
              borderBottomWidth: 1,
              opacity: pressed ? 0.55 : 1,
            },
          ]}
        >
          <Frau italic size={22} lineHeight={29} letterSpacing={-0.18} color={c.ink}>
            {opt.label}
          </Frau>
          <DotLeader />
          <Mono size={11} lineHeight={14} letterSpacing={0.4} color={c.ink2} style={styles.meta}>
            {opt.metaLabel}
          </Mono>
          <Frau size={16} lineHeight={20} color={c.ink3} style={styles.chevron}>
            ›
          </Frau>
        </Pressable>
      ))}
    </View>
  )
}

function DotLeader() {
  const { c } = useTheme()
  return (
    <View style={styles.leader}>
      <Mono
        size={11}
        lineHeight={16}
        letterSpacing={2}
        color={c.ink3}
        numberOfLines={1}
        style={styles.leaderDots}
      >
        {'·'.repeat(60)}
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 0,
    paddingBottom: 24,
  },
  title: {
    marginHorizontal: 32,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 8,
  },
  leader: {
    flex: 1,
    overflow: 'hidden',
  },
  leaderDots: {
    opacity: 0.5,
  },
  meta: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    marginLeft: 10,
    flexShrink: 0,
  },
})
