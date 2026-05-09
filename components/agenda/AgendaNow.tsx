import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasAgendaTask } from '../../lib/api/client'
import { formatDuration, formatRelativeFuture, formatTimeRange } from '../../lib/agenda'

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
//   title  Frau italic 22 ink         → border-left bronze 2px
//   context Frau italic 14 ink2       → "sala de cobre" (TODO: schema)
//   actions "preparar · começar · adiar" Frau italic 14 ink2,
//           verbo principal "começar" em bronze medium
//
// Estado vazio: quando task é null, retorna null (silente · canon).
// `app/agenda.tsx` decide se mostra empty state custom (Frau italic
// "Sem próximo compromisso." ou silêncio estrutural).
export function AgendaNow({ task, now = new Date(), onPress, onPrepare, onStart, onSnooze }: Props) {
  const c = usePalette()
  if (!task) return null

  const startISO = task.recommended_start_at ?? task.planned_start_at
  const endISO = task.recommended_end_at ?? task.planned_end_at
  const timeRange = formatTimeRange(startISO, endISO)
  const duration = formatDuration(task.estimated_minutes)
  const relative = formatRelativeFuture(startISO, now)

  const timeFull = timeRange && duration ? `${timeRange} · ${duration}` : timeRange ?? ''

  // TODO(schema): `agenda-now-context` ("sala de cobre · trazer notebook ·
  // pauta no Codex") precisa de campos `location`/`notes` em AtlasAgendaTask.
  // Hoje renderizamos vazio. Description não cabe — costuma ser longa.

  const Wrapper = onPress ? Pressable : View
  const wrapperProps = onPress
    ? {
        onPress,
        accessibilityRole: 'button' as const,
        accessibilityLabel: `Próximo compromisso: ${task.title}`,
        style: ({ pressed }: { pressed: boolean }) => [
          styles.wrap,
          { opacity: pressed ? 0.55 : 1 },
        ],
      }
    : { style: styles.wrap }

  return (
    <Wrapper {...wrapperProps}>
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
        <Frau italic size={22} lineHeight={28} letterSpacing={-0.18} color={c.ink}>
          {task.title}
        </Frau>
      </View>
      {/* Context · TODO(schema): location/notes do task quando existir.
          Por enquanto silente — sem fake. */}
      {onPrepare || onStart || onSnooze ? (
        <View style={styles.actionsRow}>
          {onPrepare ? (
            <Pressable
              onPress={onPrepare}
              accessibilityRole="button"
              accessibilityLabel="Preparar para o compromisso"
              style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
            >
              <Frau italic size={14} lineHeight={20} color={c.ink2}>
                preparar
              </Frau>
            </Pressable>
          ) : null}
          {onPrepare && onStart ? <Dot /> : null}
          {onStart ? (
            <Pressable
              onPress={onStart}
              accessibilityRole="button"
              accessibilityLabel="Começar agora"
              style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
            >
              <Frau italic weight="med" size={14} lineHeight={20} color={c.bronze}>
                começar
              </Frau>
            </Pressable>
          ) : null}
          {onStart && onSnooze ? <Dot /> : null}
          {onSnooze ? (
            <Pressable
              onPress={onSnooze}
              accessibilityRole="button"
              accessibilityLabel="Adiar"
              style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
            >
              <Frau italic size={14} lineHeight={20} color={c.ink2}>
                adiar
              </Frau>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Wrapper>
  )
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  dotSep: {
    paddingHorizontal: 4,
  },
})
