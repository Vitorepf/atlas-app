/**
 * Cartografia · onboarding hint sutil.
 *
 * Primeira vez · mostra glifo "pinch" + "drag" no centro inferior por
 * ~4s, depois fade out. Apenas no PRIMEIRO uso (localStorage flag).
 * Some imediatamente em qualquer gesto do usuário (auto-dismiss).
 *
 * Vocabulário editorial · zero "tutorial", apenas dica visual.
 */
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated'
import Svg, { Circle, Line, Path } from 'react-native-svg'
import { atlasStorage } from '../../../lib/storage'
import { Mono } from '../../../design/Type'
import { usePalette } from '../../../design/theme'

const STORAGE_KEY = 'atlas.cartografia.onboarding-seen.v1'
const AUTO_DISMISS_MS = 4200

interface Props {
  /** Disparar dismiss imediato quando user faz qualquer gesto */
  shouldDismiss?: boolean
}

export function OnboardingHint({ shouldDismiss }: Props) {
  const c = usePalette()
  const [visible, setVisible] = useState(false)

  // Lê flag · mostra só se nunca visto
  useEffect(() => {
    let cancelled = false
    atlasStorage.getItem(STORAGE_KEY).then((seen) => {
      if (cancelled) return
      if (!seen) setVisible(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-dismiss + marca como visto
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => {
      setVisible(false)
      void atlasStorage.setItem(STORAGE_KEY, '1').catch(() => {})
    }, AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [visible])

  // Dismiss imediato no primeiro gesto
  useEffect(() => {
    if (!shouldDismiss || !visible) return
    setVisible(false)
    void atlasStorage.setItem(STORAGE_KEY, '1').catch(() => {})
  }, [shouldDismiss, visible])

  if (!visible) return null

  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(600).delay(800).easing(Easing.bezier(0.16, 1, 0.3, 1))}
      exiting={FadeOut.duration(280)}
      style={[
        styles.wrap,
        { backgroundColor: c.bgRecessed, borderColor: c.borderSoft },
      ]}
    >
      {/* Pinch glyph · 2 dedos approaching */}
      <View style={styles.row}>
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Circle cx={8} cy={8} r={2.5} fill={c.bronze} opacity={0.85} />
          <Circle cx={20} cy={20} r={2.5} fill={c.bronze} opacity={0.85} />
          <Line x1={11} y1={11} x2={17} y2={17} stroke={c.bronze} strokeWidth={1} opacity={0.55} />
          <Line x1={9} y1={6} x2={11} y2={4} stroke={c.bronze} strokeWidth={1} strokeLinecap="round" />
          <Line x1={5} y1={9} x2={3} y2={11} stroke={c.bronze} strokeWidth={1} strokeLinecap="round" />
          <Line x1={23} y1={17} x2={25} y2={15} stroke={c.bronze} strokeWidth={1} strokeLinecap="round" />
          <Line x1={19} y1={23} x2={17} y2={25} stroke={c.bronze} strokeWidth={1} strokeLinecap="round" />
        </Svg>
        <Mono size={9.5} letterSpacing={1.6} color={c.ink2}>
          PINÇA
        </Mono>
      </View>

      <View style={[styles.divider, { backgroundColor: c.borderSoft }]} />

      {/* Pan glyph · arrow ↔ */}
      <View style={styles.row}>
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Line x1={6} y1={14} x2={22} y2={14} stroke={c.bronze} strokeWidth={1.2} opacity={0.75} />
          <Path d="M 9 11 L 6 14 L 9 17" stroke={c.bronze} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M 19 11 L 22 14 L 19 17" stroke={c.bronze} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={14} cy={14} r={2} fill={c.bronze} opacity={0.85} />
        </Svg>
        <Mono size={9.5} letterSpacing={1.6} color={c.ink2}>
          EXPLORE
        </Mono>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 116,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 999,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  divider: {
    width: 1,
    height: 18,
  },
})
