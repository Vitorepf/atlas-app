/**
 * Cartografia · hook de fluxo direcional pra trails.
 *
 * Retorna um shared value que oscila linearmente (0 → -dashCycle), usado
 * em `<AnimatedPath strokeDashoffset>` pra animar pequenos dashes
 * correndo ao longo da trail · direção do fluxo fica visível sem texto.
 *
 * Todos os paths consomem o MESMO shared value · zero overhead extra
 * por path. Respeita reduced-motion.
 */
import { useEffect } from 'react'
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

interface Options {
  enabled: boolean
  /** valor total a cobrir num ciclo · default 20 (matches strokeDasharray "6,8") */
  dashCycle?: number
  /** duração de um ciclo em ms · default 1600 */
  period?: number
}

export function useTrailFlow({ enabled, dashCycle = 20, period = 1600 }: Options) {
  const offset = useSharedValue(0)

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(offset)
      offset.value = 0
      return
    }
    offset.value = 0
    offset.value = withRepeat(
      withTiming(-dashCycle, { duration: period, easing: Easing.linear }),
      -1,
      false, // no reverse · sempre forward (direção do fluxo)
    )
    return () => cancelAnimation(offset)
  }, [enabled, dashCycle, period, offset])

  return offset
}
