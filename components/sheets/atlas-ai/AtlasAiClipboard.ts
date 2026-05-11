import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'

export async function copyToClipboard(text: string, onSuccess?: () => void): Promise<void> {
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
