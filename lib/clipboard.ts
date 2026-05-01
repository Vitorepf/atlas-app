import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'

// Atlas-wide copy primitive: trims, writes to clipboard, fires medium haptic
// on success / warning haptic on failure. Same UX pattern as long-press copy
// in AtlasAiSheet — keep symmetric across the app.
export async function copyToClipboard(
  text: string,
  onSuccess?: () => void,
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  try {
    await Clipboard.setStringAsync(trimmed)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSuccess?.()
  } catch {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  }
}

export const COPY_LONG_PRESS_DELAY = 380
