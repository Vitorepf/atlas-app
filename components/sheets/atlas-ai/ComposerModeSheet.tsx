/**
 * Slice 6d · Dedicated bottom sheet picker para mode.
 *
 * Substitui a routing sheet genérica heavyweight quando user toca no mode pill.
 * Premium UX: BottomSheet 40% height · radio options canon · ✦ marca seleção
 * atual · DividerEditorial entre opções.
 *
 * Mobile V2 contract suporta 12 modos + auto. Mantido como sheet dedicado
 * para surfaces futuras; a tela principal hoje usa AtlasDecideSheet full.
 */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Frau, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type { RoutingMode } from '../../console/StatusRouting'
import { BottomSheet } from '../BottomSheet'
import { SheetHeading } from './AtlasAiDataPrimitives'

interface ModeOption {
  value: RoutingMode
  label: string
  description: string
}

const MODE_OPTIONS: ReadonlyArray<ModeOption> = [
  {
    value: 'auto',
    label: 'auto',
    description: 'Hyperflow decide domínio, flow e runtime',
  },
  {
    value: 'general',
    label: 'geral',
    description: 'pesquisa, ideias, dúvidas · contexto leve',
  },
  {
    value: 'conversation',
    label: 'conversa',
    description: 'troca livre sem domínio técnico forçado',
  },
  {
    value: 'operational',
    label: 'operacional',
    description: 'diagnóstico, próxima ação, risco · bundle operacional',
  },
  {
    value: 'programming',
    label: 'programação',
    description: 'Atlas Dev · bugs, debug, review, features · workspace',
  },
  {
    value: 'research',
    label: 'pesquisa',
    description: 'investigação técnica, mercado, literatura',
  },
  {
    value: 'finance',
    label: 'finanças',
    description: 'carteira, empresas, risco, decisão financeira',
  },
  {
    value: 'marketing',
    label: 'marketing',
    description: 'campanha, copy, métricas e marca',
  },
  {
    value: 'strategy',
    label: 'estratégia',
    description: 'prioridade, trade-off e decisão',
  },
  {
    value: 'personal_development',
    label: 'pessoal',
    description: 'metas, hábitos, rotina e cognição',
  },
  {
    value: 'cyber',
    label: 'cyber',
    description: 'segurança defensiva, auditoria e resposta',
  },
  {
    value: 'automation',
    label: 'automação',
    description: 'workflows, integrações, scripts e pipelines',
  },
]

interface Props {
  visible: boolean
  selected: RoutingMode
  onSelect: (mode: RoutingMode) => void
  onClose: () => void
}

export function ComposerModeSheet({ visible, selected, onSelect, onClose }: Props) {
  const { c } = useTheme()

  return (
    <BottomSheet visible={visible} onClose={onClose} height="40%">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SheetHeading title="Modo" subtitle="define como Atlas processa esta conversa" />

        <View style={styles.optionsGroup}>
          {MODE_OPTIONS.map((option, index) => {
            const isSelected = option.value === selected
            const isLast = index === MODE_OPTIONS.length - 1
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
