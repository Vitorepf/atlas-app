import { useEffect } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { usePalette } from '../../design/theme'
import { fonts } from '../../design/tokens'
import { BronzeDiamond } from './BronzeDiamond'

interface Props {
  value: string
  onChangeText: (next: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  multiline?: boolean
}

// Console input. No rectangular box. A single hairline underline at rest;
// the diamond send affordance fades in only when there is text to send.
// The whole field becomes the editorial terrain — paper, calm cursor,
// generous tap area.
export function FieldInline({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'continuar…',
  disabled = false,
  multiline = true,
}: Props) {
  const c = usePalette()
  const hasText = value.trim().length > 0
  const ready = hasText && !disabled

  const sendOpacity = useSharedValue(0)
  const sendScale = useSharedValue(0.7)
  const sendBreath = useSharedValue(1)
  const pressScale = useSharedValue(1)

  // Entrance / exit: scale-and-fade with spring on entrance, crisp timing on exit.
  useEffect(() => {
    if (ready) {
      sendOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
      sendScale.value = withSpring(1, { damping: 14, stiffness: 180, mass: 0.7 })
    } else {
      sendOpacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) })
      sendScale.value = withTiming(0.7, { duration: 180, easing: Easing.in(Easing.cubic) })
    }
  }, [ready, sendOpacity, sendScale])

  // Idle breathing while ready: 1 ↔ 1.045 over 2.2s — barely there, gives life.
  useEffect(() => {
    if (ready) {
      sendBreath.value = withRepeat(
        withSequence(
          withTiming(1.045, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      )
    } else {
      cancelAnimation(sendBreath)
      sendBreath.value = withTiming(1, { duration: 180 })
    }
  }, [ready, sendBreath])

  const sendStyle = useAnimatedStyle(() => ({
    opacity: sendOpacity.value,
    transform: [{ scale: sendScale.value * sendBreath.value * pressScale.value }],
  }))

  const onPressIn = () => {
    pressScale.value = withTiming(0.88, { duration: 120, easing: Easing.out(Easing.quad) })
  }
  const onPressOut = () => {
    pressScale.value = withSpring(1, { damping: 12, stiffness: 220, mass: 0.6 })
  }

  return (
    <View style={[styles.wrap, { borderTopColor: c.border }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        multiline={multiline}
        editable={!disabled}
        textAlignVertical="top"
        style={[styles.input, { color: c.ink }]}
        returnKeyType="default"
        autoCorrect
        spellCheck
        autoCapitalize="sentences"
        textContentType="none"
        autoComplete="off"
        importantForAutofill="no"
        passwordRules=""
      />
      <Animated.View style={[styles.send, sendStyle]} pointerEvents={ready ? 'auto' : 'none'}>
        <Pressable
          onPress={onSubmit}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={!ready}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="enviar"
          style={styles.sendHit}
        >
          <BronzeDiamond size={32} />
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
    paddingBottom: 4,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 56,
    gap: 16,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 32,
    maxHeight: 140,
  },
  send: {
    paddingBottom: 2,
  },
  sendHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
