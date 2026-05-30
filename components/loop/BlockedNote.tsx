import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { PressableTextScale } from '../atlas-ui/PressableScale'

interface Props {
  title?: string
  reason: string
  rawCode?: string
  onRetry?: () => void
}

// Reusable honest blocked/empty state · NO card, NO icon, at the 32px rail.
// Per-section ownership so a partial outage never blanks the whole dossier.
// Imperative, calm, NO apologetic em-dash, NEVER a fabricated fallback. Pull-
// to-refresh is the recovery gesture; "tentar de novo" re-runs the loader.
export function BlockedNote({ title, reason, rawCode, onRetry }: Props) {
  const c = usePalette()
  return (
    <View style={styles.wrap}>
      <Frau italic size={16} lineHeight={23} color={c.ink}>
        {title ?? 'Este registro está indisponível.'}
      </Frau>
      <Frau size={14} lineHeight={21} color={c.ink2} style={styles.reason}>
        {reason}
      </Frau>
      {rawCode ? (
        <Mono size={11} lineHeight={14} letterSpacing={0.2} color={c.ink3} style={styles.code} selectable>
          {rawCode}
        </Mono>
      ) : null}
      {onRetry ? (
        <PressableTextScale onPress={onRetry} haptic="soft" accessibilityLabel="tentar de novo" style={styles.retry}>
          <Mono size={11} lineHeight={14} letterSpacing={0.4} color={c.bronze}>
            tentar de novo
          </Mono>
        </PressableTextScale>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 32,
    marginVertical: 6,
  },
  reason: {
    marginTop: 6,
  },
  code: {
    marginTop: 8,
  },
  retry: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
})
