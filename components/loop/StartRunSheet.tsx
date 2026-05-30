import { useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { Frau, Label, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { radii } from '../../design/tokens'
import { BottomSheet } from '../sheets/BottomSheet'
import { PressablePillScale } from '../atlas-ui/PressableScale'
import { Segmented } from './Segmented'
import { StatusDot } from './StatusDot'
import { AtlasApiError } from '../../lib/api/client'
import type { AtlasLoopArea, AtlasLoopRunMode, AtlasLoopStartRunResponse } from '../../lib/loop'

export interface StartRunInput {
  area: string
  /** Duration model. cycles/hours repair-and-continue on a block; until_blocked stops at the first. */
  runMode: AtlasLoopRunMode
  /** Bound for runMode='cycles'. */
  cycles: number
  /** Bound (hours) for runMode='hours'. */
  hours: number
  /** false = simular (dry_run, safe) · true = executar (the real, destructive path). */
  execute: boolean
}

interface Props {
  visible: boolean
  onClose: () => void
  /** The registered areas ([] when the endpoint is absent). */
  areas: AtlasLoopArea[]
  areasLoading: boolean
  areasError: string | null
  defaultAreaId: string
  defaultFocus: string
  /** Resolves to the 202 receipt on success; throws AtlasApiError on 409/422. */
  onStart: (input: StartRunInput) => Promise<AtlasLoopStartRunResponse>
}

const CYCLES_MIN = 1
const CYCLES_MAX = 50
const HOURS_MIN = 1
const HOURS_MAX = 24

// The governed start gate (a BottomSheet). Calm, professional, four honest steps:
//   1) ÁREA — pick one of the registered areas (selectable).
//   2) MODO — CICLOS (N) | HORAS (N) | ATÉ BLOQUEAR. In CICLOS/HORAS a blocked
//      cycle repairs-and-continues; ATÉ BLOQUEAR stops at the first block.
//   3) EXECUÇÃO — simular (dry_run, default) | executar (real, destructive).
// HONEST by construction: it NEVER flips the parent to "active" optimistically;
// a 202 says "enfileirado", never "running". 409/422 surface inline verbatim.
export function StartRunSheet({
  visible,
  onClose,
  areas,
  areasLoading,
  areasError,
  defaultAreaId,
  defaultFocus,
  onStart,
}: Props) {
  const c = usePalette()
  const { height: winH } = useWindowDimensions()
  const sheetHeight = Math.round(winH * 0.72)

  const [selectedAreaId, setSelectedAreaId] = useState(defaultAreaId)
  const [runMode, setRunMode] = useState<AtlasLoopRunMode>('cycles')
  const [cycles, setCycles] = useState(5)
  const [hours, setHours] = useState(2)
  const [execute, setExecute] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen: AtlasLoopArea | null =
    areas.find((a) => a.area_id === selectedAreaId) ??
    areas.find((a) => a.area_id === defaultAreaId) ??
    areas[0] ??
    null
  const areaId = chosen?.area_id ?? defaultAreaId
  const focus = chosen?.focus ?? defaultFocus
  const tier = chosen?.autonomy_tier
  const areasUnavailable = !areasLoading && areas.length === 0

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onStart({ area: areaId, runMode, cycles, hours, execute })
      onClose()
    } catch (e) {
      setError(extractError(e))
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDisabled = submitting || areasLoading || areasUnavailable

  return (
    <BottomSheet visible={visible} onClose={onClose} height={sheetHeight}>
      <View style={styles.body}>
        <Mono size={12} lineHeight={17} letterSpacing={0.6} color={c.bronze}>
          INICIAR RUN
        </Mono>

        {/* 1 · ÁREA — selectable */}
        <View style={styles.block}>
          <Label>ÁREA</Label>
          {areasLoading ? (
            <Mono size={13} lineHeight={18} color={c.ink3}>
              ·····
            </Mono>
          ) : areasUnavailable ? (
            <Frau italic size={13} lineHeight={19} color={c.ink2}>
              Lista de áreas indisponível.
            </Frau>
          ) : (
            <View style={{ gap: 8 }}>
              {areas.map((a) => {
                const selected = a.area_id === areaId
                const held = a.run_state?.lock?.held === true
                return (
                  <PressablePillScale
                    key={a.area_id}
                    onPress={() => setSelectedAreaId(a.area_id)}
                    haptic="soft"
                    accessibilityLabel={`escolher área ${a.area_name}`}
                    style={[
                      styles.areaRow,
                      { borderColor: selected ? c.bronzeBorder : c.borderSoft },
                    ]}
                  >
                    <StatusDot tone={selected ? c.bronze : c.ink3} size={6} />
                    <Frau
                      size={17}
                      lineHeight={22}
                      color={selected ? c.ink : c.ink2}
                      style={{ flex: 1 }}
                    >
                      {a.area_name}
                    </Frau>
                    {held ? (
                      <Mono size={11} lineHeight={15} color={c.amber}>
                        ativo
                      </Mono>
                    ) : null}
                  </PressablePillScale>
                )
              })}
              <Mono size={12} lineHeight={17} color={c.ink3}>
                {`foco ${focus}${tier != null ? ` · tier ${tier}` : ''}`}
              </Mono>
              {areasError != null && areasError !== '' ? (
                <Mono size={11} lineHeight={15} color={c.ink3}>
                  {areasError}
                </Mono>
              ) : null}
            </View>
          )}
        </View>

        {/* 2 · MODO — cycles | hours | until_blocked */}
        <View style={styles.block}>
          <Label>MODO</Label>
          <Segmented
            value={runMode}
            options={[
              { value: 'cycles', label: 'CICLOS' },
              { value: 'hours', label: 'HORAS' },
              { value: 'until_blocked', label: 'ATÉ BLOQUEAR' },
            ]}
            onChange={(v) => setRunMode(v as AtlasLoopRunMode)}
          />

          {runMode === 'cycles' ? (
            <Stepper
              value={cycles}
              min={CYCLES_MIN}
              max={CYCLES_MAX}
              unit={cycles === 1 ? 'ciclo' : 'ciclos'}
              onChange={setCycles}
            />
          ) : null}
          {runMode === 'hours' ? (
            <Stepper
              value={hours}
              min={HOURS_MIN}
              max={HOURS_MAX}
              unit={hours === 1 ? 'hora' : 'horas'}
              onChange={setHours}
            />
          ) : null}

          <Frau italic size={13} lineHeight={19} color={c.ink2}>
            {runMode === 'until_blocked'
              ? 'Roda até o primeiro bloqueio, e então para.'
              : 'Se um ciclo bloquear, o loop se corrige e continua — só para no limite escolhido.'}
          </Frau>
        </View>

        {/* 3 · EXECUÇÃO */}
        <View style={styles.block}>
          <Label>EXECUÇÃO</Label>
          <Segmented
            value={execute ? 'executar' : 'simular'}
            options={[
              { value: 'simular', label: 'SIMULAR' },
              { value: 'executar', label: 'EXECUTAR' },
            ]}
            onChange={(v) => setExecute(v === 'executar')}
          />
          {execute ? (
            <Mono size={12} lineHeight={17} color={c.recRed}>
              executar muda o repositório de verdade
            </Mono>
          ) : null}
        </View>

        {/* honest 422/409 inline */}
        {error != null ? (
          <Frau italic size={13} lineHeight={19} color={c.recRed}>
            {error}
          </Frau>
        ) : null}

        {/* permanent honesty band */}
        <Frau italic size={13} lineHeight={19} color={c.ink2}>
          Iniciar apenas enfileira. O loop começa quando um worker o consome.
        </Frau>

        {/* CONFIRM — execute arms a heavier confirm; dry_run is calm */}
        <PressablePillScale
          onPress={() => void submit()}
          disabled={confirmDisabled}
          haptic="soft"
          pressedBackground={c.bgRaised}
          accessibilityLabel={execute ? 'confirmar início real' : 'iniciar simulação'}
          style={[styles.confirm, { borderColor: execute ? c.recRed : c.bronzeBorder }]}
        >
          <Mono size={12} lineHeight={16} letterSpacing={0.5} color={execute ? c.recRed : c.bronze}>
            {submitting ? 'ENVIANDO…' : execute ? 'CONFIRMAR INÍCIO' : 'INICIAR'}
          </Mono>
        </PressablePillScale>
      </View>
    </BottomSheet>
  )
}

// A calm −/+ stepper (no keyboard): the operator sets the bound by tapping.
function Stepper({
  value,
  min,
  max,
  unit,
  onChange,
}: {
  value: number
  min: number
  max: number
  unit: string
  onChange: (n: number) => void
}) {
  const c = usePalette()
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  return (
    <View style={styles.stepper}>
      <PressablePillScale
        onPress={dec}
        disabled={value <= min}
        haptic="soft"
        accessibilityLabel="diminuir"
        style={[styles.stepBtn, { borderColor: c.borderSoft, opacity: value <= min ? 0.4 : 1 }]}
      >
        <Mono size={16} lineHeight={20} color={c.ink}>
          −
        </Mono>
      </PressablePillScale>
      <Mono size={14} lineHeight={20} color={c.ink} style={{ minWidth: 96, textAlign: 'center' }}>
        {`${value} ${unit}`}
      </Mono>
      <PressablePillScale
        onPress={inc}
        disabled={value >= max}
        haptic="soft"
        accessibilityLabel="aumentar"
        style={[styles.stepBtn, { borderColor: c.borderSoft, opacity: value >= max ? 0.4 : 1 }]}
      >
        <Mono size={16} lineHeight={20} color={c.ink}>
          +
        </Mono>
      </PressablePillScale>
    </View>
  )
}

function extractError(e: unknown): string {
  if (e instanceof AtlasApiError) {
    if (e.status === 409) {
      const payload = e.payload as { holder?: { run_id?: string } } | null
      const runId = payload?.holder?.run_id
      return runId ? `Já existe um run ativo. (${runId})` : 'Já existe um run ativo.'
    }
    const payload = e.payload as { reason?: string; detail?: string; error?: { message?: string } } | null
    if (payload?.reason === 'operator_actor_required') return 'Falta o operador dono do run.'
    if (payload?.reason === 'invalid_mode') return 'Modo de execução inválido.'
    if (payload?.reason === 'invalid_run_mode') return 'Modo de duração inválido.'
    if (payload?.error?.message) return payload.error.message
    if (payload?.detail) return payload.detail
  }
  return 'Não foi possível enfileirar o run.'
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    gap: 16,
  },
  block: {
    gap: 8,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  stepBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 4,
  },
})
