import { Pressable, StyleSheet, View } from 'react-native'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { CaptureMode, CaptureSensitivity } from '../../lib/overlays'

interface Props {
  mode: CaptureMode
  sensitivity: CaptureSensitivity
  onPress: () => void
}

// Editorial status line for the capture screen. Reads in prose:
//   "texto"
//   "áudio · privada"
// Domínio is intentionally absent — it's asked at save time via the
// DomainSheet, not pre-set here. Sensitivity only appears when ≠ normal.
// Tap opens CaptureSettingsSheet (mode + sensibilidade only).
export function CaptureStatus({ mode, sensitivity, onPress }: Props) {
  const c = usePalette()

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`captura atual: ${capturePhrase(mode, sensitivity)}. tocar para trocar.`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.65 : 1 }]}
    >
      <View style={styles.line}>
        <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: 0.5 }}>
          {capturePhrase(mode, sensitivity)}
        </Frau>
        <Frau
          italic
          size={13}
          lineHeight={18}
          color={c.ink}
          style={{ opacity: 0.35, marginLeft: 8 }}
        >
          · trocar
        </Frau>
      </View>
    </Pressable>
  )
}

export function capturePhrase(mode: CaptureMode, sensitivity: CaptureSensitivity): string {
  const modeWord = MODE_WORDS[mode]
  const sensitivityWord = SENSITIVITY_WORDS[sensitivity]
  const tail = sensitivityWord ? ` · ${sensitivityWord}` : ''
  return `${modeWord}${tail}`
}

const MODE_WORDS: Record<CaptureMode, string> = {
  audio: 'áudio',
  text: 'texto',
  photo: 'foto',
}

const SENSITIVITY_WORDS: Record<CaptureSensitivity, string> = {
  normal: '',
  private: 'privada',
  sensitive: 'sensível',
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
    minHeight: 38,
    justifyContent: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
})
