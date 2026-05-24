import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasAgendaTask } from '../../lib/api/client'
import { formatDuration, formatRelativeFuture, formatTimeRange } from '../../lib/agenda'
import { PressableSurfaceScale, PressableTextScale } from '../atlas-ui/PressableScale'

interface Props {
  /** Próximo evento futuro · null se não houver. */
  task: AtlasAgendaTask | null
  /** Defaults a `new Date()` · para cálculo de "em N minutos". */
  now?: Date
  /** Tap handler · abre o editor da tarefa. */
  onPress?: () => void
  /** Ações inline · "preparar · começar · adiar". Verbo principal em bronze. */
  onPrepare?: () => void
  onStart?: () => void
  onSnooze?: () => void
}

// AgendaNow · próximo compromisso destacado · seção i. AGORA.
//   eyebrow "próximo · em N minutos"  → mono caps bronze 10
//   time   "15.00 — 16.00 · 60min"    → mono prussian 13 medium
//   title  Frau italic 22 ink         → border-left bronze 2px + drop cap inkCarving
//   actions "preparar · começar · adiar" italic Frau 14 ink2,
//           verbo principal "começar" em bronze medium + haptic Light
//
// Estado vazio: quando task é null, retorna null (silente · canon).
// `app/agenda.tsx` decide se mostra empty state custom.
//
// Round agenda polish · ganhou:
//   – PressableSurfaceScale (scale 0.985 + opacity 0.55 + spring + haptic Soft)
//   – Drop cap canon na primeira letra do título (Frau med 32 bronze inkCarving)
//   – PressableTextScale + haptic em cada action (Light pra "começar" commit)
export function AgendaNow({ task, now = new Date(), onPress, onPrepare, onStart, onSnooze }: Props) {
  const c = usePalette()
  if (!task) return null

  const startISO = task.recommended_start_at ?? task.planned_start_at
  const endISO = task.recommended_end_at ?? task.planned_end_at
  const timeRange = formatTimeRange(startISO, endISO)
  const duration = formatDuration(task.estimated_minutes)
  const relative = formatRelativeFuture(startISO, now)

  const timeFull = timeRange && duration ? `${timeRange} · ${duration}` : timeRange ?? ''
  const firstChar = task.title.charAt(0)
  const restTitle = task.title.slice(1)

  const body = (
    <>
      {relative ? (
        <Mono
          size={10}
          lineHeight={13}
          letterSpacing={1.6}
          color={c.bronze}
          weight="med"
          style={styles.eyebrow}
        >
          {`PRÓXIMO · ${relative.toUpperCase()}`}
        </Mono>
      ) : null}
      {timeFull ? (
        <Mono
          size={13}
          lineHeight={16}
          letterSpacing={0.6}
          color={c.prussian}
          weight="med"
          style={styles.time}
        >
          {timeFull}
        </Mono>
      ) : null}
      <View style={[styles.titleWrap, { borderLeftColor: c.bronze }]}>
        {/* Drop cap canon · nested <Frau> inline (não flex row).
            Em RN, nested Text alinha baseline automaticamente sem hack
            de marginTop/paddingTop. Outer Frau italic 22 dita lineHeight 30;
            inner Frau med 30 upright apenas muda fontSize + color · linha
            única visual, sem layout quebrado no device. */}
        <Frau italic size={22} lineHeight={30} letterSpacing={-0.18} color={c.ink}>
          <Frau
            weight="med"
            size={30}
            color={c.bronze}
            style={{
              textShadowColor: c.inkCarving,
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 0,
            }}
          >
            {firstChar}
          </Frau>
          {restTitle}
        </Frau>
      </View>
      {onPrepare || onStart || onSnooze ? (
        <View style={styles.actionsRow}>
          {onPrepare ? (
            <PressableTextScale
              onPress={onPrepare}
              haptic="soft"
              accessibilityLabel="preparar para o compromisso"
            >
              <Frau italic size={14} lineHeight={20} color={c.ink2}>
                preparar
              </Frau>
            </PressableTextScale>
          ) : null}
          {onPrepare && onStart ? <Dot /> : null}
          {onStart ? (
            <PressableTextScale
              onPress={onStart}
              haptic="light"
              accessibilityLabel="começar agora"
            >
              <Frau italic weight="med" size={14} lineHeight={20} color={c.bronze}>
                começar
              </Frau>
            </PressableTextScale>
          ) : null}
          {onStart && onSnooze ? <Dot /> : null}
          {onSnooze ? (
            <PressableTextScale
              onPress={onSnooze}
              haptic="soft"
              accessibilityLabel="adiar"
            >
              <Frau italic size={14} lineHeight={20} color={c.ink2}>
                adiar
              </Frau>
            </PressableTextScale>
          ) : null}
        </View>
      ) : null}
    </>
  )

  if (onPress) {
    return (
      <PressableSurfaceScale
        onPress={onPress}
        haptic="soft"
        accessibilityLabel={`próximo compromisso: ${task.title}`}
        style={styles.wrap}
      >
        {body}
      </PressableSurfaceScale>
    )
  }
  return <View style={styles.wrap}>{body}</View>
}

function Dot() {
  const c = usePalette()
  return (
    <Frau size={14} lineHeight={20} color={c.ink3} style={styles.dotSep}>
      ·
    </Frau>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 32,
  },
  eyebrow: {
    marginBottom: 12,
  },
  time: {
    marginBottom: 6,
  },
  titleWrap: {
    borderLeftWidth: 2,
    paddingLeft: 14,
    marginLeft: -14,
    marginBottom: 16,
  },
  // titleRow / dropCap / titleBody removidos · drop cap agora vive inline
  // dentro do <Frau> outer via nested Text (sem flex row, sem margens).
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  dotSep: {
    paddingHorizontal: 4,
  },
})
