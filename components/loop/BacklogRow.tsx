import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { StatusDot } from './StatusDot'
import { riskTone } from './loopTone'
import type { AtlasLoopBacklogFinding } from '../../lib/loop'

interface Props {
  finding: AtlasLoopBacklogFinding
}

// One honest "a fazer" row (open finding the loop still has to implement).
// Read-only — the backlog is observational; the operator acts via DECISÕES /
// DIRETIVA / INICIAR. CycleEntry left-rail vocabulary (NOT a TocRow):
//   dot(risk) + Frau title (≤2 lines), then a Mono detail line (route · source).
// Never fabricates a field — absent values are simply dropped.
export function BacklogRow({ finding }: Props) {
  const c = usePalette()

  const title = String(finding.title ?? '').trim() || 'finding sem título'
  const risk = String(finding.risk_level ?? '').trim()
  const route = humanRoute(String(finding.route ?? '').trim())
  const source = String(finding.source_owner ?? finding.source ?? '').trim()
  const tone = risk !== '' ? riskTone(risk, c) : c.ink3

  const detailParts: string[] = []
  if (route !== '') detailParts.push(route)
  if (source !== '') detailParts.push(source)
  const detail = detailParts.join(' · ')

  return (
    <View style={[styles.entry, { borderBottomColor: c.borderSoft }]}>
      <View style={styles.spine}>
        <StatusDot tone={tone} size={6} />
        <Frau weight="med" size={16} lineHeight={22} color={c.ink} numberOfLines={2} style={styles.title}>
          {title}
        </Frau>
      </View>
      {detail !== '' ? (
        <Mono size={11} lineHeight={16} color={c.ink3} numberOfLines={1} style={styles.detail}>
          {detail}
        </Mono>
      ) : null}
    </View>
  )
}

// Map the routing word to a calm human label (never invents one).
function humanRoute(route: string): string {
  switch (route) {
    case '':
      return ''
    case 'atlas_dev':
      return 'dev'
    case 'forge':
      return 'forge'
    case 'self_directed_evolution':
    case 'sde':
      return 'evolução'
    case 'inbox':
      return 'inbox'
    case 'queued':
      return 'na fila'
    default:
      return route.replace(/_/g, ' ')
  }
}

const styles = StyleSheet.create({
  entry: {
    marginHorizontal: 32,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  spine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    flex: 1,
  },
  detail: {
    marginLeft: 14,
  },
})
