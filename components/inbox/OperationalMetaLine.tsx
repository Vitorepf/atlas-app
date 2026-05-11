import { View } from 'react-native'
import { Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import {
  operationalActiveLabel,
  operationalCriticalLabel,
} from '../../lib/inboxOperationalModels'
import { styles } from './inboxScreenStyles'

export function OperationalMetaLine({
  total,
  critical,
  mobilePaired,
  error,
}: {
  total: number
  critical: number
  mobilePaired: boolean | null
  error: string | null
}) {
  const c = usePalette()
  const segments: Array<{ text: string; color: string }> = []

  if (mobilePaired === false) {
    segments.push({ text: 'GATEWAY DESCONECTADO', color: c.bronze })
  } else if (error) {
    segments.push({ text: 'ERRO AO CARREGAR', color: c.recRed })
  } else if (mobilePaired === null) {
    segments.push({ text: 'SINCRONIZANDO', color: c.ink2 })
  } else {
    segments.push({ text: total === 0 ? 'OPERACIONAL LIMPO' : operationalActiveLabel(total), color: c.ink2 })
  }

  if (critical > 0) {
    segments.push({ text: operationalCriticalLabel(critical), color: c.recRed })
  }

  return (
    <View style={styles.metaRow}>
      {segments.map((seg, i) => (
        <View key={i} style={styles.metaSegment}>
          {i > 0 ? (
            <Sans
              weight="med"
              size={11}
              lineHeight={14}
              letterSpacing={1.1}
              color={c.ink3}
            >
              ·
            </Sans>
          ) : null}
          <Sans
            weight="med"
            size={11}
            lineHeight={14}
            letterSpacing={1.1}
            color={seg.color}
            style={styles.uppercase}
          >
            {seg.text}
          </Sans>
        </View>
      ))}
    </View>
  )
}
