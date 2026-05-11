import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { SideSheet } from './SideSheet'
import { Scrim } from './Scrim'
import { Frau, Mono } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { fonts } from '../../design/tokens'
import { useOverlays } from '../../lib/overlays'
import { useShell } from '../AtlasShell'
import { type DomainKey } from '../../lib/domains'
import { useAtlasStore } from '../../lib/atlasStore'
import { useFocusSuppression } from '../../lib/hooks/useFocusSuppression'

// =============================================================================
// EditSheet · canon mockup "Edit Sheet" (v18 · slide-from-right)
// =============================================================================
//
// Edita transcrição/conteúdo da captura. Top bar 3-column [back / EDITAR /
// Salvar] · body editorial Frau regular 17 lh 1.55 com placeholder italic ·
// footer com domain pills (radius 4 manuscript minimal · active bronze) +
// tags mono caps + add-tag dashed.
//
// Vocabulário canon:
//   - back/save: mono 11 caps lspc 1.6 (ink2 / bronze med)
//   - title: Frau med 17 caps lspc 3 ink (centered)
//   - body: Frau 17 lh 1.55 ink (TextInput multiline)
//   - placeholder: Frau italic 13 ink3
//   - pills: radius 4, border 1px @18%, active bronze + bg @4%
//   - tags: mono 10 caps lspc 1.4
//   - add-tag: border dashed
// =============================================================================

export function EditSheet() {
  const open = useOverlays((s) => s.open)
  const item = useOverlays((s) => s.item)
  const close = useOverlays((s) => s.close)
  const { showToast } = useShell()
  const updateCapture = useAtlasStore((s) => s.updateCapture)
  const domains = useAtlasStore((s) => s.domains)
  const visible = open === 'edit' && item != null

  const { c } = useTheme()
  const [draft, setDraft] = useState('')
  const [activeDomain, setActiveDomain] = useState<DomainKey>('atlas')
  const [tags, setTags] = useState<string[]>([])
  const bodyScrollRef = useRef<ScrollView>(null)
  const bodyInputRef = useRef<TextInput>(null)
  const lastBodyHeightRef = useRef(0)
  const { editable: bodyEditable, suppress: suppressBodyFocus } = useFocusSuppression()
  const bodyInputStyle = useMemo(
    () => [styles.input, { color: c.ink, fontFamily: fonts.serif }],
    [c.ink],
  )

  const onBodyContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      const h = e.nativeEvent.contentSize.height
      if (h > lastBodyHeightRef.current + 1) {
        requestAnimationFrame(() =>
          bodyScrollRef.current?.scrollToEnd({ animated: true }),
        )
      }
      lastBodyHeightRef.current = h
    },
    [],
  )

  const onBodyScrollBeginDrag = useCallback(() => {
    bodyInputRef.current?.blur()
    Keyboard.dismiss()
    suppressBodyFocus()
  }, [suppressBodyFocus])

  useEffect(() => {
    if (item) {
      setDraft(item.text)
      setActiveDomain(item.domain)
      // TODO(schema): tags do capture metadata · hoje array vazio
      setTags([])
    }
  }, [item])

  return (
    <>
      <Scrim visible={false} />
      <SideSheet visible={visible}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top bar 3-column · back · title · save */}
          <View style={[styles.header, { borderBottomColor: 'rgba(155,122,63,0.18)' }]}>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              style={({ pressed }) => [styles.headerSlot, { opacity: pressed ? 0.55 : 1 }]}
            >
              <Mono
                size={11}
                lineHeight={14}
                letterSpacing={1.6}
                color={c.ink2}
              >
                ← VOLTAR
              </Mono>
            </Pressable>
            <View style={styles.headerCenter}>
              <Frau
                weight="med"
                size={17}
                lineHeight={22}
                letterSpacing={3}
                color={c.ink}
                align="center"
              >
                EDITAR
              </Frau>
            </View>
            <Pressable
              onPress={async () => {
                if (!item) return
                const updated = await updateCapture(item.id, {
                  content_text: draft,
                  domain: activeDomain,
                })
                showToast(updated ? 'Alterações salvas' : 'Falha ao salvar')
                close()
              }}
              accessibilityRole="button"
              accessibilityLabel="Salvar"
              style={({ pressed }) => [
                styles.headerSlot,
                styles.headerRight,
                { opacity: pressed ? 0.55 : 1 },
              ]}
            >
              <Mono
                size={11}
                lineHeight={14}
                letterSpacing={1.6}
                color={c.bronze}
                weight="med"
              >
                SALVAR
              </Mono>
            </Pressable>
          </View>

          {/* Body · Frau regular 17 lh 1.55 (TextInput multiline) */}
          <ScrollView
            ref={bodyScrollRef}
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={onBodyScrollBeginDrag}
          >
            <TextInput
              ref={bodyInputRef}
              value={draft}
              onChangeText={setDraft}
              multiline
              editable={bodyEditable}
              scrollEnabled={false}
              textAlignVertical="top"
              placeholder="Escreva o que pensa…"
              placeholderTextColor={c.ink3}
              style={bodyInputStyle}
              selectionColor={c.prussian}
              onContentSizeChange={onBodyContentSizeChange}
            />
          </ScrollView>

          {/* Footer · domain pills + tags + add-tag dashed */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: 'rgba(26,22,18,0.12)',
                backgroundColor: c.bg,
              },
            ]}
          >
            {domains.map((d) => {
              const active = d.key === activeDomain
              return (
                <Pressable
                  key={d.key}
                  onPress={() => setActiveDomain(d.key)}
                  accessibilityRole="button"
                  accessibilityLabel={d.label}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.pill,
                    {
                      borderColor: active ? c.bronze : 'rgba(26,22,18,0.18)',
                      backgroundColor: active
                        ? 'rgba(155,122,63,0.04)'
                        : 'transparent',
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: active ? c.bronze : c.ink3,
                    }}
                  />
                  <Frau
                    weight="med"
                    size={12}
                    lineHeight={16}
                    letterSpacing={0.4}
                    color={active ? c.bronze : c.ink2}
                  >
                    {d.label}
                  </Frau>
                </Pressable>
              )
            })}
            {tags.map((t, idx) => (
              <View
                key={t}
                style={[styles.tag, { borderColor: 'rgba(26,22,18,0.18)' }]}
              >
                <Mono
                  size={10}
                  lineHeight={13}
                  letterSpacing={1.4}
                  color={c.ink2}
                >
                  {t.toUpperCase()}
                </Mono>
                <Pressable
                  onPress={() => setTags((s) => s.filter((_, i) => i !== idx))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover tag ${t}`}
                >
                  <Mono size={10} lineHeight={13} color={c.ink3}>
                    ×
                  </Mono>
                </Pressable>
              </View>
            ))}
            <View
              style={[
                styles.addTag,
                { borderColor: 'rgba(168,159,144,0.6)' },
              ]}
            >
              <Frau italic size={13} lineHeight={18} color={c.ink2}>
                + adicionar tag
              </Frau>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SideSheet>
    </>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 32,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerSlot: { flex: 1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { alignItems: 'flex-end' },
  body: { flex: 1 },
  bodyContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  input: {
    fontSize: 17,
    lineHeight: 26,
    paddingHorizontal: 32,
    paddingTop: 22,
    paddingBottom: 16,
    minHeight: 200,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 32,
    paddingTop: 18,
    paddingBottom: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 4,
    borderWidth: 1,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 4,
    borderWidth: 1,
  },
  addTag: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
})
