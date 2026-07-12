import { DotLeader } from '../components/atlas-ui/DotLeader'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { Screen } from '../components/Screen'
import { CodexReveal } from '../components/CodexReveal'
import { EmptyWeekly } from '../components/EmptyWeekly'
import { Frau, Mono } from '../design/Type'
import { usePalette } from '../design/theme'
import {
  Masthead,
  EditorialDateline,
  SectionHead,
  FolioFooter,
} from '../components/editorial'
import { SignatureGesture } from '../components/edition/SignatureGesture'
import { dailyFolio } from '../lib/folio'
import { useAtlasStore, visibleCaptures } from '../lib/atlasStore'
import { domainLabel, type DomainKey } from '../lib/domains'

// Tela REVIEW · weekly canônico editorial.
// Substitui greeting "Semana atual" + PrimaryButton + Sparkle por canon:
// Masthead "REVIEW" + EditorialDateline com período · SectionHeads numeradas ·
// tabela dot-leader Panorama · SignatureGesture "atualizar dados." ·
// FolioFooter "FOLIO N · REVIEW".
//
// Funcionalidades preservadas: visibleCaptures, sync, range semanal.
export default function ReviewScreen() {
  const c = usePalette()
  const captures = useAtlasStore((s) => s.captures)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures)
  const sync = useAtlasStore((s) => s.sync)
  const syncing = useAtlasStore((s) => s.syncing)
  const range = useMemo(() => currentWeekRange(), [])
  const folio = useMemo(() => dailyFolio(), [])

  const weeklyCaptures = useMemo(() => (
    visibleCaptures({ captures, queuedCaptures })
      .filter((capture) => {
        const capturedAt = new Date(capture.captured_at)
        return capturedAt >= range.start && capturedAt <= range.end
      })
  ), [captures, queuedCaptures, range.end, range.start])

  const rows = useMemo(() => weeklyRows(weeklyCaptures), [weeklyCaptures])

  return (
    <Screen bare>
      <Masthead title="REVIEW" folio={null} />
      <EditorialDateline date={formatRange(range.start, range.end)} edition="semana corrente" />

      {/* i. RESUMO REAL */}
      <Animated.View entering={FadeInDown.duration(460).delay(60).easing(Easing.bezier(0.16, 1, 0.3, 1)).springify().damping(22).stiffness(180)}>
        <SectionHead
          numeral="i"
          title="Resumo"
          deck={weeklyCaptures.length === 1 ? 'uma captura nesta semana' : `${weeklyCaptures.length} capturas nesta semana`}
        />
      </Animated.View>
      <CodexReveal index={0}>
        {weeklyCaptures.length === 0 ? (
          <View style={styles.contentRail}>
            <EmptyWeekly />
          </View>
        ) : (
          <View style={styles.tableWrap}>
            {rows.map((row, idx) => (
              <Animated.View
                key={row.label}
                entering={FadeInDown.duration(360).delay(40 * idx).easing(Easing.bezier(0.16, 1, 0.3, 1)).springify().damping(22).stiffness(180)}
                style={[
                  styles.row,
                  idx === 0 && { borderTopColor: c.borderSoft, borderTopWidth: StyleSheet.hairlineWidth },
                  { borderBottomColor: c.borderSoft },
                ]}
              >
                <Mono
                  size={11}
                  lineHeight={16}
                  letterSpacing={1.4}
                  color={c.ink2}
                  style={{ textTransform: 'uppercase' }}
                >
                  {row.label}
                </Mono>
                <DotLeader />
                <Frau
                  italic={!row.accent}
                  weight={row.accent ? 'med' : undefined}
                  size={14}
                  lineHeight={20}
                  color={row.accent ? c.bronze : c.ink}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {row.value}
                </Frau>
              </Animated.View>
            ))}
          </View>
        )}
      </CodexReveal>

      {/* ii. ÚLTIMA CAPTURA */}
      {weeklyCaptures.length > 0 ? (
        <>
          <Animated.View entering={FadeInDown.duration(460).delay(180).easing(Easing.bezier(0.16, 1, 0.3, 1)).springify().damping(22).stiffness(180)}>
            <SectionHead numeral="ii" title="Última captura" deck="marca temporal" />
          </Animated.View>
          <CodexReveal index={1}>
            <View style={styles.contentRail}>
              <Frau italic size={15} lineHeight={22} color={c.ink2}>
                Sincronizada do Atlas Server · {formatDateTime(weeklyCaptures[0]?.captured_at)}.
              </Frau>
            </View>
          </CodexReveal>
        </>
      ) : null}

      {/* Gesture footer · "atualizar dados." canon */}
      <CodexReveal index={2}>
        <View style={styles.gestureFooter}>
          <SignatureGesture
            label={syncing ? 'sincronizando…' : 'atualizar dados.'}
            onPress={() => { void sync() }}
            disabled={syncing}
            seal="external"
            haptic="light"
            accessibilityLabel="atualizar dados · sincronizar com Atlas Server"
          />
        </View>
      </CodexReveal>

      <FolioFooter number={folio.number} suffix="review" />
    </Screen>
  )
}


function weeklyRows(captures: ReturnType<typeof visibleCaptures>) {
  const audio = captures.filter((capture) => capture.kind === 'audio').length
  const text = captures.filter((capture) => capture.kind === 'text').length
  const photo = captures.filter((capture) => capture.kind === 'photo').length
  const domains = captures.reduce<Record<string, number>>((acc, capture) => {
    acc[capture.domain] = (acc[capture.domain] ?? 0) + 1
    return acc
  }, {})
  const topDomain = Object.entries(domains).sort((a, b) => b[1] - a[1])[0]
  return [
    { label: 'Áudios', value: String(audio), accent: audio > 0 },
    { label: 'Textos', value: String(text), accent: text > 0 },
    { label: 'Imagens', value: String(photo), accent: photo > 0 },
    { label: 'Domínio principal', value: topDomain ? `${domainLabel(topDomain[0] as DomainKey)} · ${topDomain[1]}` : 'sem dado', accent: !!topDomain },
  ]
}

function currentWeekRange(): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(now)
  start.setDate(now.getDate() + mondayOffset)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function formatRange(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
  })
  return `${formatter.format(start)} — ${formatter.format(end)}`
}

function formatDateTime(iso?: string): string {
  if (!iso) return 'sem dado'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

const styles = StyleSheet.create({
  contentRail: {
    marginHorizontal: 32,
  },
  tableWrap: {
    marginHorizontal: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  gestureFooter: {
    marginTop: 36,
    marginHorizontal: 32,
    alignItems: 'flex-start',
  },
})
