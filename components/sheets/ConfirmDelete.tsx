import { Pressable, StyleSheet, View } from 'react-native'
import { CenterModal } from './CenterModal'
import { Frau } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'

// =============================================================================
// ConfirmDelete · canon mockup "Confirm Delete" (v18)
// =============================================================================
//
// Modal destrutivo centered. Card editorial minimal (border 1px @18%,
// radius 4, padding 28/24/0, bg cream). Title interrogativo Frau italic 22 +
// body italic Frau 14 ink2 + 2 cells flat com hairline-top e hairline
// vertical entre.
//
// "Excluir" em rec-red text weight 500 (NÃO bg colored SaaS) — peso
// destrutivo via tipografia, não via UI pill.
// =============================================================================

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
    <CenterModal visible={visible} onClose={() => finish(false)} emphasised canon>
      <Body
        title={copy?.title ?? 'Excluir esta captura?'}
        body={
          copy?.body ??
          'A captura sai da inbox, mas fica preservada no histórico do servidor.'
        }
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
        italic
        size={22}
        lineHeight={29}
        letterSpacing={-0.18}
        align="center"
        color={c.ink}
        style={styles.title}
      >
        {title}
      </Frau>
      <Frau
        italic
        size={14}
        lineHeight={22}
        align="center"
        color={c.ink2}
        style={styles.body}
      >
        {body}
      </Frau>
      <View
        style={[
          styles.actions,
          { borderTopColor: 'rgba(26,22,18,0.12)' },
        ]}
      >
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
          style={({ pressed }) => [
            styles.cell,
            { opacity: pressed ? 0.55 : 1 },
          ]}
        >
          <Frau italic size={16} lineHeight={22} align="center" color={c.ink}>
            Cancelar
          </Frau>
        </Pressable>
        <View
          style={[styles.cellDivider, { backgroundColor: 'rgba(26,22,18,0.12)' }]}
        />
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          style={({ pressed }) => [
            styles.cell,
            { opacity: pressed ? 0.55 : 1 },
          ]}
        >
          <Frau
            italic
            weight="med"
            size={16}
            lineHeight={22}
            align="center"
            color={c.recRed}
          >
            {confirmLabel}
          </Frau>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 12,
  },
  body: {
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    // canon: actions estendem até as bordas do card (negative margin compensa
    // padding 24 do CenterModal canon)
    marginHorizontal: -24,
  },
  cell: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  cellDivider: {
    width: 1,
  },
})
