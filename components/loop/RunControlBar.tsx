import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { radii } from '../../design/tokens'
import { PressablePillScale, PressableTextScale } from '../atlas-ui/PressableScale'
import { StatusDot } from './StatusDot'
import { RunControlConfirmStrip } from './RunControlConfirmStrip'
import { loopStateWord, loopTone, type LoopState } from './loopTone'
import type { AtlasLoopRunControlAction } from '../../lib/loop'

interface Props {
  loopState: LoopState
  runState: { paused: boolean; killed: boolean; hasActiveRun: boolean }
  driftDesviado?: boolean
  killArmed?: boolean
  /** Re-reads TRUE state from response; NEVER optimistic. */
  onControl: (action: AtlasLoopRunControlAction, reason?: string) => Promise<void>
  busyAction?: string | null
}

type Mode = 'idle' | 'confirmKill' | 'confirmClearKill'

// Section v lever (last, follows comprehension). NOT four equal buttons. A
// primary + a destructive zone that reflects TRUE state and NEVER lies:
//   alive/blocked/bug -> PAUSAR + ENCERRAR
//   paused            -> RETOMAR + ENCERRAR + "honra na próxima fronteira" banner
//   killed            -> ONLY LIBERAR ENCERRAMENTO + recRed banner (pause/resume HIDDEN)
//   idle/no_signal    -> all DISABLED + "sem run ativo para controlar"
// The TOP line restates the live truth and MUST equal the masthead pill.
export function RunControlBar({
  loopState,
  runState,
  driftDesviado = false,
  killArmed = false,
  onControl,
  busyAction = null,
}: Props) {
  const c = usePalette()
  const [mode, setMode] = useState<Mode>('idle')
  const [reason, setReason] = useState('')

  const tone = loopTone(loopState, c)
  const busy = busyAction !== null
  const isLoading = loopState === 'loading'
  const noSignal = loopState === 'no_signal'
  const idleNoRun = loopState === 'idle' || !runState.hasActiveRun
  const killed = loopState === 'killed'
  const paused = loopState === 'paused'
  const active = loopState === 'alive' || loopState === 'blocked' || loopState === 'bug'

  // The lever subtly bridges when the system suggests encerrar (never auto-acts).
  const suggestKill = driftDesviado && killArmed

  const confirmKill = async (r?: string) => {
    await onControl('kill', r)
    setMode('idle')
    setReason('')
  }
  const confirmClearKill = async (r?: string) => {
    await onControl('clear-kill', r)
    setMode('idle')
    setReason('')
  }
  const cancel = () => {
    setMode('idle')
    setReason('')
  }

  return (
    <View style={[styles.bar, { borderColor: c.border, backgroundColor: c.bg }]}>
      {/* TOP line — MUST equal the masthead pill */}
      <View style={styles.topLine}>
        <StatusDot tone={tone} />
        <Mono weight="med" size={12} lineHeight={16} letterSpacing={0.3} color={tone}>
          {loopStateWord(loopState)}
        </Mono>
        {busy ? (
          <Mono size={11} lineHeight={16} color={c.ink3}>
            {`${busyLabel(busyAction)}…`}
          </Mono>
        ) : null}
      </View>

      {/* STATE-AWARE actions (only when not mid-confirm) */}
      {mode === 'idle' ? (
        <View style={styles.actions}>
          {isLoading ? (
            <Mono size={11} lineHeight={16} color={c.ink3}>
              lendo estado…
            </Mono>
          ) : noSignal ? null : idleNoRun && !killed && !paused && !active ? (
            <Mono size={11} lineHeight={16} color={c.ink3}>
              sem run ativo para controlar
            </Mono>
          ) : killed ? (
            // killed -> ONLY clear-kill (pause/resume structurally cannot be offered)
            <PressablePillScale
              onPress={() => setMode('confirmClearKill')}
              disabled={busy}
              haptic="soft"
              pressedBackground={c.bgRaised}
              accessibilityLabel="liberar encerramento"
              style={[styles.pill, { borderColor: c.bronzeBorder }]}
            >
              <Mono size={11} lineHeight={14} letterSpacing={0.4} color={c.bronze}>
                LIBERAR ENCERRAMENTO
              </Mono>
            </PressablePillScale>
          ) : (
            <>
              {paused ? (
                <PressablePillScale
                  onPress={() => void onControl('resume')}
                  disabled={busy}
                  haptic="soft"
                  pressedBackground={c.bgRaised}
                  accessibilityLabel="retomar"
                  style={[styles.pill, { borderColor: c.moss }]}
                >
                  <Mono size={11} lineHeight={14} letterSpacing={0.4} color={c.moss}>
                    RETOMAR
                  </Mono>
                </PressablePillScale>
              ) : (
                <PressablePillScale
                  onPress={() => void onControl('pause')}
                  disabled={busy}
                  haptic="soft"
                  pressedBackground={c.bgRaised}
                  accessibilityLabel="pausar"
                  style={[styles.pill, { borderColor: c.amber }]}
                >
                  <Mono size={11} lineHeight={14} letterSpacing={0.4} color={c.amber}>
                    PAUSAR
                  </Mono>
                </PressablePillScale>
              )}
              <PressableTextScale
                onPress={() => setMode('confirmKill')}
                disabled={busy}
                haptic="soft"
                accessibilityLabel="encerrar loop"
                style={[styles.killText, suggestKill && { borderBottomColor: c.bronzeBorder, borderBottomWidth: 1 }]}
              >
                <Mono size={11} lineHeight={14} letterSpacing={0.4} color={c.recRed}>
                  ENCERRAR LOOP
                </Mono>
              </PressableTextScale>
            </>
          )}
        </View>
      ) : null}

      {/* paused banner */}
      {paused && mode === 'idle' ? (
        <Mono size={11} lineHeight={15} letterSpacing={0.2} color={c.amber} style={styles.banner}>
          PAUSADO · o loop honra o sinal na próxima fronteira de iteração (≤5s)
        </Mono>
      ) : null}

      {/* killed banner */}
      {killed && mode === 'idle' ? (
        <Mono size={11} lineHeight={15} letterSpacing={0.2} color={c.recRed} style={styles.banner}>
          ENCERRADO · kill switch ativo. Nenhum ciclo novo até liberar.
        </Mono>
      ) : null}

      {/* after a non-destructive action, the calm "honors next boundary" line */}
      {active && mode === 'idle' && !busy ? (
        <Mono size={11} lineHeight={15} color={c.ink3} style={styles.banner}>
          O loop honra o sinal no próximo limite de ciclo (≤5s).
        </Mono>
      ) : null}

      {/* DESTRUCTIVE CONFIRM — in-place, same footprint */}
      {mode === 'confirmKill' ? (
        <RunControlConfirmStrip
          kind="kill"
          reason={reason}
          onChangeReason={setReason}
          onCancel={cancel}
          onConfirm={(r) => void confirmKill(r)}
          busy={busy}
        />
      ) : null}
      {mode === 'confirmClearKill' ? (
        <RunControlConfirmStrip
          kind="clear-kill"
          reason={reason}
          onChangeReason={setReason}
          onCancel={cancel}
          onConfirm={(r) => void confirmClearKill(r)}
          busy={busy}
        />
      ) : null}
    </View>
  )
}

function busyLabel(action: string | null): string {
  switch (action) {
    case 'pause':
      return 'pausando'
    case 'resume':
      return 'retomando'
    case 'kill':
      return 'encerrando'
    case 'clear-kill':
      return 'liberando'
    default:
      return 'aplicando'
  }
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    flexWrap: 'wrap',
  },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  killText: {
    paddingBottom: 2,
  },
  banner: {
    marginTop: 0,
  },
})
