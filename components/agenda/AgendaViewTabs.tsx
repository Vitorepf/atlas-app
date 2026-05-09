import { Pressable, StyleSheet, View } from 'react-native'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'

export type AgendaView = 'hoje' | 'semana' | 'mes'

interface Props {
  value: AgendaView
  onChange: (next: AgendaView) => void
}

interface TabSpec {
  key: AgendaView
  label: string
}

const TABS: TabSpec[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
]

// View tabs · "Hoje · Semana · Mês" centralizado, baseline align, gap 16.
// Inactive: Frau 17 ink3. Active: Frau med 17 ink + underline bronze 1.5px.
// Separadores `·` em Frau ink3 entre tabs. Cadência 28px top/bottom.
export function AgendaViewTabs({ value, onChange }: Props) {
  const c = usePalette()
  return (
    <View style={styles.row}>
      {TABS.map((tab, idx) => {
        const isActive = tab.key === value
        return (
          <View key={tab.key} style={styles.tabGroup}>
            <Pressable
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              style={({ pressed }) => ({ opacity: pressed && !isActive ? 0.55 : 1 })}
            >
              <View>
                <Frau
                  size={17}
                  lineHeight={22}
                  weight={isActive ? 'med' : 'reg'}
                  color={isActive ? c.ink : c.ink3}
                >
                  {tab.label}
                </Frau>
                {isActive ? (
                  <View style={[styles.underline, { backgroundColor: c.bronze }]} />
                ) : null}
              </View>
            </Pressable>
            {idx < TABS.length - 1 ? (
              <Frau size={17} lineHeight={22} color={c.ink3} style={styles.sep}>
                ·
              </Frau>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginTop: 28,
    marginBottom: 28,
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sep: {
    marginHorizontal: 16,
  },
  underline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -6,
    height: 1.5,
    borderRadius: 1,
  },
})
