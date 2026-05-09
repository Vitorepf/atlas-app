import { Pressable, StyleSheet, View } from 'react-native'
import { CenterModal } from './CenterModal'
import { Frau, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'

export function ConfirmDelete() {
  const open = useOverlays((s) => s.open)
  const cb = useOverlays((s) => s.onConfirmDelete)
  const copy = useOverlays((s) => s.confirmDeleteCopy)
  const close = useOverlays((s) => s.close)
  const visible = open === 'confirmDelete'

  const finish = (confirmed: boolean) => {
    cb?.(confirmed)
    close()
  }

  return (
    <CenterModal visible={visible} onClose={() => finish(false)} emphasised>
      <Body
        title={copy?.title ?? 'Excluir esta captura?'}
        body={copy?.body ?? 'A captura sai da inbox e deixa de alimentar busca, contexto e memória operacional.'}
        confirmLabel={copy?.confirmLabel ?? 'Excluir'}
        onCancel={() => finish(false)}
        onConfirm={() => finish(true)}
      />
    </CenterModal>
  )
}

function Body({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  body: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
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
        {title}
      </Frau>
      <Sans
        size={14}
        lineHeight={22}
        align="center"
        color={c.ink2}
        style={{ marginBottom: 22 }}
      >
        {body}
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
            {confirmLabel}
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
