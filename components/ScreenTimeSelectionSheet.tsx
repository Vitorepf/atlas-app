import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Label, Mono, Sans } from '../design/Type'
import { useTheme } from '../design/theme'
import { screenTimeBucketById } from '../lib/screenTime'

export function ScreenTimeSelectionSheet({
  bucketId,
  visible,
  onClose,
}: {
  bucketId: string | null
  visible: boolean
  onClose: () => void
}) {
  const { c } = useTheme()
  const bucket = screenTimeBucketById(bucketId)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <View style={styles.slot} />
          <Sans weight="med" size={17} color={c.ink}>
            {bucket?.sourceName ?? 'Apps do iPhone'}
          </Sans>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.slot, { opacity: pressed ? 0.65 : 1 }]}>
            <Sans weight="med" size={14} color={c.prussian} align="right">
              Fechar
            </Sans>
          </Pressable>
        </View>

        <View style={styles.fallback}>
          <Label color={c.ink2}>IPHONE TRACKING</Label>
          <Sans size={17} lineHeight={24} color={c.ink}>
            {bucket?.categoryLabel ?? 'Buckets cognitivos'} continuam documentados, mas a captura nativa por Family Controls esta pausada.
          </Sans>
          <Mono size={11} letterSpacing={0.18} color={c.ink2}>
            O build atual evita extensoes iOS e entitlements que quebravam o EAS. Sensor 4 segue via Rize e backend.
          </Mono>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slot: { flex: 1 },
  fallback: {
    padding: 24,
    gap: 12,
  },
})
