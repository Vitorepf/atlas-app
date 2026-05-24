import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { WeekDay } from '../../lib/agenda'
import { PressableTextScale } from '../atlas-ui/PressableScale'

interface Props {
  days: WeekDay[]
  onSelectDay?: (day: WeekDay) => void
}

// Cinta semanal silenciosa · 7 day-slots em grid igualmente distribuído.
// Cada slot: dow mono caps small + num Frau italic 17 + marks (até 3 dots
// indicando densidade do dia). Estados:
//   - past: ink3 + dots opacity 50%
//   - today: dow bronze med + num ink upright med + dots bronze + underline bronze
//
// Hairlines top/bottom 12% ink. Trilho margin 32 (canon).
//
// Round agenda polish · PressableTextScale + haptic Soft em cada slot.
// taskMarkBg past via c.ink3 (era rgba hardcoded warm cream que sumia em
// dark mode). Today underline ganha sutil bronzeGlow shadow halo.
// Today num ganha textShadow inkCarving (letterpress).
export function AgendaWeekStrip({ days, onSelectDay }: Props) {
  const c = usePalette()
  return (
    <View
      style={[
        styles.wrap,
        { borderTopColor: c.borderSoft, borderBottomColor: c.borderSoft },
      ]}
    >
      {days.map((day) => {
        const isToday = day.isToday
        const hasAccent = day.hasMilestone || day.hasHoliday
        const dowColor = isToday || hasAccent ? c.bronze : c.ink3
        const numColor = isToday ? c.ink : day.isPast ? c.ink3 : c.ink2
        const taskMarkBg = isToday ? c.bronze : day.isPast ? c.ink3 : c.ink3
        const numWeight = isToday ? 'med' : undefined
        const taskDotCount = Math.min(3, day.taskCount)
        const slot = (
          <View style={styles.slot}>
            <Mono
              size={9}
              lineHeight={12}
              letterSpacing={1.4}
              color={dowColor}
              weight={isToday ? 'med' : undefined}
            >
              {day.dow.toUpperCase()}
            </Mono>
            {isToday ? (
              <Frau
                size={17}
                lineHeight={17}
                weight={numWeight}
                color={numColor}
                style={{
                  textShadowColor: c.inkCarving,
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 0,
                }}
              >
                {String(day.num)}
              </Frau>
            ) : (
              <Frau italic size={17} lineHeight={17} color={numColor} style={day.isPast ? { opacity: 0.7 } : undefined}>
                {String(day.num)}
              </Frau>
            )}
            <View style={styles.marks}>
              {Array.from({ length: taskDotCount }).map((_, i) => (
                <View
                  key={`t-${i}`}
                  style={[styles.mark, { backgroundColor: taskMarkBg, opacity: day.isPast ? 0.5 : 1 }]}
                />
              ))}
              {hasAccent ? (
                <View
                  key="accent"
                  style={[styles.mark, styles.markAccent, { backgroundColor: c.bronze }]}
                />
              ) : null}
            </View>
            {isToday ? (
              <View
                style={[
                  styles.todayUnderline,
                  {
                    backgroundColor: c.bronze,
                    shadowColor: c.bronze,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 3,
                  },
                ]}
              />
            ) : null}
          </View>
        )

        if (onSelectDay) {
          return (
            <View key={day.dateKey} style={styles.slotWrap}>
              <PressableTextScale
                onPress={() => onSelectDay(day)}
                haptic="soft"
                accessibilityLabel={`${day.dow} ${day.num}, ${day.taskCount} compromissos`}
              >
                {slot}
              </PressableTextScale>
            </View>
          )
        }
        return (
          <View key={day.dateKey} style={styles.slotWrap}>
            {slot}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginHorizontal: 32,
    marginBottom: 28,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  slotWrap: {
    flex: 1,
  },
  slot: {
    alignItems: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  marks: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 6,
    height: 3,
  },
  mark: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  markAccent: {
    // Mark de milestone/holiday é levemente maior pra distinguir de
    // task-marks. Vocabulário: "ponto bronze de exclamação editorial".
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: 1,
  },
  todayUnderline: {
    position: 'absolute',
    bottom: -2,
    left: '28%',
    right: '28%',
    height: 1.5,
    borderRadius: 1,
    elevation: 2,
  },
})
