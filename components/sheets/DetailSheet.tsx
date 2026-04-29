import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioSource } from 'expo-audio'
import { BottomSheet } from './BottomSheet'
import { Frau, Mono, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'
import { useShell } from '../AtlasShell'
import { domainColor, domainLabel, type DomainKey } from '../../lib/domains'
import type { InboxItem } from '../InboxCard'
import { useAtlasStore } from '../../lib/atlasStore'

const WAVE_HEIGHTS = [4, 8, 14, 20, 26, 22, 16, 10, 6, 12, 18, 24, 28, 22, 16, 10, 6, 4, 8, 14, 20, 26, 30, 24, 18, 12, 8, 4, 10, 16, 22, 18, 12, 8, 6, 10, 14, 8, 4, 4]

export function DetailSheet() {
  const open = useOverlays((s) => s.open)
  const item = useOverlays((s) => s.item)
  const close = useOverlays((s) => s.close)
  const openConfirmDelete = useOverlays((s) => s.openConfirmDelete)
  const openEdit = useOverlays((s) => s.openEdit)
  const openDomain = useOverlays((s) => s.openDomain)
  const { showToast } = useShell()
  const updateCapture = useAtlasStore((s) => s.updateCapture)
  const deleteCapture = useAtlasStore((s) => s.deleteCapture)

  const visible = open === 'detail' && item != null

  return (
    <BottomSheet visible={visible} onClose={close} height="85%">
      {item ? (
        <DetailContent
          item={item}
          onEdit={() => openEdit(item)}
          onMove={() => openDomain((d) => {
            if (!d) return

            void updateCapture(item.id, { domain: d }).then((updated) => {
              showToast(updated ? `Movido · ${domainLabel(d)}` : 'Falha ao mover captura')
            })
          })}
          onDelete={() =>
            openConfirmDelete((confirmed) => {
              if (confirmed) {
                void deleteCapture(item.id).then((deleted) => {
                  showToast(deleted ? 'Captura excluída' : 'Falha ao excluir captura')
                })
              }
            })
          }
        />
      ) : null}
    </BottomSheet>
  )
}

interface ContentProps {
  item: InboxItem
  onEdit: () => void
  onMove: () => void
  onDelete: () => void
}

function DetailContent({ item, onEdit, onMove, onDelete }: ContentProps) {
  const { c } = useTheme()
  const [playerError, setPlayerError] = useState<string | null>(null)

  const accent = domainColor(item.domain, c)
  const bars = useMemo(() => WAVE_HEIGHTS, [])
  const audioSource = useMemo<AudioSource | null>(() => {
    if (item.kind !== 'audio' || !item.fileUrl) return null

    return item.fileHeaders
      ? { uri: item.fileUrl, headers: item.fileHeaders }
      : { uri: item.fileUrl }
  }, [item.fileHeaders, item.fileUrl, item.kind])
  const player = useAudioPlayer(audioSource, { updateInterval: 150 })
  const status = useAudioPlayerStatus(player)
  const durationSeconds = status.duration > 0 ? status.duration : (item.durationMs ?? 0) / 1000
  const progress = durationSeconds > 0 ? Math.min(1, Math.max(0, status.currentTime / durationSeconds)) : 0

  const togglePlayback = async () => {
    if (!audioSource) {
      setPlayerError('Arquivo de áudio indisponível.')
      return
    }

    try {
      setPlayerError(null)
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      })

      if (status.playing) {
        player.pause()
        return
      }

      if (durationSeconds > 0 && status.currentTime >= durationSeconds - 0.05) {
        await player.seekTo(0)
      }

      player.play()
    } catch (error) {
      setPlayerError(error instanceof Error ? error.message : 'Não foi possível tocar o áudio.')
    }
  }

  return (
    <View style={styles.body}>
      <View style={styles.metaRow}>
        <Mono size={13} color={c.ink2} letterSpacing={0.26}>
          {item.time}{item.date ? ` · ${item.date}` : ''}
        </Mono>
        <DomainPill domain={item.domain} accent={accent} />
      </View>

      <Frau size={28} lineHeight={33} letterSpacing={-0.42} color={c.ink} style={{ marginBottom: 18 }}>
        Captura
      </Frau>

      <Sans size={17} lineHeight={26} color={c.ink} style={{ marginBottom: 22 }}>
        {item.text}
      </Sans>

      {item.kind === 'audio' && (
        <View style={{ marginBottom: 18 }}>
          <View style={[styles.player, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Pressable
              onPress={togglePlayback}
              style={({ pressed }) => [
                styles.play,
                { backgroundColor: c.prussian, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {status.playing ? (
                <View style={styles.pauseGlyph}>
                  <View style={[styles.pauseBar, { backgroundColor: c.bg }]} />
                  <View style={[styles.pauseBar, { backgroundColor: c.bg }]} />
                </View>
              ) : (
                <View style={[styles.playGlyph, { borderLeftColor: c.bg }]} />
              )}
            </Pressable>
            <View style={styles.wave}>
              {bars.map((h, i) => {
                const played = i / bars.length < progress
                return (
                  <View
                    key={i}
                    style={{
                      width: 2,
                      height: h,
                      backgroundColor: c.prussian,
                      borderRadius: 1,
                      opacity: played ? 1 : 0.35,
                      marginRight: 2,
                    }}
                  />
                )
              })}
            </View>
            <Mono size={12} color={c.ink2} letterSpacing={0.48}>
              {formatDurationSeconds(status.currentTime > 0 ? status.currentTime : durationSeconds)}
            </Mono>
          </View>
          {playerError && (
            <Sans size={12} lineHeight={17} color={c.recRed} style={{ marginTop: 8 }}>
              {playerError}
            </Sans>
          )}
        </View>
      )}

      {item.tags && item.tags.length > 0 && (
        <View style={styles.tags}>
          {item.tags.map((tag) => <Tag key={tag} label={tag} />)}
        </View>
      )}

      <View style={[styles.actions, { borderTopColor: c.border }]}>
        <ActionButton label="Editar" onPress={onEdit} />
        <ActionButton label="Mover" onPress={onMove} />
        <ActionButton label="Excluir" onPress={onDelete} danger />
      </View>
    </View>
  )
}

function formatDuration(durationMs?: number | null): string {
  if (!durationMs) return '0:00'
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  return formatDurationSeconds(seconds)
}

function formatDurationSeconds(secondsValue?: number | null): string {
  const seconds = Math.max(0, Math.round(secondsValue ?? 0))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function DomainPill({ domain, accent }: { domain: DomainKey; accent: string }) {
  const { c } = useTheme()
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
      <Sans
        weight="med"
        size={11}
        letterSpacing={0.88}
        color={accent}
        style={{ textTransform: 'uppercase' }}
      >
        {domainLabel(domain)}
      </Sans>
    </View>
  )
}

function Tag({ label }: { label: string }) {
  const { c } = useTheme()
  return (
    <View style={[styles.tag, { borderColor: c.border }]}>
      <Sans weight="med" size={12} color={c.ink2}>
        {label}
      </Sans>
    </View>
  )
}

function ActionButton({
  label,
  danger,
  onPress,
}: {
  label: string
  danger?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: pressed ? c.surface : 'transparent',
          borderColor: danger ? c.recRed : c.border,
        },
      ]}
    >
      <Sans
        weight="med"
        size={13}
        align="center"
        color={danger ? c.recRed : c.ink}
      >
        {label}
      </Sans>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 6, paddingBottom: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
  pauseGlyph: {
    width: 13,
    height: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pauseBar: {
    width: 4,
    height: 16,
    borderRadius: 1.5,
  },
  wave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  tags: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tag: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
