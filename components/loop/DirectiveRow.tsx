import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { TocRow } from '../editorial/TocRow'
import { StatusDot } from './StatusDot'
import type { AtlasLoopDirectiveReceipt } from '../../lib/loop'

interface Props {
  directive: AtlasLoopDirectiveReceipt
}

// Section iv history entry (TocRow-shaped). Status reflects ONLY real persisted
// state: "REGISTRADA" (persisted_to:operational_inbox); since
// loop_autonomously_consumable_now is always false -> "REGISTRADA · NÃO
// AUTÔNOMA" (ink3). NEVER "CONSUMIDA"/"ATIVA" without a real consumed signal.
// onPress expands the to_make_loop_consumable steps inline.
export function DirectiveRow({ directive }: Props) {
  const c = usePalette()
  const [expanded, setExpanded] = useState(false)

  // The directive-not-autonomous invariant is encoded in the type:
  // loop_autonomously_consumable_now is `false` by construction (the inbox is
  // not a loop finding source). So the status is ALWAYS the honest "registrada ·
  // não autônoma" — never "CONSUMIDA"/"ATIVA" without a real consumed signal.
  const autonomous: boolean = directive.loop_autonomously_consumable_now
  const statusWord = autonomous ? 'REGISTRADA' : 'REGISTRADA · NÃO AUTÔNOMA'
  const r = directive.to_make_loop_consumable

  return (
    <View>
      <TocRow
        label={truncate(directive.directive, 80)}
        onPress={() => setExpanded((v) => !v)}
        accessibilityLabel={`Diretiva: ${directive.directive}`}
        withLeader
        value={
          <View style={styles.value}>
            <StatusDot tone={autonomous ? c.moss : c.ink3} />
            <Mono size={11} lineHeight={14} letterSpacing={0.2} color={c.ink3}>
              {statusWord}
            </Mono>
          </View>
        }
      />
      {expanded && r != null ? (
        <Animated.View entering={FadeIn.duration(280)} style={styles.steps}>
          <Frau italic size={13} lineHeight={19} color={c.ink2}>
            {`fonte real: ${r.real_finding_source}`}
          </Frau>
          {r.reader ? (
            <Frau italic size={13} lineHeight={19} color={c.ink2}>
              {`leitor: ${r.reader}`}
            </Frau>
          ) : null}
          {Array.isArray(r.required_flags) && r.required_flags.length > 0 ? (
            <Frau italic size={13} lineHeight={19} color={c.ink2}>
              {`flags: ${r.required_flags.join(', ')}`}
            </Frau>
          ) : null}
          {r.operator_step ? (
            <Frau italic size={13} lineHeight={19} color={c.ink2}>
              {r.operator_step}
            </Frau>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  )
}

function truncate(s: string, max: number): string {
  const t = s.trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

const styles = StyleSheet.create({
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  steps: {
    marginHorizontal: 32,
    marginTop: 2,
    marginBottom: 8,
    gap: 2,
  },
})
