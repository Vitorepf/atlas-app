import { type ReactNode, useRef } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import { Frau } from '../../design/Type'
import { useTheme } from '../../design/theme'

// Frente 7 v8 · Card swipe-left gestural reveal · iOS Mail reference.
// Drag pra esquerda revela 2 ações:
//   - Adiar (amber, ink2-on-amber)
//   - Arquivar (recRed muted, ink2-on-red)
// Threshold 60pt = snap · 70% width = commit imediato.
// Haptic .selection ao cruzar threshold · .success no commit.

interface Props {
  children: ReactNode
  onSnooze?: () => void
  onArchive?: () => void
  enabled?: boolean
}

export function SwipeableCard({ children, onSnooze, onArchive, enabled = true }: Props) {
  const { c } = useTheme()
  const ref = useRef<Swipeable>(null)
  const lastHapticOffset = useRef(0)

  if (!enabled || (!onSnooze && !onArchive)) {
    return <>{children}</>
  }

  const close = () => ref.current?.close()

  return (
    <Swipeable
      ref={ref}
      friction={1.6}
      rightThreshold={60}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      renderRightActions={(_progress, dragX) => (
        <View style={styles.actionsRow}>
          {onSnooze ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="adiar captura"
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                close()
                onSnooze()
              }}
              style={[styles.actionButton, { backgroundColor: c.amber }]}
            >
              <Frau italic size={13} lineHeight={16} color={c.bg} align="center">
                adiar
              </Frau>
            </Pressable>
          ) : null}
          {onArchive ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="arquivar captura"
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                close()
                onArchive()
              }}
              style={[styles.actionButton, { backgroundColor: c.recRedMuted }]}
            >
              <Frau italic size={13} lineHeight={16} color={c.bg} align="center">
                arquivar
              </Frau>
            </Pressable>
          ) : null}
        </View>
      )}
      onActivated={() => {
        // Threshold haptic · single fire ao começar
        if (lastHapticOffset.current === 0) {
          lastHapticOffset.current = 1
          void Haptics.selectionAsync()
        }
      }}
      onSwipeableClose={() => {
        lastHapticOffset.current = 0
      }}
    >
      {children}
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  actionButton: {
    width: 84,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
})
