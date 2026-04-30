import { Pressable, StyleSheet, View } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Screen } from '../components/Screen'
import { PrimaryButton } from '../components/PrimaryButton'
import { Sparkle } from '../components/Sparkle'
import { TranscribingBlock } from '../components/TranscribingBlock'
import { TranscribeError } from '../components/TranscribeError'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { domainColor, domainLabel } from '../lib/domains'
import { captureToInboxItem, useAtlasStore, visibleCaptures } from '../lib/atlasStore'

type Phase = 'transcribing' | 'done' | 'error'

export default function DetailScreen() {
  const c = usePalette()
  const router = useRouter()
  const { id, error } = useLocalSearchParams<{ id?: string; error?: string }>()
  const captures = useAtlasStore((s) => s.captures)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures)
  const domains = useAtlasStore((s) => s.domains)
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
      <Screen>
        <View style={styles.head}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <BackArrow color={c.ink2} />
          </Pressable>
        </View>
        <Sans size={17} lineHeight={26} color={c.ink2}>
          Captura não encontrada.
        </Sans>
      </Screen>
    )
  }

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <BackArrow color={c.ink2} />
        </Pressable>
        <Sans
          weight="med"
          size={13}
          letterSpacing={1.04}
          color={c.ink2}
          style={{ textTransform: 'uppercase' }}
        >
          Captura · {item.domainLabel ?? domainLabel(item.domain)}
        </Sans>
      </View>

      <Mono size={12} color={c.ink2} letterSpacing={0.24} style={{ marginBottom: 10 }}>
        {item.time}{item.date ? ` · ${item.date}` : ''}{item.durationMs ? ` · ${formatDuration(item.durationMs)}` : ''}
      </Mono>

      <Sans size={17} lineHeight={26} color={c.ink} style={{ marginBottom: 24 }}>
        {item.text}
      </Sans>

      {phase === 'transcribing' && <TranscribingBlock />}

      {phase === 'done' && (
        <View>
          <Label>Transcrição automática</Label>
          <Frau italic size={14} lineHeight={22} color={c.ink2} style={{ marginTop: 8 }}>
            {item.kind === 'audio' ? item.text : 'Captura registrada no servidor Atlas.'}
          </Frau>
        </View>
      )}

      {phase === 'error' && (
        <TranscribeError onRetry={() => router.replace('/inbox')} />
      )}

      <View
        style={[
          styles.coords,
          { borderTopColor: c.border, borderBottomColor: c.border },
        ]}
      >
        <Sparkle size={18} style={{ marginBottom: 8 }} />
        <Mono size={11} color={c.ink2} letterSpacing={0.66} align="center">
          {formatCoordinates(item.capturedLat, item.capturedLng)}
        </Mono>
        <Frau italic size={15} color={c.ink2} align="center" style={{ marginTop: 6 }}>
          Capturado às {item.time}
        </Frau>
      </View>

      <View style={styles.actions}>
        <ActionPill label="Editar" />
        <ActionPill label="Mover de domínio" />
        <ActionPill label="Excluir" danger />
      </View>

      <View style={{ height: 18 }} />
      <PrimaryButton label="Voltar à inbox" onPress={() => router.back()} />

      <View
        pointerEvents="none"
        style={[styles.accent, { backgroundColor: domainColor(item.domain, c, domains) }]}
      />
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
    return 'Sem coordenadas registradas'
  }

  return `${lat.toFixed(5)} · ${lng.toFixed(5)}`
}

function ActionPill({ label, danger }: { label: string; danger?: boolean }) {
  const c = usePalette()
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionPill,
        {
          backgroundColor: pressed ? c.surface : 'transparent',
          borderColor: danger ? c.recRed : c.border,
        },
      ]}
    >
      <Sans
        weight="med"
        size={13}
        color={danger ? c.recRed : c.ink}
        align="center"
      >
        {label}
      </Sans>
    </Pressable>
  )
}

function BackArrow({ color }: { color: string }) {
  return (
    <View style={{ width: 14, height: 14 }}>
      <View
        style={{
          position: 'absolute',
          left: 4,
          top: 6,
          width: 6,
          height: 1.8,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 4,
          top: 6,
          width: 6,
          height: 1.8,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coords: {
    marginTop: 28,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  actions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
  },
  actionPill: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.3,
  },
})
