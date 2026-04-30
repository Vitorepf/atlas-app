import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { SideSheet } from './SideSheet'
import { Scrim } from './Scrim'
import { Frau, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'
import { useShell } from '../AtlasShell'
import { domainColor, type DomainKey } from '../../lib/domains'
import { useAtlasStore } from '../../lib/atlasStore'

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
  const [activeDomain, setActiveDomain] = useState<DomainKey>('blackink')
  const [tags, setTags] = useState<string[]>(['captura', 'ideia'])

  useEffect(() => {
    if (item) {
      setDraft(item.text)
      setActiveDomain(item.domain)
    }
  }, [item])

  return (
    <>
      {/* Scrim under so tapping outside the right-bound sheet is a no-op:
         side sheets exigem botão Voltar. Mantemos só o sheet, sem scrim. */}
      <Scrim visible={false} />
      <SideSheet visible={visible}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Pressable onPress={close} style={({ pressed }) => [styles.headerSlot, { opacity: pressed ? 0.65 : 1 }]}>
            <Sans weight="med" size={15} color={c.ink}>← Voltar</Sans>
          </Pressable>
          <Frau size={24} lineHeight={28} letterSpacing={-0.36} align="center" color={c.ink}>
            Editar captura
          </Frau>
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
            style={({ pressed }) => [styles.headerSlot, styles.headerRight, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Sans weight="med" size={15} color={c.prussian}>Salvar</Sans>
          </Pressable>
        </View>

        <View style={styles.body}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            textAlignVertical="top"
            placeholder="Escreva o que pensa…"
            placeholderTextColor={c.ink3}
            style={[styles.input, { color: c.ink }]}
            selectionColor={c.prussian}
          />
        </View>

        <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.bg }]}>
          {domains.map((d) => {
            const active = d.key === activeDomain
            const accent = domainColor(d.key, c, domains)
            return (
              <Pressable
                key={d.key}
                onPress={() => setActiveDomain(d.key)}
                style={({ pressed }) => [
                  styles.domainTag,
                  {
                    backgroundColor: active ? 'transparent' : c.surface,
                    borderColor: active ? accent : c.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? accent : c.ink3 }} />
                <Sans
                  weight="med"
                  size={12}
                  letterSpacing={0.48}
                  color={active ? accent : c.ink2}
                  style={{ textTransform: 'uppercase' }}
                >
                  {d.label}
                </Sans>
              </Pressable>
            )
          })}
          {tags.map((t, idx) => (
            <View key={t} style={[styles.tag, { borderColor: c.border }]}>
              <Sans
                weight="med"
                size={12}
                letterSpacing={0.36}
                color={c.ink2}
                style={{ textTransform: 'uppercase' }}
              >
                {t}
              </Sans>
              <Pressable onPress={() => setTags((s) => s.filter((_, i) => i !== idx))} hitSlop={8}>
                <Sans size={11} color={c.ink3}>×</Sans>
              </Pressable>
            </View>
          ))}
          <View style={[styles.addTag, { borderColor: c.ink3 }]}>
            <Sans weight="med" size={12} color={c.ink2} letterSpacing={0.24}>
              + Adicionar tag
            </Sans>
          </View>
        </View>
      </SideSheet>
    </>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSlot: { flex: 1 },
  headerRight: { alignItems: 'flex-end' },
  body: { flex: 1 },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 17,
    lineHeight: 26,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
    minHeight: 200,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  domainTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addTag: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
})
