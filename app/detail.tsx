import { StyleSheet, View } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import { Screen } from '../components/Screen'
import { TranscribingBlock } from '../components/TranscribingBlock'
import { TranscribeError } from '../components/TranscribeError'
import {
  Masthead,
  EditorialDateline,
  SectionHead,
  FolioFooter,
} from '../components/editorial'
import { PressableTextScale } from '../components/atlas-ui/PressableScale'
import { SignatureGesture } from '../components/edition/SignatureGesture'
import { MiniActionPill } from '../components/edition/Pills'
import { dailyFolio, editorialDateLine } from '../lib/folio'
import { Frau, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { domainColor, domainLabel } from '../lib/domains'
import { captureToInboxItem, useAtlasStore, visibleCaptures } from '../lib/atlasStore'

type Phase = 'transcribing' | 'done' | 'error'

// Tela DETAIL · canon editorial divino.
// Substituiu greeting servil "Captura · DOMAIN" Sans caps + ActionPill SaaS +
// PrimaryButton por Masthead+Dateline+SectionHeads numeradas+MiniActionPills
// canon+SignatureGesture+FolioFooter. Funcionalidades preservadas.
export default function DetailScreen() {
  const c = usePalette()
  const router = useRouter()
  const { id, error } = useLocalSearchParams<{ id?: string; error?: string }>()
  const captures = useAtlasStore((s) => s.captures)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures)
  const domains = useAtlasStore((s) => s.domains)
  const folio = useMemo(() => dailyFolio(), [])
  const item = visibleCaptures({ captures, queuedCaptures })
    .map((capture) => captureToInboxItem(capture, domains))
    .find((x) => x.id === id || x.clientId === id)

  const phase: Phase = error || item?.transcriptionStatus === 'failed'
    ? 'error'
    : item?.kind === 'audio' && item.transcriptionStatus !== 'done'
      ? 'transcribing'
      : 'done'

  if (!item) {
    return (
      <Screen bare>
        <PressableTextScale onPress={() => router.back()} hitSlop={8} accessibilityLabel="voltar">
          <Masthead title="CAPTURA" folio={null} />
        </PressableTextScale>
        <EditorialDateline date={editorialDateLine()} edition="não encontrada" />
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
              C
            </Frau>
            aptura não encontrada.
          </Frau>
        </View>
        <View style={styles.gestureFooter}>
          <SignatureGesture
            label="voltar à inbox."
            onPress={() => router.back()}
            seal="commit"
            haptic="soft"
            accessibilityLabel="voltar à inbox"
          />
        </View>
        <FolioFooter number={folio.number} suffix="captura" />
      </Screen>
    )
  }

  const domainLabelText = item.domainLabel ?? domainLabel(item.domain)
  const metaLine = `${item.time}${item.date ? ` · ${item.date}` : ''}${item.durationMs ? ` · ${formatDuration(item.durationMs)}` : ''}`

  return (
    <Screen bare>
      <PressableTextScale onPress={() => router.back()} hitSlop={8} accessibilityLabel="voltar à inbox">
        <Masthead title="CAPTURA" folio={null} />
      </PressableTextScale>
      <EditorialDateline date={metaLine} edition={`domínio · ${domainLabelText}`} />

      {/* Accent bar bronze · marcador domain color */}
      <View
        pointerEvents="none"
        style={[styles.accent, { backgroundColor: domainColor(item.domain, c, domains) }]}
      />

      {/* i. CONTEÚDO */}
      <SectionHead numeral="i" title="Conteúdo" />
      <View style={styles.contentRail}>
        <Sans size={17} lineHeight={26} color={c.ink}>
          {item.text}
        </Sans>
      </View>

      {/* ii. TRANSCRIÇÃO */}
      <SectionHead numeral="ii" title="Transcrição" />
      <View style={styles.contentRail}>
        {phase === 'transcribing' && <TranscribingBlock />}
        {phase === 'done' && (
          <Frau italic size={15} lineHeight={24} color={c.ink2}>
            {item.kind === 'audio' ? item.text : 'Captura registrada no servidor Atlas.'}
          </Frau>
        )}
        {phase === 'error' && <TranscribeError onRetry={() => router.replace('/inbox')} />}
      </View>

      {/* iii. COORDENADAS */}
      <SectionHead numeral="iii" title="Coordenadas" deck={`capturado às ${item.time}`} />
      <View style={styles.contentRail}>
        <Mono size={11} lineHeight={16} letterSpacing={1.6} color={c.bronze} style={{ textTransform: 'uppercase' }} weight="med">
          {formatCoordinates(item.capturedLat, item.capturedLng)}
        </Mono>
      </View>

      {/* iv. AÇÕES */}
      <SectionHead numeral="iv" title="Ações" />
      <View style={[styles.contentRail, styles.actionsRow]}>
        <MiniActionPill label="editar" onPress={() => { /* TODO: editar */ }} />
        <MiniActionPill label="mover de domínio" onPress={() => { /* TODO: mover */ }} />
      </View>

      <View style={styles.gestureFooter}>
        <SignatureGesture
          label="voltar à inbox."
          onPress={() => router.back()}
          seal="commit"
          haptic="soft"
          accessibilityLabel="voltar à inbox"
        />
      </View>

      <FolioFooter number={folio.number} suffix="captura" />
    </Screen>
  )
}

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function formatCoordinates(lat?: number | null, lng?: number | null): string {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return 'sem coordenadas registradas'
  }
  return `${lat.toFixed(5)} · ${lng.toFixed(5)}`
}

const styles = StyleSheet.create({
  contentRail: {
    marginHorizontal: 32,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.3,
  },
  gestureFooter: {
    marginTop: 36,
    marginHorizontal: 32,
    alignItems: 'flex-start',
  },
})
