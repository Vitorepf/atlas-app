import { useEffect } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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
  const sendOpacity = useSharedValue(0)

  useEffect(() => {
    sendOpacity.value = withTiming(hasText && !disabled ? 1 : 0, { duration: 200 })
  }, [hasText, disabled, sendOpacity])

  const sendStyle = useAnimatedStyle(() => ({ opacity: sendOpacity.value }))

  return (
    <View style={[styles.wrap, { borderTopColor: c.border }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        multiline={multiline}
        editable={!disabled}
        keyboardAppearance="light"
        textAlignVertical="top"
        style={[styles.input, { color: c.ink }]}
        returnKeyType="default"
      />
      <Animated.View style={[styles.send, sendStyle]} pointerEvents={hasText ? 'auto' : 'none'}>
        <Pressable
          onPress={onSubmit}
          disabled={!hasText || disabled}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="enviar"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <BronzeDiamond size={20} />
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
    paddingBottom: 4,
  },
})
