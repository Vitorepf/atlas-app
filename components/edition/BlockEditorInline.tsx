/**
 * BlockEditorInline · "Bloquear horário" canônico Atlas.
 *
 * Vive dentro do agenda panel quando expandido. Toggle header (mono caps)
 * abre o formulário em 3 campos editoriais (título · início · fim) com a
 * mesma gramática do TaskEditorSheet: label tiny + value mono/sans + cursor
 * bronze + hairline divisor.
 *
 * Botão "Salvar" prussian chapado virou gesto "selar bloco." italic Frau
 * bronzeDeep + hairline bronze. Hora começa/fim ficam em mono.
 */
import { useEffect, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Frau, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { fonts } from '../../design/tokens'
import { SignatureGesture } from './SignatureGesture'
import { PressableTextScale } from '../atlas-ui/PressableScale'

export interface BlockDraft {
  title: string
  startTime: string
  endTime: string
}

interface Props {
  open: boolean
  draft: BlockDraft
  onDraftChange: (next: BlockDraft) => void
  onToggleOpen: () => void
  onCommit: () => void
}

export function BlockEditorInline({
  open,
  draft,
  onDraftChange,
  onToggleOpen,
  onCommit,
}: Props) {
  const c = usePalette()
  const canCommit = draft.title.trim().length > 0 && draft.startTime.trim().length > 0 && draft.endTime.trim().length > 0

  return (
    <View style={[styles.wrap, { borderTopColor: c.borderSoft }]}>
      <PressableTextScale
        onPress={onToggleOpen}
        accessibilityLabel={open ? 'fechar bloqueio de horário' : 'abrir bloqueio de horário'}
        hitSlop={6}
      >
        <View style={styles.header}>
          <Sans
            weight="med"
            size={9.5}
            lineHeight={12}
            letterSpacing={1.6}
            color={c.ink3}
            style={styles.uppercase}
          >
            bloquear horário
          </Sans>
          <Mono
            size={10}
            lineHeight={14}
            letterSpacing={1.2}
            color={c.ink2}
            style={styles.uppercase}
          >
            {open ? 'fechar' : 'abrir'}
          </Mono>
        </View>
      </PressableTextScale>

      {open ? (
        <Animated.View
          entering={FadeIn.duration(320).easing(Easing.bezier(0.16, 1, 0.3, 1))}
          exiting={FadeOut.duration(200)}
          style={styles.body}
        >
          <FieldLine label="compromisso" borderColor={c.borderSoft}>
            <ManuscriptInput
              value={draft.title}
              onChangeText={(title) => onDraftChange({ ...draft, title })}
              placeholder="o que selar no horário"
            />
          </FieldLine>

          <FieldLine label="início · fim" borderColor={c.borderSoft}>
            <View style={styles.inlineRow}>
              <ManuscriptInput
                value={draft.startTime}
                onChangeText={(startTime) => onDraftChange({ ...draft, startTime })}
                placeholder="hh:mm"
                mono
                width={84}
              />
              <View style={[styles.inlineDivider, { backgroundColor: 'rgba(233, 238, 242, 0.10)' }]} />
              <ManuscriptInput
                value={draft.endTime}
                onChangeText={(endTime) => onDraftChange({ ...draft, endTime })}
                placeholder="hh:mm"
                mono
                width={84}
              />
            </View>
          </FieldLine>

          <View style={styles.gestureRow}>
            <SignatureGesture
              label="selar bloco."
              onPress={onCommit}
              disabled={!canCommit}
              seal="external"
              haptic="light"
              accessibilityLabel="selar bloqueio de horário"
            />
          </View>
        </Animated.View>
      ) : null}
    </View>
  )
}

function FieldLine({
  label,
  borderColor,
  children,
  noBorder,
}: {
  label: string
  borderColor: string
  children: React.ReactNode
  noBorder?: boolean
}) {
  const c = usePalette()
  return (
    <View
      style={[
        styles.fieldLine,
        !noBorder && { borderBottomColor: borderColor, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Sans
        weight="med"
        size={9}
        lineHeight={12}
        letterSpacing={1.4}
        color={c.ink3}
        style={styles.uppercase}
      >
        {label}
      </Sans>
      <View style={styles.fieldLineBody}>{children}</View>
    </View>
  )
}

function ManuscriptInput({
  value,
  onChangeText,
  placeholder,
  mono,
  width,
  flex,
}: {
  value: string
  onChangeText: (next: string) => void
  placeholder?: string
  mono?: boolean
  width?: number
  flex?: boolean
}) {
  const c = usePalette()
  const hasText = value.trim().length > 0
  const placeholderOpacity = useSharedValue(hasText ? 0 : 1)
  useEffect(() => {
    placeholderOpacity.value = withTiming(hasText ? 0 : 1, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    })
  }, [hasText, placeholderOpacity])
  const placeholderStyle = useAnimatedStyle(() => ({
    opacity: placeholderOpacity.value,
  }))
  const inputStyle = mono
    ? { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20, letterSpacing: 0.4 }
    : { fontFamily: fonts.sans, fontSize: 16, lineHeight: 22 }
  return (
    <View style={[styles.inputWrap, flex && { flex: 1 }, width != null && { width }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder=""
        placeholderTextColor="transparent"
        selectionColor={c.bronze}
        cursorColor={c.bronze}
        style={[styles.input, inputStyle, { color: c.ink }]}
      />
      <Animated.View pointerEvents="none" style={[styles.placeholderOverlay, placeholderStyle]}>
        <Frau italic size={mono ? 14 : 16} lineHeight={mono ? 20 : 22} color={c.ink3}>
          {placeholder}
        </Frau>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  header: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  uppercase: { textTransform: 'uppercase' },
  body: {
    gap: 2,
  },
  fieldLine: {
    paddingVertical: 8,
    gap: 6,
  },
  fieldLineBody: {
    minHeight: 22,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
  },
  inputWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 22,
  },
  placeholderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  gestureRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
})
