import { Pressable, StyleSheet, View } from 'react-native'
import { CenterModal } from './CenterModal'
import { Frau, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'

export function ConfirmDelete() {
  const open = useOverlays((s) => s.open)
  const cb = useOverlays((s) => s.onConfirmDelete)
  const close = useOverlays((s) => s.close)
  const visible = open === 'confirmDelete'

  const finish = (confirmed: boolean) => {
    cb?.(confirmed)
    close()
  }

  return (
    <CenterModal visible={visible} onClose={() => finish(false)} emphasised>
      <Body onCancel={() => finish(false)} onConfirm={() => finish(true)} />
    </CenterModal>
  )
}

function Body({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { c } = useTheme()
  return (
    <View>
      <Frau
        size={22}
        lineHeight={28}
        letterSpacing={-0.33}
        align="center"
        color={c.ink}
        style={{ marginBottom: 10 }}
      >
        Excluir esta captura?
      </Frau>
      <Sans
        size={14}
        lineHeight={22}
        align="center"
        color={c.ink2}
        style={{ marginBottom: 22 }}
      >
        A captura sai da inbox, mas fica preservada no histórico do servidor.
      </Sans>
      <View style={styles.row}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: pressed ? c.surface : 'transparent',
              borderColor: c.border,
            },
          ]}
        >
          <Sans weight="med" size={14} align="center" color={c.ink}>
            Cancelar
          </Sans>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: c.recRed,
              borderColor: c.recRed,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Sans weight="med" size={14} align="center" color={c.bg}>
            Excluir
          </Sans>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
