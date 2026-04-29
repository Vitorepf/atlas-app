import { Pressable, StyleSheet, View } from 'react-native'
import { CenterModal } from './CenterModal'
import { Frau, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'

export function MicModal() {
  const open = useOverlays((s) => s.open)
  const close = useOverlays((s) => s.close)
  const visible = open === 'mic'
  const { c } = useTheme()

  return (
    <CenterModal visible={visible} onClose={close}>
      <View>
        <Frau
          size={22}
          lineHeight={28}
          letterSpacing={-0.33}
          color={c.ink}
          style={{ marginBottom: 10 }}
        >
          Microfone bloqueado
        </Frau>
        <Sans size={14} lineHeight={22} color={c.ink2} style={{ marginBottom: 22 }}>
          Atlas precisa de permissão para capturar áudio. Abra os ajustes e habilite o microfone para continuar a gravar.
        </Sans>

        <Pressable
          onPress={close}
          style={({ pressed }) => [
            styles.primary,
            {
              backgroundColor: c.prussian,
              borderColor: c.prussian,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Sans weight="med" size={14} align="center" color={c.bg}>
            Abrir Ajustes
          </Sans>
        </Pressable>
        <Pressable
          onPress={close}
          style={({ pressed }) => [styles.ghost, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Sans weight="med" size={14} align="center" color={c.ink2}>
            Voltar
          </Sans>
        </Pressable>
      </View>
    </CenterModal>
  )
}

const styles = StyleSheet.create({
  primary: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  ghost: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 22,
  },
})
