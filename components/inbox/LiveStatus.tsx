import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasPalette } from '../../design/tokens'

// Frente B v4 · sub-status sussurrado · "atlas vivo, não estático".
// 3 estados rotativos a cada 11s com fade 700ms · cooldown após 3 ciclos sem evento real.
// Comunica JITAI/Curator/Open Brain sem invadir.

type StatusKind = 'listening' | 'curating' | 'silent'

interface StatusVoice {
  kind: StatusKind
  dot: keyof Pick<AtlasPalette, 'moss' | 'bronze' | 'ink3'>
  text: string
}

const VOICES: StatusVoice[] = [
  { kind: 'listening', dot: 'moss',   text: 'atlas escutando · operador focado' },
  { kind: 'curating',  dot: 'bronze', text: 'atlas curando · próxima review 02:00' },
  { kind: 'silent',    dot: 'ink3',   text: 'atlas em silêncio · sem padrões a confrontar' },
]

interface Props {
  initialIdx?: number
  fixed?: boolean        // true = não rotaciona (debug ou estado estático)
  hasEvent?: boolean     // true = há evento real → rotação contínua, sem cooldown
}

export function LiveStatus({ initialIdx = 0, fixed = false, hasEvent = false }: Props) {
  const c = usePalette()
  const [idx, setIdx] = useState(initialIdx)
  const [visible, setVisible] = useState(true)
  const cycleCount = useRef(0)

  useEffect(() => {
    if (fixed) return
    const interval = setInterval(() => {
      // Cooldown: depois de 3 ciclos sem evento real, congela em STATUSES[0]
      if (!hasEvent && cycleCount.current >= 3) {
        clearInterval(interval)
        return
      }
      setVisible(false)
      const t = setTimeout(() => {
        setIdx((i) => (i + 1) % VOICES.length)
        setVisible(true)
        cycleCount.current += 1
      }, 700)
      return () => clearTimeout(t)
    }, 11000)
    return () => clearInterval(interval)
  }, [fixed, hasEvent])

  const v = VOICES[idx]
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.pill, { opacity: visible ? 0.55 : 0 }]}>
        <View style={[styles.dot, { backgroundColor: c[v.dot] }]} />
        <Frau italic size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
          {v.text}
        </Frau>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 999,
  },
})
