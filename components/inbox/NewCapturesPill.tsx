import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'

// Frente 2 v7 · Morning notification editorial.
// Aparece quando há novidade real (propostas overnight do Curator, ou
// capturas chegando do server fora do viewport). Sussurro Frau italic
// com ✦ bronze. Tap = scrolla pro topo da lista.
//
// Diferente de toast: presença persistente até user interagir ou expirar 8s.

interface Props {
  visible: boolean
  count: number              // > 0 quando relevante
  glyph?: string             // default ✦
  text?: string              // override (ex: "atlas curou esta noite")
  onPress: () => void
  variant?: 'morning' | 'arrival'   // morning = "propostas novas" · arrival = "novas capturas"
}

export function NewCapturesPill({
  visible,
  count,
  glyph = '✦',
  text,
  onPress,
  variant = 'morning',
}: Props) {
  const c = usePalette()
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-4)).current

  useEffect(() => {
    if (visible && count > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 480,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -4, duration: 320, useNativeDriver: true }),
      ]).start()
    }
  }, [visible, count, opacity, translateY])

  if (!visible || count <= 0) return null

  const label =
    text ??
    (variant === 'morning'
      ? `${count} ${count === 1 ? 'proposta nova' : 'propostas novas'} durante a noite`
      : `${count} ${count === 1 ? 'nova captura' : 'novas capturas'}`)

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}. toque para ver.`}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: c.bg + 'EE',
            borderColor: c.border,
            borderTopColor: c.bronze,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Frau italic size={12} lineHeight={14} color={c.bronze}>
          {glyph}
        </Frau>
        <Frau italic size={13} lineHeight={18} letterSpacing={-0.05} color={c.ink}>
          {label}
        </Frau>
        <Frau italic size={13} lineHeight={18} color={c.ink3} style={{ opacity: 0.7 }}>
          →
        </Frau>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 6,
    zIndex: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0.5,
  },
})
