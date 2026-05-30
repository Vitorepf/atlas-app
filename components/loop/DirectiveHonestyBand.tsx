import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasLoopDirectiveConsumability } from '../../lib/loop'

interface Props {
  reachability?: AtlasLoopDirectiveConsumability | null
}

// Permanent honesty disclosure · equal presence to the composer (NOT fine print).
// Mirrors loop_autonomously_consumable_now:false + to_make_loop_consumable. The
// dossier REFUSES to imply silent injection. After a POST, the caption is
// populated with the EXACT machine-readable steps from the response.
export function DirectiveHonestyBand({ reachability }: Props) {
  const c = usePalette()

  const caption =
    reachability != null
      ? buildCaption(reachability)
      : 'PARA O LOOP CONSUMIR: vire uma linha de frontmatter no doc canônico da área + ative os flags.'

  return (
    <View style={styles.wrap}>
      <Frau italic size={13} lineHeight={19} color={c.ink2}>
        A diretiva é registrada na caixa operacional para sua revisão. O loop não a consome sozinho.
      </Frau>
      <Mono size={11} lineHeight={15} letterSpacing={0.3} color={c.ink3} style={styles.caption}>
        {caption}
      </Mono>
    </View>
  )
}

function buildCaption(r: AtlasLoopDirectiveConsumability): string {
  const flags = Array.isArray(r.required_flags) ? r.required_flags.join(' + ') : ''
  const parts = [
    `FONTE REAL: ${r.real_finding_source}`,
    flags !== '' ? `FLAGS: ${flags}` : '',
    r.operator_step ? r.operator_step.toUpperCase() : '',
  ].filter((p) => p !== '')
  return parts.join(' · ')
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 32,
    marginTop: 12,
    gap: 6,
  },
  caption: {
    marginTop: 2,
  },
})
