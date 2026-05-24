import { StyleSheet, View } from 'react-native'
import { Frau } from '../design/Type'
import { useTheme } from '../design/theme'
import { PressableSurfaceScale } from './atlas-ui/PressableScale'
import { SignatureGesture } from './edition/SignatureGesture'

/**
 * EmptyMission · canon editorial divino.
 *
 * Vocabulário antes era card dashed + botão pill prussian. Agora é
 * convite ritual editorial: drop cap "D" bronze inkCarving + body italic
 * "efinir missão." + gesto canônico "selar primeira missão." prussian
 * hairline (commit interno).
 *
 * Mesmo padrão do EditorialEmptyLine do hub edição + SignatureGesture.
 */
export function EmptyMission({ onDefine }: { onDefine?: () => void }) {
  const { c } = useTheme()
  return (
    <View style={styles.wrap}>
      <PressableSurfaceScale
        onPress={onDefine ?? (() => {})}
        haptic="soft"
        accessibilityLabel="definir missão do dia"
      >
        <Frau italic size={17} lineHeight={26} color={c.ink}>
          <Frau
            weight="med"
            size={24}
            color={c.bronze}
            style={{
              textShadowColor: c.inkCarving,
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 0,
            }}
          >
            N
          </Frau>
          enhuma missão definida para hoje.
        </Frau>
      </PressableSurfaceScale>
      <View style={styles.gestureRow}>
        <SignatureGesture
          label="definir agora."
          onPress={onDefine ?? (() => {})}
          seal="commit"
          haptic="light"
          accessibilityLabel="definir missão agora"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 26,
  },
  gestureRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
})
