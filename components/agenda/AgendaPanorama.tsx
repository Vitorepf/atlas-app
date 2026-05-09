import { StyleSheet, View } from 'react-native'
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
// Substitui dashboards SaaS coloridos por tabela editorial mono caps.
// Cada row é um "indicador" da mesa de instrumentos do salão (vocabulário
// Continuity Panel canon).
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
        <View
          key={row.label}
          style={[
            styles.row,
            idx === 0
              ? { borderTopWidth: 1, borderTopColor: 'rgba(26,22,18,0.06)' }
              : null,
            { borderBottomColor: 'rgba(26,22,18,0.06)' },
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
        </View>
      ))}
    </View>
  )
}

function DotLeader() {
  const c = usePalette()
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
    marginHorizontal: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  label: {
    flexShrink: 0,
  },
  leader: {
    flex: 1,
    overflow: 'hidden',
  },
  leaderDots: {
    opacity: 0.45,
  },
  value: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
})
