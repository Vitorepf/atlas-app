import { View } from 'react-native'
import { usePalette } from '../../design/theme'
import { statusColor } from './loopTone'

interface Props {
  /** Status word (resolved via statusColor) OR an explicit palette hex. */
  tone: string
  /** Diameter in px · default 6. */
  size?: number
}

// StaticStatusDot · the canonical static dot. STATIC by contract — the operator
// explicitly removed pulsing halos as cafona. State carries by COLOR + POSITION,
// never motion. A filled circle, no halo, no shadow, no animation, EVER.
export function StatusDot({ tone, size = 6 }: Props) {
  const c = usePalette()
  // If `tone` is already a hex/rgba color, use it verbatim; else resolve the word.
  const color = tone.startsWith('#') || tone.startsWith('rgb') ? tone : statusColor(tone, c)
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  )
}
