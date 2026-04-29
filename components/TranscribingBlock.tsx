import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Sans } from '../design/Type'
import { useTheme } from '../design/theme'
import { Skeleton } from './Skeleton'

// "TRANSCREVENDO VIA WHISPER" + 4 linhas em larguras decrescentes.
export function TranscribingBlock() {
  const { c } = useTheme()
  const t = useSharedValue(0.35)
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
  }, [t])
  const dotStyle = useAnimatedStyle(() => ({ opacity: t.value }))
  return (
    <View style={styles.block}>
      <View style={styles.label}>
        <Animated.View
          style={[
            { width: 4, height: 4, borderRadius: 2, backgroundColor: c.bronze, marginRight: 8 },
            dotStyle,
          ]}
        />
        <Sans weight="med" size={11} letterSpacing={1.1} color={c.ink2} style={{ textTransform: 'uppercase' }}>
          Transcrevendo via Whisper
        </Sans>
      </View>
      <Skeleton width="90%" height={14} radius={3} style={{ marginTop: 10 }} />
      <Skeleton width="75%" height={14} radius={3} style={{ marginTop: 10 }} />
      <Skeleton width="60%" height={14} radius={3} style={{ marginTop: 10 }} />
      <Skeleton width="45%" height={14} radius={3} style={{ marginTop: 10 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  block: { marginTop: 8 },
  label: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
})
