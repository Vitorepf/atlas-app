import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Mono } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import { useShell } from '../../AtlasShell'
import { copyToClipboard } from '../../../lib/clipboard'

export function ApiTextInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry,
  narrow,
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  keyboardType?: 'default' | 'number-pad'
  secureTextEntry?: boolean
  narrow?: boolean
}) {
  const { c } = useTheme()

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.ink3}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      autoComplete="off"
      textContentType="none"
      importantForAutofill="no"
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      selectionColor={c.prussian}
      style={[
        styles.apiInput,
        narrow && styles.apiInputNarrow,
        { color: c.ink, borderColor: c.border, backgroundColor: c.surface },
      ]}
    />
  )
}

export function SecretApiInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder: string
}) {
  const { c } = useTheme()
  const { showToast } = useShell()
  const [revealed, setRevealed] = useState(false)
  const canCopy = value.trim().length > 0

  const handleCopy = () => {
    if (!canCopy) return
    void copyToClipboard(value, () => showToast('token copiado', { durationMs: 1600 }))
  }

  return (
    <View style={styles.secretInputRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        secureTextEntry={!revealed}
        selectionColor={c.prussian}
        style={[styles.apiInput, styles.secretInputField, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
      />
      <Pressable
        onPress={() => setRevealed((v) => !v)}
        hitSlop={6}
        style={({ pressed }) => [
          styles.secretInputAction,
          { borderColor: c.border, backgroundColor: pressed ? c.premium : c.surface },
        ]}
      >
        <Mono size={10} letterSpacing={0.4} color={c.ink2}>
          {revealed ? 'ocultar' : 'ver'}
        </Mono>
      </Pressable>
      <Pressable
        onPress={handleCopy}
        disabled={!canCopy}
        hitSlop={6}
        style={({ pressed }) => [
          styles.secretInputAction,
          {
            borderColor: c.border,
            backgroundColor: pressed && canCopy ? c.premium : c.surface,
            opacity: canCopy ? 1 : 0.4,
          },
        ]}
      >
        <Mono size={10} letterSpacing={0.4} color={c.ink2}>
          copiar
        </Mono>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  apiInput: {
    width: 168,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
  },
  apiInputNarrow: {
    width: 82,
    textAlign: 'center',
  },
  secretInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secretInputField: {
    width: 96,
  },
  secretInputAction: {
    minHeight: 28,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
