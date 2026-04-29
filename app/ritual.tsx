import { Pressable, StyleSheet, View } from 'react-native'
import { useMemo } from 'react'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { Sparkle } from '../components/Sparkle'
import { PrimaryButton } from '../components/PrimaryButton'
import { EmptyMission } from '../components/EmptyMission'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import {
  deviceTimezone,
  formatPassiveSignal,
  latestCheckin,
  latestPassiveSignal,
  localDateKey,
  useAtlasStore,
  visibleBehaviorLogs,
  visibleBehaviors,
  visiblePassiveSignals,
} from '../lib/atlasStore'
import { buildReadinessV1 } from '../lib/readiness'

export default function RitualScreen() {
  const c = usePalette()
  const router = useRouter()
  const mission = useAtlasStore((s) => s.mission)
  const checkins = useAtlasStore((s) => s.checkins)
  const queuedCheckins = useAtlasStore((s) => s.queuedCheckins)
  const passiveSignals = useAtlasStore((s) => s.passiveSignals)
  const queuedPassiveSignals = useAtlasStore((s) => s.queuedPassiveSignals)
  const behaviors = useAtlasStore((s) => s.behaviors)
  const queuedBehaviors = useAtlasStore((s) => s.queuedBehaviors)
  const behaviorLogs = useAtlasStore((s) => s.behaviorLogs)
  const queuedBehaviorLogs = useAtlasStore((s) => s.queuedBehaviorLogs)
  const logBehavior = useAtlasStore((s) => s.logBehavior)
  const latestState = latestCheckin({ checkins, queuedCheckins })
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
  const sleep = latestPassiveSignal({ passiveSignals, queuedPassiveSignals }, 'sleep_duration_hours')
  const hrv = latestPassiveSignal({ passiveSignals, queuedPassiveSignals }, 'hrv_ms')
  const question = missionQuestion(mission?.metadata)

  return (
    <Screen>
      <View style={{ marginBottom: 28 }}>
        <Label>Briefing matinal</Label>
        <Frau size={42} lineHeight={44} letterSpacing={-1.05} color={c.ink} style={{ marginTop: 6 }}>
          Bom dia,{'\n'}Vitor
        </Frau>
        <Mono size={12} color={c.ink2} letterSpacing={0.48} style={{ marginTop: 10, textTransform: 'uppercase' }}>
          {todayLine()} · {deviceTimezone()}
        </Mono>
      </View>

      {!mission ? (
        <EmptyMission onDefine={() => router.push('/capture')} />
      ) : (
        <View
          style={[
            styles.missionCard,
            { backgroundColor: c.premium, borderColor: c.border, borderLeftColor: c.bronze },
          ]}
        >
          <View style={styles.starRow}>
            <Sparkle size={13} />
            <Sans
              weight="med"
              size={10.5}
              letterSpacing={1.05}
              color={c.bronze}
              style={{ textTransform: 'uppercase' }}
            >
              Missão de hoje
            </Sans>
          </View>
          <Sans weight="sb" size={17} lineHeight={22} color={c.ink} style={{ marginBottom: 4 }}>
            {mission.title}
          </Sans>
          <Mono size={11.5} color={c.ink2} letterSpacing={0.23}>
            {mission.detail ?? mission.status.toUpperCase()}
          </Mono>
        </View>
      )}

      <Label style={{ marginBottom: 10 }}>A pergunta do dia</Label>
      <View style={[styles.questionBlock, { borderLeftColor: c.bronze }]}>
        <Frau italic size={17} lineHeight={26} color={c.ink}>
          {question ? `“${question}”` : 'Nenhuma pergunta registrada para hoje.'}
        </Frau>
      </View>

      <BitaculaBriefing
        behaviors={visibleBehaviors({ behaviors, queuedBehaviors })}
        logs={visibleBehaviorLogs({ behaviorLogs, queuedBehaviorLogs })}
        onOpen={() => router.push('/bitacula')}
        onToggle={(behaviorClientId, value, date) => {
          void logBehavior({
            behaviorClientId,
            logDate: date,
            value,
            source: 'morning_briefing',
            metadata: { entrypoint: 'morning_briefing' },
          })
        }}
      />

      <Pressable
        onPress={() => router.push('/memory')}
        style={({ pressed }) => [
          styles.memoryEntry,
          { backgroundColor: pressed ? c.premium : c.surface, borderColor: c.border },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Memória semântica</Label>
          <Sans size={14} lineHeight={20} color={c.ink2} style={{ marginTop: 6 }}>
            Revisar ativações, curar capturas e buscar no vault.
          </Sans>
        </View>
        <Mono size={11} letterSpacing={0.22} color={c.prussian}>
          ABRIR
        </Mono>
      </Pressable>

      <Label style={{ marginTop: 26, marginBottom: 10 }}>Estado físico</Label>
      <View style={[styles.physical, { backgroundColor: c.surface, borderColor: c.border }]}>
        <PhysicalRow label="Prontidão" value={readiness.base.display} />
        <PhysicalRow label="Agora" value={readiness.current.display} />
        <PhysicalRow label="Sono" value={formatPassiveSignal(sleep)} />
        <PhysicalRow label="HRV" value={formatPassiveSignal(hrv)} />
        <PhysicalRow label="Energia" value={latestState ? `${latestState.energy_level} / 5` : 'Sem check-in'} last />
      </View>

      <View style={{ height: 28 }} />
      <PrimaryButton
        label="Começar o dia"
        onPress={() => router.push('/capture')}
      />
    </Screen>
  )
}

function BitaculaBriefing({
  behaviors,
  logs,
  onOpen,
  onToggle,
}: {
  behaviors: ReturnType<typeof visibleBehaviors>
  logs: ReturnType<typeof visibleBehaviorLogs>
  onOpen: () => void
  onToggle: (behaviorClientId: string, value: string, date: string) => void
}) {
  const c = usePalette()
  const date = yesterdayDateKey()
  const activeBehaviors = behaviors
    .filter((behavior) => !behavior.archived_at && behavior.show_in_morning_briefing)
    .slice(0, 12)
  const logsByBehavior = new Map(
    logs
      .filter((log) => log.log_date === date && !log.reverted_at)
      .map((log) => [log.behavior_client_id, log]),
  )

  return (
    <>
      <View style={styles.bitaculaHead}>
        <Label>Bitácula · ontem</Label>
        <Pressable onPress={onOpen} hitSlop={8}>
          <Mono size={11} letterSpacing={0.22} color={c.prussian}>
            GERIR
          </Mono>
        </Pressable>
      </View>
      <View style={[styles.bitaculaPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {activeBehaviors.length === 0 ? (
          <Pressable
            onPress={onOpen}
            style={({ pressed }) => [
              styles.emptyBitacula,
              { backgroundColor: pressed ? c.premium : 'transparent' },
            ]}
          >
            <Sans size={14} lineHeight={20} color={c.ink2}>
              Adicione comportamentos pequenos para cruzar com sono, saúde, foco e capturas.
            </Sans>
          </Pressable>
        ) : activeBehaviors.map((behavior, index) => {
          const current = logsByBehavior.get(behavior.client_id)
          const isYes = current?.value === 'yes'
          const nextValue = isYes ? 'no' : 'yes'

          return (
            <Pressable
              key={behavior.client_id}
              onPress={() => onToggle(behavior.client_id, nextValue, date)}
              style={({ pressed }) => [
                styles.bitaculaRow,
                !isYes && { backgroundColor: pressed ? c.premium : 'transparent' },
                isYes && { backgroundColor: c.prussian },
                index < activeBehaviors.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Sans weight="med" size={15} color={isYes ? c.bg : c.ink}>
                  {behavior.name}
                </Sans>
                <Sans size={12} lineHeight={17} color={isYes ? c.bg : c.ink2} style={{ opacity: isYes ? 0.82 : 1 }}>
                  {behavior.question_text}
                </Sans>
              </View>
              <Mono size={11} letterSpacing={0.44} color={isYes ? c.bg : c.ink2}>
                {isYes ? 'SIM' : 'NÃO'}
              </Mono>
            </Pressable>
          )
        })}
      </View>
    </>
  )
}

function yesterdayDateKey(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return localDateKey(date)
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

function PhysicalRow({
  label,
  value,
  up,
  down,
  last,
}: {
  label: string
  value: string
  up?: boolean
  down?: boolean
  last?: boolean
}) {
  const c = usePalette()
  const valueColor = up ? c.moss : down ? c.recRed : c.ink
  return (
    <View style={[styles.physicalRow, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Sans size={15} color={c.ink}>{label}</Sans>
      <Mono size={14} color={valueColor}>{value}</Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  missionCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 26,
  },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  questionBlock: {
    paddingLeft: 14,
    borderLeftWidth: 2,
  },
  bitaculaHead: {
    marginTop: 26,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bitaculaPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  emptyBitacula: {
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  bitaculaRow: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  physical: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginTop: 8,
  },
  physicalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  memoryEntry: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
})
