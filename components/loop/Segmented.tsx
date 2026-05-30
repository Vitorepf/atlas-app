import { Pressable, StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { radii } from '../../design/tokens'

interface Props {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

// PORT verbatim of engineering.tsx Segmented (:3480): a mono-caps segmented
// control, active item filled c.prussian / text c.onInk. Used for the cycles
// window (24H / TUDO). Calm, two options.
export function Segmented({ value, options, onChange }: Props) {
  const c = usePalette()
  return (
    <View style={[styles.segmented, { borderColor: c.border, backgroundColor: c.bg }]}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segmentedItem,
              {
                backgroundColor: active ? c.prussian : 'transparent',
                opacity: pressed ? 0.86 : 1,
              },
            ]}
          >
            <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={active ? c.onInk : c.ink2}>
              {option.label}
            </Mono>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  segmentedItem: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
})
