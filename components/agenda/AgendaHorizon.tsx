import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { HorizonDay } from '../../lib/agenda'

interface Props {
  days: HorizonDay[]
  onSelectDay?: (day: HorizonDay) => void
}

// Horizonte 7 dias · seção iv. HORIZONTE.
//   Cada row: hr-day mono ink2 (width 64, lowercase) +
//             dot leader (mono dots · 45% opacity) +
//             hr-meta italic Frau 14 (ink2 default · bronze med se major
//                                     · ink3 italic se empty)
//
// Quando TODOS os dias estão vazios ("livre"), substitui as 7 rows por uma
// frase única editorial — vocabulário Don Corleone "semana protegida" em
// vez de repetição "livre × 7" que vira ruído. Detecta automaticamente.
//
// Cabe na cabeça pelo formato linear (canon TDAH).
export function AgendaHorizon({ days, onSelectDay }: Props) {
  const c = usePalette()
  const allEmpty = days.length > 0 && days.every((d) => d.isEmpty)

  if (allEmpty) {
    return (
      <View style={styles.wrap}>
        <View style={styles.allEmpty}>
          <Frau italic size={17} lineHeight={26} letterSpacing={-0.18} color={c.ink}>
            Sete dias em silêncio.
          </Frau>
          <Frau italic size={14} lineHeight={20} color={c.ink2} style={styles.allEmptyProse}>
            Nenhum compromisso na próxima semana — agenda protegida.
          </Frau>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      {days.map((day, idx) => {
        const metaColor = day.isMajor ? c.bronze : day.isEmpty ? c.ink3 : c.ink2
        const metaWeight = day.isMajor ? 'med' : 'reg'
        const row = (
          <View
            style={[
              styles.row,
              idx === 0
                ? { borderTopColor: 'rgba(26,22,18,0.06)', borderTopWidth: 1 }
                : null,
              { borderBottomColor: 'rgba(26,22,18,0.06)' },
            ]}
          >
            <Mono
              size={11}
              lineHeight={16}
              letterSpacing={0.8}
              color={c.ink2}
              style={styles.day}
            >
              {day.dayLabel}
            </Mono>
            <DotLeader />
            <Frau italic weight={metaWeight} size={14} lineHeight={20} color={metaColor}>
              {day.meta}
            </Frau>
          </View>
        )
        if (onSelectDay) {
          return (
            <Pressable
              key={day.date.toISOString()}
              onPress={() => onSelectDay(day)}
              accessibilityRole="button"
              accessibilityLabel={`${day.dayLabel}: ${day.meta}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
            >
              {row}
            </Pressable>
          )
        }
        return <View key={day.date.toISOString()}>{row}</View>
      })}
    </View>
  )
}

// Dot leader · sequência de pontos `· · · ·` em mono ink3 com opacity 45%.
// Match do CSS canon `border-bottom: 1.5px dotted` é difícil de replicar em
// React Native sem hairline; usamos sequência tipográfica que dá visual
// equivalente ("········") em mono small.
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
  day: {
    width: 64,
    flexShrink: 0,
    textTransform: 'lowercase',
  },
  leader: {
    flex: 1,
    overflow: 'hidden',
  },
  leaderDots: {
    opacity: 0.45,
  },
  allEmpty: {
    paddingVertical: 8,
  },
  allEmptyProse: {
    marginTop: 6,
  },
})
