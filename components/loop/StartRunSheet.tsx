import { useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { Frau, Label, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { radii } from '../../design/tokens'
import { BottomSheet } from '../sheets/BottomSheet'
import { PressablePillScale } from '../atlas-ui/PressableScale'
import { Segmented } from './Segmented'
import { TocRow } from '../editorial/TocRow'
import { StatusDot } from './StatusDot'
import { AtlasApiError } from '../../lib/api/client'
import type { AtlasLoopArea, AtlasLoopStartRunResponse } from '../../lib/loop'

export interface StartRunInput {
  area: string
  mode: 'single' | 'until-blocked'
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

// The governed start gate (a BottomSheet, ~58% height). Three honest steps:
//   1) ÁREA — read-only; v1 has exactly ONE registered area.
//   2) MODO — single (one cycle) | until-blocked.
//   3) EXECUÇÃO — simular (dry_run, default) | executar (the real, destructive path).
// Picking "executar" reveals a recRed warning and arms CONFIRMAR; dry_run skips
// the destructive confirm. HONEST by construction: it NEVER flips the parent to
// "active" optimistically; a 202 says "enfileirado", never "running". 409/422
// surface inline verbatim.
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
  // BottomSheet takes '85%' | '40%' | a raw pixel number — compute ~58% in px so
  // the governed gate has room for the three steps without overshooting.
  const sheetHeight = Math.round(winH * 0.58)
  const [mode, setMode] = useState<'single' | 'until-blocked'>('single')
  const [execute, setExecute] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The one chosen area: prefer the registry's first/default; fall back to the
  // default id label when the list is unavailable (honest about the fallback).
  const chosen: AtlasLoopArea | null =
    areas.find((a) => a.area_id === defaultAreaId) ?? areas[0] ?? null
  const areaId = chosen?.area_id ?? defaultAreaId
  const areaName = chosen?.area_name ?? defaultAreaId
  const focus = chosen?.focus ?? defaultFocus
  const tier = chosen?.autonomy_tier
  const devMode = chosen?.dev_mode ?? ''
  const areaHeld = chosen?.run_state?.lock?.held === true
  const areasUnavailable = !areasLoading && areas.length === 0

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onStart({ area: areaId, mode, execute })
      onClose()
    } catch (e) {
      setError(extractError(e))
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDisabled = submitting || areasLoading

  return (
    <BottomSheet visible={visible} onClose={onClose} height={sheetHeight}>
      <View style={styles.body}>
        <Mono size={12} lineHeight={17} letterSpacing={0.6} color={c.bronze}>
          INICIAR RUN
        </Mono>

        {/* 1 · ÁREA — read-only, one area in v1 */}
        <View style={styles.block}>
          <Label>ÁREA</Label>
          {areasLoading ? (
            <Mono size={13} lineHeight={18} color={c.ink3}>
              ·····
            </Mono>
          ) : (
            <>
              <TocRow
                label={areaName}
                withLeader
                live={!areaHeld}
                value={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {areaHeld ? <StatusDot tone={c.amber} size={6} /> : null}
                    <Mono size={12} lineHeight={17} color={c.ink2}>
                      {`foco ${focus}${tier != null ? ` · tier ${tier}` : ''}${devMode !== '' ? ` · ${devMode}` : ''}`}
                    </Mono>
                  </View>
                }
              />
              {areaHeld ? (
                <Mono size={11} lineHeight={15} color={c.amber}>
                  esta área já tem um run ativo
                </Mono>
              ) : null}
              <Frau italic size={13} lineHeight={19} color={c.ink2}>
                {areasUnavailable
                  ? 'lista de áreas indisponível — usando a área padrão'
                  : 'Só esta área está registrada na v1.'}
              </Frau>
              {areasError != null && areasError !== '' && !areasUnavailable ? (
                <Mono size={11} lineHeight={15} color={c.ink3}>
                  {areasError}
                </Mono>
              ) : null}
            </>
          )}
        </View>

        {/* 2 · MODO */}
        <View style={styles.block}>
          <Label>MODO</Label>
          <Segmented
            value={mode}
            options={[
              { value: 'single', label: 'UM CICLO' },
              { value: 'until-blocked', label: 'ATÉ BLOQUEAR' },
            ]}
            onChange={(v) => setMode(v as 'single' | 'until-blocked')}
          />
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

function extractError(e: unknown): string {
  if (e instanceof AtlasApiError) {
    if (e.status === 409) {
      const payload = e.payload as { holder?: { run_id?: string } } | null
      const runId = payload?.holder?.run_id
      return runId ? `Já existe um run ativo. (${runId})` : 'Já existe um run ativo.'
    }
    const payload = e.payload as { reason?: string; detail?: string } | null
    if (payload?.reason === 'operator_actor_required') return 'Falta o operador dono do run.'
    if (payload?.reason === 'invalid_mode') return 'Modo de execução inválido.'
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
  confirm: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 4,
  },
})
