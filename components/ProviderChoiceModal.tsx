import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Frau, Label, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from './AtlasShell'
import { useOverlays } from '../lib/overlays'
import { resumeAiJobChoice, type AtlasAiChoiceOption } from '../lib/api/client'

export function ProviderChoiceModal() {
  const c = usePalette()
  const { showToast } = useShell()
  const open = useOverlays((state) => state.open)
  const jobId = useOverlays((state) => state.providerChoiceJobId)
  const errorCode = useOverlays((state) => state.providerChoiceErrorCode)
  const resetHint = useOverlays((state) => state.providerChoiceResetHint)
  const options = useOverlays((state) => state.providerChoiceOptions)
  const closeProviderChoice = useOverlays((state) => state.closeProviderChoice)

  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const isOpen = open === 'providerChoice' && jobId !== null

  const handlePick = async (option: AtlasAiChoiceOption) => {
    if (!jobId || submittingId) return
    setSubmittingId(option.id)
    try {
      await resumeAiJobChoice(jobId, option.id)
      showToast(`Escolhido: ${option.label}`)
      closeProviderChoice()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao resolver escolha.')
    } finally {
      setSubmittingId(null)
    }
  }

  const headerText =
    errorCode === 'auth_expired'
      ? 'Login expirado'
      : `Sem créditos${resetHint ? ` até ${resetHint}` : ''}`

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={closeProviderChoice}>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Label color={c.ink2} style={styles.eyebrow}>
            ATLAS PRECISA DE UMA DECISÃO
          </Label>
          <Frau size={22} lineHeight={28} color={c.ink}>
            {headerText}
          </Frau>

          <ScrollView style={styles.options} contentContainerStyle={styles.optionsContent}>
            {options.map((option) => {
              const isSubmitting = submittingId === option.id
              return (
                <Pressable
                  key={option.id}
                  onPress={() => handlePick(option)}
                  disabled={Boolean(submittingId)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: pressed ? c.premium : c.bg,
                      borderColor: c.border,
                      opacity: submittingId && !isSubmitting ? 0.5 : 1,
                    },
                  ]}
                >
                  <View style={styles.optionRow}>
                    <Sans size={15} lineHeight={20} color={c.ink} style={styles.optionLabel}>
                      {option.label}
                    </Sans>
                    {isSubmitting ? <ActivityIndicator size="small" color={c.ink} /> : null}
                  </View>
                  {option.description ? (
                    <Sans size={13} lineHeight={18} color={c.ink2} style={styles.optionDesc}>
                      {option.description}
                    </Sans>
                  ) : null}
                </Pressable>
              )
            })}
          </ScrollView>

          <Pressable
            onPress={closeProviderChoice}
            disabled={Boolean(submittingId)}
            style={({ pressed }) => [
              styles.footerButton,
              { backgroundColor: pressed ? c.premium : 'transparent', borderColor: c.border },
            ]}
          >
            <Sans size={13} color={c.ink3}>
              Fechar (decidir depois)
            </Sans>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
  },
  eyebrow: {
    marginBottom: 6,
  },
  options: {
    marginTop: 18,
    maxHeight: 360,
  },
  optionsContent: {
    gap: 10,
    paddingBottom: 4,
  },
  option: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    flex: 1,
    paddingRight: 8,
  },
  optionDesc: {
    marginTop: 4,
  },
  footerButton: {
    marginTop: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    alignItems: 'center',
  },
})
