import * as Haptics from 'expo-haptics'

export function hapticLightStart() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

export function hapticSelection() {
  void Haptics.selectionAsync()
}

export function hapticHeavyFullSwipe() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)
}

export function hapticCommitSuccess() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
}
