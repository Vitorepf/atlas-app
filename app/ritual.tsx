import { StyleSheet, View } from 'react-native'
import { useMemo } from 'react'
import { useRouter } from 'expo-router'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { Screen } from '../components/Screen'
import { CodexReveal } from '../components/CodexReveal'
import { EmptyMission } from '../components/EmptyMission'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import {
  Masthead,
  EditorialDateline,
  EditorialPullQuote,
  SectionHead,
  TocRow,
  FolioFooter,
} from '../components/editorial'
import { PressableSurfaceScale } from '../components/atlas-ui/PressableScale'
import { SignatureGesture } from '../components/edition/SignatureGesture'
import {
  currentEdition,
  dailyFolio,
  editorialDateLine,
} from '../lib/folio'
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
import { selectBitaculaBriefingItems } from '../lib/bitaculaBriefing'
import { buildReadinessV1 } from '../lib/readiness'
import { isCheckinLevelFresh } from '../lib/checkinFreshness'

// Tela RITUAL · briefing matinal canon editorial.
//
// Substitui greeting servil "Bom dia, Vitor" pelo Masthead canon "RITUAL".
// Cada bloco vira section editorial numerada (i. MISSÃO · ii. PERGUNTA ·
// iii. BITÁCULA · iv. MEMÓRIA · v. ESTADO). Mission card vira EditorialPullQuote.
// Question reusa PullQuote canon. Memory vira TocRow doorway. Physical vira
// tabela dot-leader (canon Panorama). PrimaryButton vira SignatureGesture
// "começar o dia." italic Frau bronzeDeep + hairline prussian (commit ritual).
//
// Funcionalidades preservadas integralmente: dados (mission, readiness,
// sleep/hrv, behaviors, logs), navegação (memory, bitácula, capture).
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
  const currentLevelState = isCheckinLevelFresh(latestState) ? latestState : null
  const checkinsForReadiness = useMemo(
    () => (latestState ? [latestState, ...checkins] : checkins),
    [checkins, latestState],
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
      checkins: checkinsForReadiness,
    }),
    [allSignals, checkinsForReadiness, latestState],
  )
  const sleep = latestPassiveSignal({ passiveSignals, queuedPassiveSignals }, 'sleep_duration_hours')
  const hrv = latestPassiveSignal({ passiveSignals, queuedPassiveSignals }, 'hrv_ms')
  const question = missionQuestion(mission?.metadata)
  const folio = useMemo(() => dailyFolio(), [])

  return (
    <Screen bare>
      <Masthead title="RITUAL" folio={null} />
      <EditorialDateline date={editorialDateLine()} edition={`briefing matinal · ${deviceTimezone()}`} />

      {/* i. MISSÃO */}
      <Animated.View entering={FadeInDown.duration(460).delay(60).easing(Easing.bezier(0.16, 1, 0.3, 1)).springify().damping(22).stiffness(180)}>
        <SectionHead numeral="i" title="Missão" deck="o que sela este dia" />
      </Animated.View>
      <CodexReveal index={0}>
        {!mission ? (
          <View style={styles.contentRail}>
            <EmptyMission onDefine={() => router.push('/capture')} />
          </View>
        ) : (
          <EditorialPullQuote
            quote={mission.title}
            attribution={mission.detail ?? 'missão de hoje'}
          />
        )}
      </CodexReveal>

      {/* ii. PERGUNTA DO DIA */}
      <Animated.View entering={FadeInDown.duration(460).delay(120).easing(Easing.bezier(0.16, 1, 0.3, 1)).springify().damping(22).stiffness(180)}>
        <SectionHead numeral="ii" title="Pergunta do dia" />
      </Animated.View>
      <CodexReveal index={1}>
        {question ? (
          <EditorialPullQuote quote={question} attribution="pergunta de hoje" />
        ) : (
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
              em pergunta registrada para hoje.
            </Frau>
          </View>
        )}
      </CodexReveal>

      {/* iii. BITÁCULA · ontem */}
      <Animated.View entering={FadeInDown.duration(460).delay(180).easing(Easing.bezier(0.16, 1, 0.3, 1)).springify().damping(22).stiffness(180)}>
        <SectionHead numeral="iii" title="Bitácula" deck="ontem · marcar fatores" />
      </Animated.View>
      <CodexReveal index={2}>
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
      </CodexReveal>

      {/* iv. MEMÓRIA */}
      <Animated.View entering={FadeInDown.duration(460).delay(240).easing(Easing.bezier(0.16, 1, 0.3, 1)).springify().damping(22).stiffness(180)}>
        <SectionHead numeral="iv" title="Memória" />
      </Animated.View>
      <CodexReveal index={3}>
        <TocRow
          label="Memória semântica"
          value="revisar · curar · buscar"
          onPress={() => router.push('/memory')}
          accessibilityLabel="abrir memória semântica · revisar, curar e buscar no vault"
          variant="codex"
        />
      </CodexReveal>

      {/* v. ESTADO FÍSICO · tabela dot-leader canon Panorama */}
      <Animated.View entering={FadeInDown.duration(460).delay(300).easing(Easing.bezier(0.16, 1, 0.3, 1)).springify().damping(22).stiffness(180)}>
        <SectionHead numeral="v" title="Estado físico" deck="instrumentos do dia" />
      </Animated.View>
      <CodexReveal index={4}>
        <View style={styles.physicalWrap}>
          <PhysicalRow label="Prontidão" value={readiness.base.display} first />
          <PhysicalRow label="Agora" value={readiness.current.display} />
          <PhysicalRow label="Sono" value={formatPassiveSignal(sleep)} />
          <PhysicalRow label="HRV" value={formatPassiveSignal(hrv)} />
          <PhysicalRow label="Energia" value={currentLevelState ? `${currentLevelState.energy_level} / 5` : 'sem check-in'} last />
        </View>
      </CodexReveal>

      {/* Gesture footer · "começar o dia." italic Frau bronzeDeep + hairline prussian.
          Era PrimaryButton solid ink chapado · agora gesto cerimonial canon
          (mesmo DNA do "registrar." do hub edição). */}
      <CodexReveal index={5}>
        <View style={styles.gestureFooter}>
          <SignatureGesture
            label="começar o dia."
            onPress={() => router.push('/capture')}
            seal="commit"
            haptic="light"
            accessibilityLabel="começar o dia · ir para captura"
          />
        </View>
      </CodexReveal>

      <FolioFooter number={folio.number} suffix="ritual" />
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
  const briefingItems = useMemo(
    () => selectBitaculaBriefingItems({ behaviors, logs, date, limit: 12 }),
    [behaviors, logs, date],
  )

  return (
    <View style={styles.contentRail}>
      {briefingItems.length === 0 ? (
        <PressableSurfaceScale
          onPress={onOpen}
          haptic="soft"
          accessibilityLabel="abrir bitácula para adicionar fatores"
        >
          <Frau italic size={15} lineHeight={22} color={c.ink2}>
            Adicione fatores pequenos para cruzar com sono, saúde, foco e capturas.
          </Frau>
        </PressableSurfaceScale>
      ) : (
        briefingItems.map(({ behavior, log }, index) => {
          const current = log
          const isYes = current?.value === 'yes'
          const nextValue = isYes ? 'no' : 'yes'
          return (
            <PressableSurfaceScale
              key={behavior.client_id}
              onPress={() => onToggle(behavior.client_id, nextValue, date)}
              haptic="light"
              accessibilityLabel={`${behavior.name} · ${isYes ? 'sim' : 'não'} · alternar`}
            >
              <View
                style={[
                  styles.bitaculaRow,
                  index < briefingItems.length - 1 && {
                    borderBottomColor: c.borderSoft,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                  isYes && { backgroundColor: c.bronzeVeil, borderColor: c.bronzeBorder },
                ]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Sans weight="med" size={15} color={isYes ? c.bronzeLight : c.ink}>
                    {behavior.name}
                  </Sans>
                  <Sans size={12} lineHeight={17} color={isYes ? c.bronzeLight : c.ink2} style={{ opacity: isYes ? 0.82 : 1 }}>
                    {behavior.question_text}
                  </Sans>
                </View>
                <Mono size={10.5} letterSpacing={1.4} color={isYes ? c.bronzeLight : c.ink2} style={{ textTransform: 'uppercase' }}>
                  {isYes ? 'sim' : 'não'}
                </Mono>
              </View>
            </PressableSurfaceScale>
          )
        })
      )}
      <View style={styles.bitaculaManageRow}>
        <SignatureGesture
          label="abrir bitácula."
          onPress={onOpen}
          seal="commit"
          haptic="soft"
          accessibilityLabel="abrir bitácula para gerir fatores"
        />
      </View>
    </View>
  )
}

function yesterdayDateKey(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return localDateKey(date)
}

function missionQuestion(metadata?: Record<string, unknown>): string | null {
  const question = metadata?.question
  return typeof question === 'string' && question.trim() ? question.trim() : null
}

function PhysicalRow({
  label,
  value,
  first,
  last,
}: {
  label: string
  value: string
  first?: boolean
  last?: boolean
}) {
  const c = usePalette()
  return (
    <View
      style={[
        styles.physicalRow,
        first && { borderTopColor: c.borderSoft, borderTopWidth: StyleSheet.hairlineWidth },
        !last && { borderBottomColor: c.borderSoft, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Mono
        size={11}
        lineHeight={16}
        letterSpacing={1.4}
        color={c.ink2}
        style={{ textTransform: 'uppercase' }}
      >
        {label}
      </Mono>
      <DotLeader />
      <Frau italic size={14} lineHeight={20} color={c.ink} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Frau>
    </View>
  )
}

function DotLeader() {
  const c = usePalette()
  return (
    <View style={styles.leader}>
      <Mono
        size={11}
        lineHeight={16}
        letterSpacing={2}
        color={c.ink3}
        numberOfLines={1}
        style={styles.leaderDots}
      >
        {'·'.repeat(60)}
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  contentRail: {
    marginHorizontal: 32,
  },
  bitaculaRow: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    borderRadius: 4,
  },
  bitaculaManageRow: {
    marginTop: 16,
  },
  physicalWrap: {
    marginHorizontal: 32,
  },
  physicalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 8,
    gap: 8,
  },
  leader: {
    flex: 1,
    overflow: 'hidden',
  },
  leaderDots: {
    opacity: 0.45,
  },
  gestureFooter: {
    marginTop: 36,
    marginHorizontal: 32,
    alignItems: 'flex-start',
  },
})
