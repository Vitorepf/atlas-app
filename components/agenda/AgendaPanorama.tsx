import { DotLeader } from '../atlas-ui/DotLeader'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { MonthInsights } from '../../lib/agendaInsights'

interface Props {
  insights: MonthInsights
  /** Mês corrente em formato "Maio · MMXXVI" pra header da seção. */
  monthLabel?: string
}

// Panorama do mês · seção vi. PANORAMA · métricas operacionais condensadas
// em TOC dot-leader. Vocabulário enterprise editorial:
//
//   ATOS PLANEJADOS    ............ 12
//   COMPLETADOS        ............  4
//   ABERTOS            ............  8
//   MARCOS NO HORIZONTE ...........  2
//   FERIADOS RESTANTES ............  1
//   DIAS RESTANTES     ............ 22
//
// Round agenda polish · rows entram com stagger 40ms × idx FadeInDown.
// rgba hardcoded → c.borderSoft. Accent bronze (Frau med) em values > 0
// é canon preservado.
export function AgendaPanorama({ insights }: Props) {
  const c = usePalette()
  const rows: Array<{ label: string; value: number | string; accent?: boolean }> = [
    { label: 'Atos planejados', value: insights.tasksPlanned },
    { label: 'Completados', value: insights.tasksCompleted, accent: insights.tasksCompleted > 0 },
    { label: 'Abertos', value: insights.tasksOpen },
    { label: 'Marcos no horizonte', value: insights.milestonesAhead, accent: insights.milestonesAhead > 0 },
    { label: 'Feriados restantes', value: insights.holidaysAhead },
    { label: 'Dias restantes', value: insights.daysRemaining },
  ]

  return (
    <View style={styles.wrap}>
      {rows.map((row, idx) => (
        <Animated.View
          key={row.label}
          entering={FadeInDown.duration(380).delay(40 * idx).easing(Easing.bezier(0.16, 1, 0.3, 1)).springify().damping(22).stiffness(180)}
          style={[
            styles.row,
            idx === 0
              ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft }
              : null,
            { borderBottomColor: c.borderSoft },
          ]}
        >
          <Mono
            size={11}
            lineHeight={16}
            letterSpacing={1.4}
            color={c.ink2}
            style={styles.label}
          >
            {row.label.toUpperCase()}
          </Mono>
          <DotLeader />
          <Frau
            italic={!row.accent}
            weight={row.accent ? 'med' : undefined}
            size={14}
            lineHeight={20}
            color={row.accent ? c.bronze : c.ink}
            style={styles.value}
          >
            {String(row.value)}
          </Frau>
        </Animated.View>
      ))}
    </View>
  )
}


const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    flexShrink: 0,
  },
  value: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
})
