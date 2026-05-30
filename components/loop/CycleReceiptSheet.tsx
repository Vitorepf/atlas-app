import { ScrollView, StyleSheet, View } from 'react-native'
import { Frau, Label, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { BottomSheet } from '../sheets/BottomSheet'
import { LoopStatusPill } from './LoopStatusPill'
import { Metric } from './Metric'
import { statusColor } from './loopTone'
import { relativeTime } from './loopFormat'
import type { AtlasLoopCycleRecord } from '../../lib/loop'

interface Props {
  record: AtlasLoopCycleRecord | null
  visible: boolean
  onClose: () => void
}

// Full receipt · BottomSheet host. The receipt fields are already in the ledger
// record (no extra fetch). Dossier blocks: header / GATES / DIFF / BLOQUEIO REAL
// (verbatim) / PROVENIÊNCIA (selectable for audit-copy). Motion = spring.sheet;
// inner content STATIC. Honest: blockers verbatim, never softened.
export function CycleReceiptSheet({ record, visible, onClose }: Props) {
  const c = usePalette()

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      {record === null ? null : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Mono size={12} lineHeight={17} letterSpacing={0.3} color={c.bronze}>
                {`C${record.cycle_index}`}
              </Mono>
              <LoopStatusPill compact outcome={String(record.outcome ?? '')} />
            </View>
            <Mono size={11} lineHeight={16} color={c.ink3}>
              {relativeTime(record.recorded_at)}
            </Mono>
          </View>
          <Frau weight="med" size={18} lineHeight={25} color={c.ink} style={styles.title}>
            {(record.finding_key ?? '').trim() !== '' ? record.finding_key : 'ciclo sem finding nomeado'}
          </Frau>

          {/* GATES — acceptance basis as leader rows */}
          <Section label="GATES">
            <Row name="status final" value={String(record.cycle_final_status ?? '—')} tone={record.cycle_final_status} />
            <Row name="sessão" value={String(record.session_status ?? '—')} tone={record.session_status} />
            <Row
              name="integridade do recibo"
              value={String(record.loop_receipt_integrity ?? '—')}
              tone={record.loop_receipt_integrity}
            />
            <Row name="classe" value={String(record.work_class ?? '—')} />
          </Section>

          {/* DIFF — Metric strip or honest "sem diff" */}
          <Section label="DIFF">
            {record.merge_performed && String(record.merge_hash ?? '').trim() !== '' ? (
              <View style={styles.metrics}>
                <Metric label="merge" value={`#${String(record.merge_hash).slice(0, 7)}`} tone="merged" />
                <Metric label="merges totais" value={String(record.cumulative?.merges_total ?? 0)} tone="merged" />
                <Metric label="ciclos no run" value={String(record.cumulative?.cycles_this_run ?? 0)} />
              </View>
            ) : (
              <Frau italic size={14} lineHeight={20} color={c.ink2} style={styles.rail}>
                sem diff registrado
              </Frau>
            )}
          </Section>

          {/* BLOQUEIO REAL — full blockers, verbatim, never softened */}
          {blockers(record).length > 0 ? (
            <Section label="BLOQUEIO REAL">
              {blockers(record).map((b, i) => (
                <Mono
                  key={i}
                  size={12}
                  lineHeight={18}
                  color={String(record.outcome) === 'bug' ? c.recRed : c.amber}
                  style={styles.blocker}
                  selectable
                >
                  {`· ${b}`}
                </Mono>
              ))}
            </Section>
          ) : null}

          {/* PROVENIÊNCIA — selectable for audit-copy */}
          <Section label="PROVENIÊNCIA">
            <Row name="run" value={String(record.run_id ?? '—')} selectable />
            <Row name="ciclo" value={String(record.cycle_id ?? '—')} selectable />
            <Row
              name="workcell multi-agente"
              value={record.multi_agent_workcell?.present === true ? 'presente' : 'ausente'}
              tone={record.multi_agent_workcell?.present === true ? 'merged' : null}
            />
            <Row name="recibo do loop" value={String(record.loop_receipt_hash ?? '—')} selectable />
            {String(record.inbox_item_id ?? '').trim() !== '' ? (
              <Row name="item de inbox" value={String(record.inbox_item_id)} selectable />
            ) : null}
          </Section>

          <Mono size={10} lineHeight={14} letterSpacing={1.2} color={c.ink3} style={styles.foot}>
            SOMENTE LEITURA · ESTE RECIBO NUNCA EXECUTA NEM FAZ MERGE
          </Mono>
        </ScrollView>
      )}
    </BottomSheet>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const c = usePalette()
  return (
    <View style={styles.section}>
      <Label color={c.ink3} style={styles.rail}>
        {label}
      </Label>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function Row({
  name,
  value,
  tone,
  selectable,
}: {
  name: string
  value: string
  tone?: string | null
  selectable?: boolean
}) {
  const c = usePalette()
  return (
    <View style={[styles.kv, { borderBottomColor: c.borderSoft }]}>
      <Frau size={14} lineHeight={20} color={c.ink2}>
        {name}
      </Frau>
      <Mono
        size={12}
        lineHeight={18}
        color={tone != null ? statusColor(tone, c) : c.ink}
        style={styles.kvValue}
        numberOfLines={2}
        selectable={selectable}
      >
        {value}
      </Mono>
    </View>
  )
}

function blockers(record: AtlasLoopCycleRecord): string[] {
  return Array.isArray(record.blockers) ? record.blockers.map((b) => String(b)).filter((b) => b.trim() !== '') : []
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    marginTop: 10,
  },
  section: {
    marginTop: 24,
    gap: 8,
  },
  sectionBody: {
    gap: 0,
  },
  rail: {
    marginLeft: 0,
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
  },
  kv: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kvValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  blocker: {
    marginTop: 4,
  },
  foot: {
    marginTop: 28,
  },
})
