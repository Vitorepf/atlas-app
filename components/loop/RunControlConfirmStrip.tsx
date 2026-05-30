import { StyleSheet, TextInput, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Frau, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { fonts, radii } from '../../design/tokens'
import { PressableTextScale } from '../atlas-ui/PressableScale'

interface Props {
  kind: 'kill' | 'clear-kill'
  reason: string
  onChangeReason: (t: string) => void
  onCancel: () => void
  onConfirm: (reason?: string) => void
  busy?: boolean
}

// In-place destructive confirm (NOT a system Alert). Morphs in the bar footprint
// (FadeIn ~280ms). Honest note: kill is a reversible SIGNAL file, ≤5s next
// boundary, no force-kill, no merge. CANCELAR (left) + CONFIRMAR (right, heavier).
// No hold-gesture (holds read as gimmick, not gravity). The destructive button
// is RIGHT and visually heavier.
export function RunControlConfirmStrip({
  kind,
  reason,
  onChangeReason,
  onCancel,
  onConfirm,
  busy = false,
}: Props) {
  const c = usePalette()
  const isKill = kind === 'kill'
  const frame = isKill ? withAlpha(c.recRed, 0.34) : c.bronze
  const confirmColor = isKill ? c.recRed : c.bronze
  const confirmLabel = isKill ? 'CONFIRMAR ENCERRAMENTO' : 'LIBERAR ENCERRAMENTO'

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      style={[styles.strip, { borderColor: frame, backgroundColor: c.bgRecessed }]}
    >
      <Frau italic size={14} lineHeight={20} color={c.ink}>
        {isKill
          ? 'Encerrar o loop? Ele honra o sinal no próximo limite de ciclo (até 5s). Você poderá liberar o encerramento depois.'
          : 'Liberar o encerramento? O loop volta a poder iniciar novos ciclos no próximo limite.'}
      </Frau>

      <TextInput
        value={reason}
        onChangeText={onChangeReason}
        placeholder="motivo (opcional)"
        placeholderTextColor={c.ink3}
        selectionColor={c.bronze}
        cursorColor={c.bronze}
        style={[styles.reason, { color: c.ink, backgroundColor: c.bg, borderColor: c.border }]}
      />

      <View style={styles.actions}>
        <PressableTextScale onPress={onCancel} disabled={busy} haptic="soft" accessibilityLabel="cancelar">
          <Mono size={13} lineHeight={18} color={c.ink2}>
            CANCELAR
          </Mono>
        </PressableTextScale>
        <PressableTextScale
          onPress={() => onConfirm(reason.trim() !== '' ? reason.trim() : undefined)}
          disabled={busy}
          haptic={isKill ? 'medium' : 'soft'}
          accessibilityLabel={confirmLabel.toLowerCase()}
        >
          <Sans weight="sb" size={13} lineHeight={18} color={confirmColor} style={styles.confirmText}>
            {busy ? 'ENVIANDO…' : confirmLabel}
          </Sans>
        </PressableTextScale>
      </View>
    </Animated.View>
  )
}

function withAlpha(hex: string, alpha: number): string {
  // hex like #d05a52 -> rgba(208,90,82,alpha). Falls back to the hex if unparseable.
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 32,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  reason: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  confirmText: {
    letterSpacing: 0.4,
  },
})
