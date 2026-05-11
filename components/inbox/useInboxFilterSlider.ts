import { useEffect, useRef, useState } from 'react'
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import type { InboxFilter } from '../../lib/inboxTypes'

type ChipLayout = { x: number; width: number }

export function useInboxFilterSlider(activeFilter: InboxFilter) {
  const [layouts, setLayouts] = useState<Record<string, ChipLayout>>({})
  const underlineX = useSharedValue(0)
  const underlineW = useSharedValue(0)
  const initializedRef = useRef(false)
  const ready = layouts[activeFilter] != null

  useEffect(() => {
    const target = layouts[activeFilter]
    if (!target) return
    if (!initializedRef.current) {
      underlineX.value = target.x
      underlineW.value = target.width
      initializedRef.current = true
    } else {
      underlineX.value = withTiming(target.x, {
        duration: 520,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      })
      underlineW.value = withTiming(target.width, {
        duration: 520,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      })
    }
  }, [activeFilter, layouts, underlineX, underlineW])

  const style = useAnimatedStyle(() => ({
    left: underlineX.value,
    width: underlineW.value,
  }))

  const onLayout = (key: InboxFilter, layout: ChipLayout) => {
    setLayouts((current) => ({ ...current, [key]: layout }))
  }

  return { onLayout, ready, style }
}
