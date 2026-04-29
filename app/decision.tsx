import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { PrimaryButton } from '../components/PrimaryButton'
import { Frau, Label, Sans } from '../design/Type'
import { usePalette } from '../design/theme'

export default function DecisionScreen() {
  const c = usePalette()
  const router = useRouter()

  return (
    <Screen>
      <View style={{ marginBottom: 22 }}>
        <Label>Decisão estruturada</Label>
        <Frau
          size={32}
          lineHeight={36}
          letterSpacing={-0.64}
          color={c.ink}
          style={{ marginTop: 8 }}
        >
          Nenhuma decisão ativa
        </Frau>
      </View>

      <Field label="Contexto">
        <EmptyField label="Sem decisão registrada no backend." />
      </Field>

      <Field label="Alternativas consideradas">
        <EmptyField label="As alternativas aparecem aqui quando o recurso entrar no escopo da API." tall />
      </Field>

      <Field label="Custo de não decidir">
        <EmptyField label="Sem dado registrado." />
      </Field>

      <View style={{ height: 28 }} />
      <PrimaryButton label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 22 }}>
      <Label style={{ marginBottom: 8 }}>{label}</Label>
      {children}
    </View>
  )
}

function EmptyField({ label, tall }: { label: string; tall?: boolean }) {
  const c = usePalette()

  return (
    <View style={[styles.field, tall && styles.fieldTall, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Sans size={14.5} lineHeight={22} color={c.ink2}>
        {label}
      </Sans>
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 56,
  },
  fieldTall: { minHeight: 110 },
})
