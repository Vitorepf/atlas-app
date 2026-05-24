import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { HorizonDay } from '../../lib/agenda'
import { PressableTextScale } from '../atlas-ui/PressableScale'

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
// frase única editorial — vocabulário Don Corleone "semana protegida".
//
// Round agenda polish · PressableTextScale + haptic Soft em cada row.
// rgba hardcoded → c.borderSoft. Stagger fade-in down 40ms × idx (papel
// pousando, não cascata).
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
                ? { borderTopColor: c.borderSoft, borderTopWidth: StyleSheet.hairlineWidth }
                : null,
              { borderBottomColor: c.borderSoft },
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
        const content = onSelectDay ? (
          <PressableTextScale
            onPress={() => onSelectDay(day)}
            haptic="soft"
            accessibilityLabel={`${day.dayLabel}: ${day.meta}`}
          >
            {row}
          </PressableTextScale>
        ) : (
          row
        )
        return (
          <Animated.View
            key={day.date.toISOString()}
            entering={FadeInDown.duration(380).delay(40 * idx).easing(Easing.bezier(0.16, 1, 0.3, 1)).springify().damping(22).stiffness(180)}
          >
            {content}
          </Animated.View>
        )
      })}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
