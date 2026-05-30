import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { PressableSurfaceScale } from '../atlas-ui/PressableScale'
import { StatusDot } from './StatusDot'
import { ProofChip } from './ProofChip'
import { MergeHashChip } from './MergeHashChip'
import { statusColor } from './loopTone'
import type { AtlasLoopCycleRecord } from '../../lib/loop'

interface Props {
  record: AtlasLoopCycleRecord
  isNewest: boolean
  onOpenReceipt: (record: AtlasLoopCycleRecord) => void
}

// Section ii timeline unit (NOT a TocRow). Three left-rail lines:
//   1 spine  — dot(outcome) + "C{index}" + Frau finding title
//   2 basis  — outcome word · #merge · ProofChip · acceptance basis
//   3 blocker — verbatim blockers[0] (only when blocked/bug/quarantined)
// The newest entry gets ONE bronze top edge (fresh-capture vocabulary). NO
// motion. Honest: proof only when real, blocker never hidden.
export function CycleEntry({ record, isNewest, onOpenReceipt }: Props) {
  const c = usePalette()

  const outcome = String(record.outcome ?? '')
  const dotTone = outcomeDotTone(outcome, c)
  const title = (record.finding_key ?? '').trim()
  const isFault = ['blocked', 'bug', 'quarantined'].includes(outcome) || record.quarantined === true
  const proven = isProven(record)
  const blockers = Array.isArray(record.blockers) ? record.blockers.filter((b) => String(b).trim() !== '') : []
  const integrity = String(record.loop_receipt_integrity ?? '').trim()

  return (
    <PressableSurfaceScale
      onPress={() => onOpenReceipt(record)}
      haptic="soft"
      accessibilityLabel={`Abrir recibo do ciclo C${record.cycle_index}, ${outcomeWord(outcome)}.`}
      style={[
        styles.entry,
        { borderBottomColor: c.borderSoft },
        isNewest && { borderTopColor: c.bronzeBorder, borderTopWidth: 1 },
      ]}
    >
      {/* LINE 1 · spine */}
      <View style={styles.spine}>
        <StatusDot tone={dotTone} size={6} />
        <Mono size={11} lineHeight={16} letterSpacing={0.3} color={c.bronze}>
          {`C${record.cycle_index}`}
        </Mono>
        <Frau weight="med" size={16} lineHeight={22} color={c.ink} numberOfLines={2} style={styles.title}>
          {title !== '' ? title : 'ciclo sem finding nomeado'}
        </Frau>
      </View>

      {/* LINE 2 · basis */}
      <View style={styles.basis}>
        <Mono size={12} lineHeight={17} color={c.ink2} numberOfLines={1} style={styles.basisText}>
          {outcomeWord(outcome)}
        </Mono>
        {record.merge_performed && String(record.merge_hash ?? '').trim() !== '' ? (
          <MergeHashChip hash={String(record.merge_hash)} />
        ) : null}
        <ProofChip proven={proven} />
        {integrity !== '' ? (
          <Mono size={11} lineHeight={16} color={c.ink3} numberOfLines={1}>
            {integrity === 'intact' || integrity === 'integro' ? 'íntegro' : integrity}
          </Mono>
        ) : null}
      </View>

      {/* quarantine / repair tag — self-correction visible honestly */}
      {record.quarantined === true || record.repaired === true ? (
        <Mono size={11} lineHeight={15} letterSpacing={0.3} color={c.bronze} style={styles.tag}>
          {record.quarantined === true
            ? `quarentena${String(record.quarantine_reason ?? '').trim() !== '' ? ` · ${record.quarantine_reason}` : ''}`
            : 'reparado'}
        </Mono>
      ) : null}

      {/* LINE 3 · the real blocker (verbatim, never hidden) */}
      {isFault && blockers.length > 0 ? (
        <View style={styles.blockerRow}>
          <View style={[styles.tick, { backgroundColor: c.bronze }]} />
          <View style={styles.blockerTextWrap}>
            <Frau
              italic
              size={14}
              lineHeight={20}
              color={outcome === 'bug' ? c.recRed : c.amber}
              numberOfLines={2}
            >
              {String(blockers[0])}
            </Frau>
            {blockers.length > 1 ? (
              <Mono size={11} lineHeight={15} color={c.ink3}>
                {`+${blockers.length - 1} mais`}
              </Mono>
            ) : null}
          </View>
        </View>
      ) : null}
    </PressableSurfaceScale>
  )
}

function outcomeDotTone(outcome: string, c: ReturnType<typeof usePalette>): string {
  switch (outcome) {
    case 'merged':
      return c.moss
    case 'blocked':
      return c.amber
    case 'bug':
    case 'quarantined':
      return c.recRed
    case 'progress':
      return c.prussian
    case 'repeated_finding':
      return c.ink3
    default:
      return statusColor(outcome, c)
  }
}

function outcomeWord(outcome: string): string {
  switch (outcome) {
    case 'merged':
      return 'merged'
    case 'blocked':
      return 'bloqueado'
    case 'progress':
      return 'progresso'
    case 'bug':
      return 'defeito'
    case 'repeated_finding':
      return 'repetido'
    case 'quarantined':
      return 'quarentena'
    default:
      return outcome || '—'
  }
}

// Real provider-proof only: the workcell present flag (or an explicit proof field).
function isProven(record: AtlasLoopCycleRecord): boolean {
  if (record.multi_agent_workcell?.present === true) return true
  const proof = (record as Record<string, unknown>)['provider_proof'] ?? (record as Record<string, unknown>)['proof']
  return proof != null && proof !== false && proof !== ''
}

const styles = StyleSheet.create({
  entry: {
    paddingVertical: 12,
    marginHorizontal: 32,
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
  basis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  basisText: {
    flexShrink: 1,
  },
  tag: {
    marginTop: 2,
  },
  blockerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  tick: {
    width: 2,
    height: 14,
    marginTop: 3,
  },
  blockerTextWrap: {
    flex: 1,
    gap: 2,
  },
})
