import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { fonts, radii } from '../../design/tokens'
import { PressableTextScale } from '../atlas-ui/PressableScale'
import { RiskSelector } from './RiskSelector'
import { DirectiveHonestyBand } from './DirectiveHonestyBand'
import { directiveErrorMessage } from './loopTypes'
import type {
  AtlasLoopDirectiveConsumability,
  AtlasLoopDirectiveReceipt,
  AtlasLoopRiskLevel,
} from '../../lib/loop'
import { AtlasApiError } from '../../lib/api/client'

interface Props {
  /** Submit → POST directive; resolves to the receipt (with to_make_loop_consumable). */
  onSubmit: (body: {
    directive: string
    risk: AtlasLoopRiskLevel
    target_doc?: string
  }) => Promise<AtlasLoopDirectiveReceipt>
  disabled?: boolean
  /** Fed from the last POST response's to_make_loop_consumable (real recipe). */
  lastReachability?: AtlasLoopDirectiveConsumability | null
}

const PLACEHOLDER = 'foca em…  ·  para de…  ·  prioriza…'

// Section iv correspondence well · a SUNKEN field you PEN a directive into (not a
// chatbox). Multiline TextInput in FRAUNCES SERIF, bronze caret. RiskSelector
// inline. Submit disabled until non-empty. The PERMANENT honesty band sits
// directly below (never collapsed). On 201 clears + the parent toasts/prepends;
// on 422 an inline recRed line, field retains text. Always interactive.
export function DirectiveComposer({ onSubmit, disabled = false, lastReachability }: Props) {
  const c = usePalette()
  const [text, setText] = useState('')
  const [risk, setRisk] = useState<AtlasLoopRiskLevel>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = text.trim() !== '' && !disabled && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ directive: text.trim(), risk })
      setText('') // weighted settle handled by the parent prepend animation
    } catch (e) {
      setError(extractError(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View>
      <View style={[styles.well, { backgroundColor: c.bgRecessed, borderColor: c.border }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={PLACEHOLDER}
          placeholderTextColor={c.ink3}
          multiline
          editable={!disabled}
          selectionColor={c.bronze}
          cursorColor={c.bronze}
          style={[styles.input, { color: c.ink }]}
        />
        <View style={styles.controls}>
          <RiskSelector value={risk} onChange={setRisk} />
        </View>
        <View style={[styles.submitRow, { borderTopColor: c.borderSoft }]}>
          <PressableTextScale
            onPress={() => void submit()}
            disabled={!canSubmit}
            haptic="light"
            accessibilityLabel="enviar diretiva"
          >
            <Mono size={12} lineHeight={16} letterSpacing={0.6} color={c.bronze}>
              {submitting ? 'ENVIANDO…' : 'ENVIAR DIRETIVA'}
            </Mono>
          </PressableTextScale>
        </View>
      </View>

      {/* 422 inline (field retains text) */}
      {error !== null ? (
        <Frau italic size={13} lineHeight={19} color={c.recRed} style={styles.error}>
          {error}
        </Frau>
      ) : null}

      {/* command unreachable — can draft, cannot lie about delivery */}
      {disabled ? (
        <Mono size={11} lineHeight={15} color={c.ink3} style={styles.unavailable}>
          comando indisponível
        </Mono>
      ) : null}

      {/* PERMANENT honesty band */}
      <DirectiveHonestyBand reachability={lastReachability} />
    </View>
  )
}

function extractError(e: unknown): string {
  if (e instanceof AtlasApiError) {
    const payload = e.payload as { reason?: string; detail?: string } | null
    if (payload?.reason) return directiveErrorMessage(payload.reason)
    if (payload?.detail) return payload.detail
  }
  return 'Não foi possível registrar a diretiva.'
}

const styles = StyleSheet.create({
  well: {
    marginHorizontal: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  input: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  controls: {
    gap: 8,
  },
  submitRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  error: {
    marginHorizontal: 32,
    marginTop: 8,
  },
  unavailable: {
    marginHorizontal: 32,
    marginTop: 8,
  },
})
