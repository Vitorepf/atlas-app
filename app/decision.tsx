import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import {
  Masthead,
  EditorialDateline,
  SectionHead,
  FolioFooter,
} from '../components/editorial'
import { PressableTextScale } from '../components/atlas-ui/PressableScale'
import { SignatureGesture } from '../components/edition/SignatureGesture'
import { dailyFolio, editorialDateLine } from '../lib/folio'
import { Frau, Mono } from '../design/Type'
import { usePalette } from '../design/theme'
import { useMemo } from 'react'

// Tela DECISÃO · empty state canon editorial divino.
// Substituiu greeting "Nenhuma decisão ativa" + PrimaryButton por Masthead+
// Dateline + SectionHeads numeradas + EditorialEmptyLine pattern + SignatureGesture.
export default function DecisionScreen() {
  const c = usePalette()
  const router = useRouter()
  const folio = useMemo(() => dailyFolio(), [])

  return (
    <Screen bare>
      <PressableTextScale onPress={() => router.back()} hitSlop={8} accessibilityLabel="voltar">
        <Masthead title="DECISÃO" folio={null} />
      </PressableTextScale>
      <EditorialDateline date={editorialDateLine()} edition="estruturada · sem decisão ativa" />

      {/* i. CONTEXTO */}
      <SectionHead numeral="i" title="Contexto" />
      <View style={styles.contentRail}>
        <Frau italic size={17} lineHeight={26} color={c.ink}>
          <Frau
            weight="med"
            size={24}
            color={c.bronze}
            style={{
              textShadowColor: c.inkCarving,
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 0,
            }}
          >
            S
          </Frau>
          em decisão registrada no backend.
        </Frau>
      </View>

      {/* ii. ALTERNATIVAS */}
      <SectionHead numeral="ii" title="Alternativas consideradas" />
      <View style={styles.contentRail}>
        <Frau italic size={15} lineHeight={22} color={c.ink2}>
          As alternativas aparecem aqui quando o recurso entrar no escopo da API.
        </Frau>
      </View>

      {/* iii. CUSTO */}
      <SectionHead numeral="iii" title="Custo de não decidir" />
      <View style={styles.contentRail}>
        <Frau italic size={15} lineHeight={22} color={c.ink2}>
          Sem dado registrado.
        </Frau>
      </View>

      {/* Gesture footer · "voltar." */}
      <View style={styles.gestureFooter}>
        <SignatureGesture
          label="voltar."
          onPress={() => router.back()}
          seal="commit"
          haptic="soft"
          accessibilityLabel="voltar à tela anterior"
        />
      </View>

      <FolioFooter number={folio.number} suffix="decisão" />
    </Screen>
  )
}

const styles = StyleSheet.create({
  contentRail: {
    marginHorizontal: 32,
  },
  gestureFooter: {
    marginTop: 36,
    marginHorizontal: 32,
    alignItems: 'flex-start',
  },
})
