import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { MonthDay } from '../../lib/agenda'
import type { MilestoneKind } from '../../lib/atlasMilestones'

// Label do marker mono caps · "FUNDAÇÃO", "ANIVERSÁRIO", "1 ANO".
// Apenas pra dias com milestone do Atlas. Matemática editorial: rotular o
// dia com a natureza do marco, não a contagem (que vai no `meta`).
function milestoneMarkerLabel(kind: MilestoneKind): string | null {
  switch (kind) {
    case 'foundation': return 'FUNDAÇÃO'
    case 'anniversary-yearly': return 'ANIVERSÁRIO'
    case 'anniversary-monthly': return 'MARCO'
    case 'day-100': return '100 DIAS'
    case 'day-365': return '1 ANO'
    case 'day-1000': return '1000 DIAS'
    default: return null
  }
}

interface Props {
  day: MonthDay
  onPress?: (day: MonthDay) => void
}

// Linha de um dia do calendário mensal · TOC editorial linear.
//   md-num: mono med 12 (width 22, ink default)
//   md-dow: mono caps 9.5 ink3 (width 26)
//   leader: dot leader (mono pontos · 40% opacity)
//   md-meta: italic Frau 13 ink2 default
//   md-marker (today): "hoje" mono caps small bronze
//   md-holiday: italic Frau 11 ink3 — marginalia segunda linha (feriado
//                quando o dia tem outro meta principal · ex.: dia com tasks
//                + feriado), ou bronze quando milestone
//
// Estados (canon):
//   - past: num/dow/meta → ink3
//   - weekend: num/dow → ink2 italic
//   - empty: meta → ink3 italic (livre/descanso)
//   - today: bg bronze@4%, num/dow/meta → bronze med, marker "HOJE" mono caps
//   - major: meta → bronze med (task urgent)
//   - milestone: meta → bronze med + marker "FUNDAÇÃO"/"ANIVERSÁRIO"
//   - holiday: meta → ink2 (fica como meta principal só se sem tasks)
export function MonthDayRow({ day, onPress }: Props) {
  const c = usePalette()
  const isMilestone = day.state === 'milestone'
  const isHolidayMeta = day.state === 'holiday'
  const accent = isMilestone || day.isMajor || day.isToday

  const numColor = day.isToday
    ? c.bronze
    : day.state === 'past'
    ? c.ink3
    : day.isWeekend
    ? c.ink2
    : c.ink
  const dowColor = day.isToday
    ? c.bronze
    : day.state === 'past'
    ? c.ink3
    : day.isWeekend
    ? c.ink2
    : c.ink3
  const metaColor = day.isToday
    ? c.bronze
    : isMilestone
    ? c.bronze
    : day.state === 'past'
    ? c.ink3
    : day.isMajor
    ? c.bronze
    : isHolidayMeta
    ? c.ink2
    : day.isEmpty
    ? c.ink3
    : c.ink2
  const numWeight = 'med'  // mono med default canon
  const metaWeight = accent ? 'med' : 'reg'
  const todayBg = day.isToday ? 'rgba(155,122,63,0.04)' : undefined

  // Marker editorial quando dia tem milestone · "FUNDAÇÃO", "ANIVERSÁRIO",
  // "1 ANO" etc. Usa o kind do milestone pra escolher palavra.
  const milestoneMarker = day.milestone ? milestoneMarkerLabel(day.milestone.kind) : null

  const row = (
    <View
      style={[
        styles.row,
        {
          backgroundColor: todayBg,
          borderBottomColor: day.isToday
            ? 'rgba(155,122,63,0.18)'
            : 'rgba(26,22,18,0.04)',
          marginHorizontal: day.isToday ? -8 : 0,
          paddingHorizontal: day.isToday ? 8 : 0,
        },
      ]}
    >
      <Mono
        size={12}
        lineHeight={16}
        letterSpacing={0.4}
        color={numColor}
        weight={numWeight}
        style={styles.num}
      >
        {String(day.num).padStart(2, '0')}
      </Mono>
      <Mono
        size={9.5}
        lineHeight={13}
        letterSpacing={1.4}
        color={dowColor}
        style={[styles.dow, day.isWeekend ? styles.dowItalic : null]}
      >
        {day.dow.toUpperCase()}
      </Mono>
      <DotLeader />
      {/* Meta · usa Frau italic; Major events em Frau italic med bronze;
          Today em Frau italic med bronze. Empty em Frau italic ink3. */}
      <View style={styles.metaBlock}>
        <Frau italic weight={metaWeight === 'med' ? 'med' : undefined} size={13} lineHeight={19} color={metaColor}>
          {day.meta}
        </Frau>
        {day.holiday ? (
          <Frau italic size={11} lineHeight={15} color={c.ink3} style={styles.holiday}>
            {`— ${day.holiday.name}`}
          </Frau>
        ) : null}
      </View>
      {day.isToday ? (
        <Mono
          size={9}
          lineHeight={12}
          letterSpacing={1.6}
          color={c.bronze}
          weight="med"
          style={styles.marker}
        >
          HOJE
        </Mono>
      ) : milestoneMarker ? (
        <Mono
          size={9}
          lineHeight={12}
          letterSpacing={1.6}
          color={c.bronze}
          weight="med"
          style={styles.marker}
        >
          {milestoneMarker}
        </Mono>
      ) : null}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={() => onPress(day)}
        accessibilityRole="button"
        accessibilityLabel={`${day.dow} ${day.num}: ${day.meta}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
      >
        {row}
      </Pressable>
    )
  }
  return row
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
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 6,
    gap: 10,
    borderBottomWidth: 1,
  },
  num: {
    width: 22,
    flexShrink: 0,
  },
  dow: {
    width: 26,
    flexShrink: 0,
  },
  dowItalic: {
    fontStyle: 'italic',
  },
  leader: {
    flex: 1,
    overflow: 'hidden',
  },
  leaderDots: {
    opacity: 0.4,
  },
  metaBlock: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  holiday: {
    marginTop: 1,
  },
  marker: {
    marginLeft: 6,
    flexShrink: 0,
  },
})
