import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Frau, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { useAtlasStore } from '../../lib/atlasStore'
import type { Domain } from '../../lib/domains'

type DomainSensitivity = 'normal' | 'private' | 'sensitive'

const SENSITIVITY_OPTIONS: Array<{ key: DomainSensitivity; label: string }> = [
  { key: 'normal', label: 'Normal' },
  { key: 'private', label: 'Privado' },
  { key: 'sensitive', label: 'Sensível' },
]

const COLOR_PRESETS = [
  { light: '#1B3A57', dark: '#6892B5' },
  { light: '#5D4A8A', dark: '#B6A6E8' },
  { light: '#4A5D3A', dark: '#7A9A65' },
  { light: '#9B7A3F', dark: '#C9A663' },
  { light: '#6B6358', dark: '#A89F90' },
  { light: '#7A3F54', dark: '#D4879C' },
  { light: '#355C62', dark: '#7FB4BD' },
]

interface Props {
  onCreated?: (domain: Domain) => void
}

export function CreateDomainPanel({ onCreated }: Props) {
  const c = usePalette()
  const createDomain = useAtlasStore((s) => s.createDomain)
  const [expanded, setExpanded] = useState(false)
  const [label, setLabel] = useState('')
  const [sensitivity, setSensitivity] = useState<DomainSensitivity>('normal')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (creating) return

    const cleanLabel = label.trim()
    const slug = slugFromLabel(cleanLabel)
    if (cleanLabel.length < 2 || slug.length < 2) {
      setError('Informe um nome com pelo menos 2 caracteres.')
      return
    }

    setCreating(true)
    setError(null)

    const colors = colorsForSlug(slug)
    const created = await createDomain({
      slug,
      label: cleanLabel,
      description: `Capturas sobre ${cleanLabel}.`,
      color_light: colors.light,
      color_dark: colors.dark,
      default_sensitivity: sensitivity,
      external_ai_policy: sensitivity === 'normal' ? 'allow' : 'block_private_sensitive',
      sort_order: 500,
      active: true,
      metadata: { created_from: 'atlas_app' },
    })

    setCreating(false)
    if (!created) {
      setError(useAtlasStore.getState().lastError ?? 'Não foi possível criar o domínio.')
      return
    }

    setLabel('')
    setSensitivity('normal')
    setExpanded(false)
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onCreated?.(created)
  }

  if (!expanded) {
    // v18 canon Atlas · link editorial inline (não SaaS button). Vocabulário
    // "+ novo domínio" italic Frau bronze · sem background/border/radius.
    // Aparece centralizado abaixo dos domains · respira no papel cream.
    return (
      <Pressable
        onPress={() => {
          setExpanded(true)
          setError(null)
        }}
        hitSlop={8}
        style={({ pressed }) => [
          styles.newLink,
          { opacity: pressed ? 0.55 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="adicionar novo domínio"
      >
        <Frau italic size={14} lineHeight={20} color={c.bronze}>
          + novo domínio
        </Frau>
      </Pressable>
    )
  }

  return (
    <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Mono size={10.5} letterSpacing={0.42} color={c.ink2}>
        NOVO DOMÍNIO
      </Mono>

      <TextInput
        value={label}
        onChangeText={(value) => {
          setLabel(value)
          setError(null)
        }}
        placeholder="Nome do domínio"
        placeholderTextColor={c.ink3}
        autoCapitalize="words"
        autoCorrect={false}
        selectionColor={c.prussian}
        style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.bg }]}
      />

      <View style={styles.sensitivityRow}>
        {SENSITIVITY_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setSensitivity(option.key)}
            style={({ pressed }) => [
              styles.sensitivityChip,
              {
                borderColor: sensitivity === option.key ? c.bronze : c.border,
                backgroundColor: sensitivity === option.key ? c.bg : 'transparent',
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Sans weight="med" size={12} color={sensitivity === option.key ? c.bronze : c.ink2}>
              {option.label}
            </Sans>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Sans size={12} lineHeight={17} color={c.recRed}>
          {error}
        </Sans>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            setExpanded(false)
            setError(null)
          }}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.65 : 1 }]}
        >
          <Sans weight="med" size={13} color={c.ink2}>
            Cancelar
          </Sans>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={creating}
          style={({ pressed }) => [
            styles.action,
            styles.primaryAction,
            { backgroundColor: c.ink, opacity: creating || pressed ? 0.72 : 1 },
          ]}
        >
          <Sans weight="sb" size={13} color={c.onInk}>
            {creating ? 'Criando...' : 'Criar'}
          </Sans>
        </Pressable>
      </View>
    </View>
  )
}

function slugFromLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 48)
}

function colorsForSlug(slug: string): { light: string; dark: string } {
  const hash = Array.from(slug).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return COLOR_PRESETS[hash % COLOR_PRESETS.length]
}

const styles = StyleSheet.create({
  // v18 canon · link editorial inline · sem background/border/radius SaaS.
  // marginTop 18 dá respiro entre último domain e o link. paddingVertical 10
  // garante hit area decente (~40pt total com a typography).
  newLink: {
    marginTop: 18,
    paddingVertical: 10,
    alignItems: 'center',
  },
  panel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
    marginTop: 12,
  },
  input: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  sensitivityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sensitivityChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  action: {
    minHeight: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryAction: {
    minWidth: 76,
  },
})
