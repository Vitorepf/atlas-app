/**
 * Slice 6d · Dedicated bottom sheet picker para runtime/modelo.
 *
 * Substitui a routing sheet genérica heavyweight quando user toca no runtime/modelo
 * pill. Premium UX: BottomSheet 50% height · 5 opções canon · marca
 * selecionado · descrições editoriais.
 *
 * Espelha PROVIDER_OPTIONS do contract canon `lib/atlasAi/contract.ts:33-43`.
 */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Frau, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type { RoutingExecutor } from '../../console/StatusRouting'
import { BottomSheet } from '../BottomSheet'
import { SheetHeading } from './AtlasAiDataPrimitives'

interface ProviderOption {
  value: RoutingExecutor
  label: string
  description: string
}

/**
 * 5 opções canon · alinhado com PROVIDER_OPTIONS V2 do contract.
 */
const PROVIDER_OPTIONS: ReadonlyArray<ProviderOption> = [
  {
    value: 'auto',
    label: 'auto',
    description: 'Atlas roteia runtime/modelo; Hermes é o padrão executivo quando fizer sentido',
  },
  {
    value: 'hermes_cli',
    label: 'hermes',
    description: 'Runtime executivo · escolhe ferramentas, skills e modelo interno',
  },
  {
    value: 'minimax_m27_cli',
    label: 'minimax m3',
    description: 'Modelo direto no ATLS · resposta independente',
  },
  {
    value: 'codex_cli',
    label: 'codex',
    description: 'Rota técnica especializada · engenharia e revisão',
  },
  {
    value: 'claude_cli',
    label: 'claude',
    description: 'Rota manual especializada · julgamento e arquitetura',
  },
]

interface Props {
  visible: boolean
  selected: RoutingExecutor
  onSelect: (provider: RoutingExecutor) => void
  onClose: () => void
}

export function ComposerProviderSheet({ visible, selected, onSelect, onClose }: Props) {
  const { c } = useTheme()

  return (
    <BottomSheet visible={visible} onClose={onClose} height="40%">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SheetHeading title="Runtime / modelo" subtitle="Hermes e MiniMax M3 são opções separadas" />

        <View style={styles.optionsGroup}>
          {PROVIDER_OPTIONS.map((option, index) => {
            const isSelected = option.value === selected
            const isLast = index === PROVIDER_OPTIONS.length - 1
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onSelect(option.value)
                  onClose()
                }}
                accessibilityRole="button"
                accessibilityLabel={`${option.label} · ${option.description}${isSelected ? ' · selecionado' : ''}`}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: pressed ? c.bgRaised : 'transparent',
                    borderBottomColor: c.border,
                    borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View style={styles.optionBody}>
                  <View style={styles.optionTitleRow}>
                    <Frau
                      italic
                      weight={isSelected ? 'med' : 'reg'}
                      size={17}
                      lineHeight={22}
                      color={isSelected ? c.ink : c.ink2}
                    >
                      {option.label}
                    </Frau>
                    {isSelected ? (
                      <Frau
                        italic
                        weight="med"
                        size={14}
                        lineHeight={18}
                        color={c.bronze}
                        style={styles.selectedGlyph}
                      >
                        ✦
                      </Frau>
                    ) : null}
                  </View>
                  <Sans
                    size={13}
                    lineHeight={18}
                    color={c.ink3}
                    style={styles.optionDescription}
                  >
                    {option.description}
                  </Sans>
                </View>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  optionsGroup: {
    marginTop: 12,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  optionBody: {
    gap: 4,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  selectedGlyph: {
    opacity: 0.92,
  },
  optionDescription: {
    opacity: 0.85,
  },
})
