import { useEffect, useState } from 'react'
import { Mono } from '../design/Type'
import { usePalette } from '../design/theme'

interface Props {
  running: boolean
}

// 0:00 monospace counter — drives off a wall-clock interval so it stays steady.
export function CaptureCounter({ running }: Props) {
  const c = usePalette()
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!running) {
      setSeconds(0)
      return
    }
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [running])

  const m = Math.floor(seconds / 60)
  const r = String(seconds % 60).padStart(2, '0')

  return (
    <Mono weight="med" size={56} lineHeight={56} letterSpacing={-1.1} color={c.ink}>
      {m}:{r}
    </Mono>
  )
}
