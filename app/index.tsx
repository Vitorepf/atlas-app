import { Pressable, StyleSheet, View } from 'react-native'
import { useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { SectionHeader } from '../components/SectionHeader'
import { Tile } from '../components/Tile'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useOverlays } from '../lib/overlays'
import { useShell } from '../components/AtlasShell'
import {
  deviceTimezone,
  formatPassiveSignal,
  latestCheckin,
  latestPassiveSignal,
  useAtlasStore,
  visibleBehaviors,
  visibleCaptures,
  visiblePassiveSignals,
} from '../lib/atlasStore'
import type { AtlasCheckin } from '../lib/api/client'
import { buildReadinessV1 } from '../lib/readiness'

const CHECKIN_STATES: Array<{ key: AtlasCheckin['state']; label: string }> = [
  { key: 'focused', label: 'Foco' },
  { key: 'disperse', label: 'Disperso' },
  { key: 'blocked', label: 'Bloqueado' },
  { key: 'pause', label: 'Pausa' },
]

export default function HomeScreen() {
  const c = usePalette()
  const router = useRouter()
  const openSettings = useOverlays((s) => s.openSettings)
  const { showToast } = useShell()
  const captures = useAtlasStore((s) => s.captures)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures)
  const checkins = useAtlasStore((s) => s.checkins)
  const queuedCheckins = useAtlasStore((s) => s.queuedCheckins)
  const passiveSignals = useAtlasStore((s) => s.passiveSignals)
  const queuedPassiveSignals = useAtlasStore((s) => s.queuedPassiveSignals)
  const behaviors = useAtlasStore((s) => s.behaviors)
  const queuedBehaviors = useAtlasStore((s) => s.queuedBehaviors)
  const mission = useAtlasStore((s) => s.mission)
  const createCheckin = useAtlasStore((s) => s.createCheckin)
  const [checkinState, setCheckinState] = useState<AtlasCheckin['state'] | null>(null)
  const [energyLevel, setEnergyLevel] = useState<number | null>(null)
  const [moodLevel, setMoodLevel] = useState<number | null>(null)

  const captureCountToday = useMemo(() => {
    const today = new Date().toDateString()
    return visibleCaptures({ captures, queuedCaptures })
      .filter((capture) => new Date(capture.captured_at).toDateString() === today)
      .length
  }, [captures, queuedCaptures])
  const latestState = useMemo(
    () => latestCheckin({ checkins, queuedCheckins }),
    [checkins, queuedCheckins],
  )
  const allSignals = useMemo(
    () => visiblePassiveSignals({ passiveSignals, queuedPassiveSignals }),
    [passiveSignals, queuedPassiveSignals],
  )
  const readiness = useMemo(
    () => buildReadinessV1({
      healthSignals: allSignals.filter((signal) => signal.source === 'healthkit'),
      allSignals,
      latestCheckin: latestState,
    }),
    [allSignals, latestState],
  )
  const sleep = useMemo(
    () => latestPassiveSignal({ passiveSignals, queuedPassiveSignals }, 'sleep_duration_hours'),
    [passiveSignals, queuedPassiveSignals],
  )
  const hrv = useMemo(
    () => latestPassiveSignal({ passiveSignals, queuedPassiveSignals }, 'hrv_ms'),
    [passiveSignals, queuedPassiveSignals],
  )
  const question = missionQuestion(mission?.metadata)
  const canSaveCheckin = checkinState !== null && energyLevel !== null && moodLevel !== null
  const activeBehaviorCount = useMemo(() => (
    visibleBehaviors({ behaviors, queuedBehaviors })
      .filter((behavior) => !behavior.archived_at && behavior.show_in_morning_briefing)
      .length
  ), [behaviors, queuedBehaviors])

  const saveCheckin = async () => {
    if (!checkinState || !energyLevel || !moodLevel) return

    await createCheckin({
      state: checkinState,
      energyLevel,
      moodLevel,
      metadata: { entrypoint: 'home_checkin' },
    })
    setCheckinState(null)
    setEnergyLevel(null)
    setMoodLevel(null)
    showToast('Check-in registrado', { variant: 'checkin' })
  }

  return (
    <Screen>
      <View style={styles.greetRow}>
        <View style={{ flex: 1 }}>
          <Frau size={38} lineHeight={40} letterSpacing={-0.95} color={c.ink}>
            Bom dia,{'\n'}Vitor
          </Frau>
          <Mono size={11} lineHeight={14} letterSpacing={0.44} color={c.ink2} style={{ marginTop: 6, textTransform: 'uppercase' }}>
            {todayLine()} · {deviceTimezone()}
          </Mono>
        </View>
        <Pressable
          onPress={openSettings}
          accessibilityLabel="Configurações"
          style={({ pressed }) => [
            styles.gear,
            {
              backgroundColor: pressed ? c.surface : 'transparent',
              borderColor: pressed ? c.border : 'transparent',
            },
          ]}
        >
          <GearIcon color={c.ink2} />
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: c.ink2, opacity: 0.5 }]} />

      <View style={[styles.prompt, { borderLeftColor: c.bronze }]}>
        <Frau italic size={18} lineHeight={26} color={c.ink2}>
          {question ? `“${question}”` : 'Nenhuma pergunta registrada para hoje.'}
        </Frau>
      </View>

      <SectionHeader label="Missão de hoje" />
      <Pressable
        onPress={() => router.push('/ritual')}
        style={({ pressed }) => [
          styles.mission,
          {
            backgroundColor: pressed ? c.premium : c.surface,
            borderColor: c.border,
            borderLeftColor: c.bronze,
          },
        ]}
      >
        <Sans weight="sb" size={16} lineHeight={20} color={c.ink} style={{ marginBottom: 4 }}>
          {mission?.title ?? 'Nenhuma missão definida'}
        </Sans>
        <Mono size={11} lineHeight={14} letterSpacing={0.22} color={c.ink2}>
          {mission?.detail ?? 'Abra o ritual para revisar o dia'}
        </Mono>
      </Pressable>

      <SectionHeader label="Estado físico" />
      <View style={styles.tileRow}>
        <Tile label="Prontidão" onPress={() => router.push('/health')}>
          {readiness.base.display}
        </Tile>
        <Tile label="Sono" onPress={() => router.push('/sleep')}>
          {formatPassiveSignal(sleep)}
        </Tile>
      </View>
      <View style={[styles.tileRow, { marginTop: 12 }]}>
        <Tile label="HRV" onPress={() => router.push('/health')}>
          {formatPassiveSignal(hrv)}
        </Tile>
        <Tile label="Energia" onPress={() => router.push('/health')}>
          {latestState ? latestState.energy_level : 'Sem check-in'} {latestState && <Mono size={14} color={c.ink2}>/ 5</Mono>}
        </Tile>
      </View>

      <SectionHeader label="Capturas" />
      <View style={styles.tileRow}>
        <Tile label="Hoje" premium>
          {captureCountToday} <Mono size={13} color={c.ink2}>hoje</Mono>
        </Tile>
        <Tile label="Bitácula" onPress={() => router.push('/bitacula')}>
          {activeBehaviorCount} <Mono size={13} color={c.ink2}>ativos</Mono>
        </Tile>
      </View>

      <SectionHeader label="Check-in" />
      <View style={[styles.checkinPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Label>Estado</Label>
        <View style={styles.choiceRow}>
          {CHECKIN_STATES.map((state) => (
            <CheckinPill
              key={state.key}
              label={state.label}
              active={checkinState === state.key}
              onPress={() => setCheckinState(state.key)}
            />
          ))}
        </View>

        <Label style={{ marginTop: 14 }}>Energia</Label>
        <View style={styles.levelRow}>
          {[1, 2, 3, 4, 5].map((level) => (
            <LevelPill
              key={level}
              level={level}
              active={energyLevel === level}
              onPress={() => setEnergyLevel(level)}
            />
          ))}
        </View>

        <Label style={{ marginTop: 14 }}>Mood</Label>
        <View style={styles.levelRow}>
          {[1, 2, 3, 4, 5].map((level) => (
            <LevelPill
              key={level}
              level={level}
              active={moodLevel === level}
              onPress={() => setMoodLevel(level)}
            />
          ))}
        </View>

        <Pressable
          onPress={() => {
            void saveCheckin()
          }}
          disabled={!canSaveCheckin}
          style={({ pressed }) => [
            styles.saveCheckin,
            {
              backgroundColor: canSaveCheckin ? c.ink : 'transparent',
              borderColor: canSaveCheckin ? c.ink : c.border,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Sans weight="sb" size={14} color={canSaveCheckin ? c.bg : c.ink2} align="center">
            {canSaveCheckin ? 'Registrar check-in' : 'Escolha estado, energia e mood'}
          </Sans>
        </Pressable>
      </View>

      <SectionHeader label="Ritual" />
      <View style={styles.tileRow}>
        <Tile label="Briefing matinal" onPress={() => router.push('/ritual')}>
          Abrir ritual
        </Tile>
        <Tile label="Weekly review" onPress={() => router.push('/review')}>
          Abrir revisão
        </Tile>
      </View>
    </Screen>
  )
}

function CheckinPill({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choicePill,
        {
          backgroundColor: active ? c.prussian : 'transparent',
          borderColor: active ? c.prussian : c.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Sans weight="med" size={12} color={active ? c.bg : c.ink2}>
        {label}
      </Sans>
    </Pressable>
  )
}

function LevelPill({
  level,
  active,
  onPress,
}: {
  level: number
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.levelPill,
        {
          backgroundColor: active ? c.bronze : 'transparent',
          borderColor: active ? c.bronze : c.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Mono size={13} color={active ? c.bg : c.ink2}>
        {level}
      </Mono>
    </Pressable>
  )
}

function todayLine(): string {
  const date = new Date()
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(date)
    .replace('.', '')
    .toUpperCase()
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(date)
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(date)
    .replace('.', '')
    .toUpperCase()
  const year = new Intl.DateTimeFormat('pt-BR', { year: 'numeric' }).format(date)

  return `${weekday} · ${day}.${month}.${year}`
}

function missionQuestion(metadata?: Record<string, unknown>): string | null {
  const question = metadata?.question
  return typeof question === 'string' && question.trim() ? question.trim() : null
}

function GearIcon({ color }: { color: string }) {
  // Simple gear glyph drawn via overlapping rotated rectangles.
  return (
    <View style={{ width: 18, height: 18 }}>
      <View
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          width: 6,
          height: 6,
          borderRadius: 3,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      {[0, 45, 90, 135].map((deg) => (
        <View
          key={deg}
          style={{
            position: 'absolute',
            left: 8.25,
            top: 0,
            width: 1.5,
            height: 18,
            backgroundColor: color,
            transform: [{ rotate: `${deg}deg` }],
            opacity: 0.7,
          }}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  greetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  gear: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { width: 28, height: 1, marginTop: 22, marginBottom: 22 },
  prompt: {
    paddingLeft: 14,
    borderLeftWidth: 2,
    marginBottom: 8,
  },
  mission: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  tileRow: { flexDirection: 'row', gap: 12 },
  checkinPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choicePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  levelRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  levelPill: {
    width: 36,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCheckin: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
})
