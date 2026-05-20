import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Frau, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import { fonts } from '../../../design/tokens'
import type {
  AtlasAiQualityAction,
  AtlasAiSessionState,
  AtlasAiTrace,
} from '../../../lib/api/client'
import {
  buildAtlasSessionMap,
  buildPinnedTraceSummary,
  matchesAtlasTraceSearch,
  sortAtlasTraces,
} from '../../../lib/atlasAiRuntime'
import { CaptionWhisper } from '../../console/CaptionWhisper'
import { BottomSheet } from '../BottomSheet'
import {
  DataSection,
  EmptyInline,
  SheetHeading,
  StatusPill,
} from './AtlasAiDataPrimitives'
import { providerWord } from './threadHistoryModel'

export function SearchSheet({
  visible,
  traces,
  pinnedTraceIds,
  onClose,
  onOpenExecution,
  onTogglePin,
  responseTextForTrace,
}: {
  visible: boolean
  traces: AtlasAiTrace[]
  pinnedTraceIds: string[]
  onClose: () => void
  onOpenExecution: (trace: AtlasAiTrace) => void
  onTogglePin: (trace: AtlasAiTrace) => void
  responseTextForTrace: (trace: AtlasAiTrace) => string
}) {
  const { c } = useTheme()
  const [query, setQuery] = useState('')
  const results = useMemo(
    () => sortAtlasTraces(traces).filter((trace) => matchesAtlasTraceSearch(trace, query)).slice(-30).reverse(),
    [query, traces],
  )

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading title="Buscar na sessão" subtitle={`${traces.length} turns carregados`} />

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="buscar por contexto, arquivo, decisão…"
          placeholderTextColor={c.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
          selectionColor={c.bronze}
          cursorColor={c.bronze}
          style={[styles.searchInput, { color: c.ink, borderBottomColor: c.border }]}
        />

        <DataSection title="resultados">
          {results.length === 0 ? (
            <EmptyInline text="nada encontrado nesta sessão" />
          ) : results.map((trace) => {
            const pinned = pinnedTraceIds.includes(trace.id)
            return (
              <View key={trace.id} style={[styles.executionRow, { borderTopColor: c.border }]}>
                <View style={styles.rowSplit}>
                  <Sans weight="med" size={13} lineHeight={18} color={c.ink} numberOfLines={1}>
                    {truncateForDisplay(trace.operator_input || 'sem pergunta', 96)}
                  </Sans>
                  <StatusPill status={trace.status} />
                </View>
                <Sans size={12} lineHeight={18} color={c.ink2} numberOfLines={3}>
                  {truncateForDisplay(responseTextForTrace(trace) || trace.job?.error_message || 'sem resposta', 260)}
                </Sans>
                <CaptionWhisper text={`${providerWord(trace.provider) ?? 'atlas'} · ${formatRelative(trace.created_at)}`} />
                <View style={styles.inlineActions}>
                  <SheetAction
                    label={pinned ? 'fixado' : 'fixar'}
                    active={pinned}
                    onPress={() => onTogglePin(trace)}
                  />
                  <SheetAction
                    label="execução"
                    onPress={() => {
                      onOpenExecution(trace)
                      onClose()
                    }}
                  />
                </View>
              </View>
            )
          })}
        </DataSection>
      </ScrollView>
    </BottomSheet>
  )
}

export function SessionMapSheet({
  visible,
  state,
  traces,
  qualityActions,
  pinnedTraceIds,
  onClose,
}: {
  visible: boolean
  state: AtlasAiSessionState | null
  traces: AtlasAiTrace[]
  qualityActions: AtlasAiQualityAction[]
  pinnedTraceIds: string[]
  onClose: () => void
}) {
  const map = useMemo(
    () => buildAtlasSessionMap({ state, traces, qualityActions, pinnedTraceIds }),
    [pinnedTraceIds, qualityActions, state, traces],
  )
  const pinned = useMemo(
    () => buildPinnedTraceSummary(traces, pinnedTraceIds),
    [pinnedTraceIds, traces],
  )

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading title="Mapa da sessão" subtitle="decisões, tarefas, código e riscos" />

        <DataSection title="fixados">
          <MappedList items={pinned} empty="nenhum turn fixado" />
        </DataSection>

        <DataSection title="decisões">
          <MappedList items={map.decisions} empty="nenhuma decisão explícita" />
        </DataSection>

        <DataSection title="tarefas abertas">
          <MappedList items={map.actions} empty="nenhuma tarefa aberta" />
        </DataSection>

        <DataSection title="código e artefatos">
          <MappedList items={map.code} empty="nenhum artefato técnico detectado" />
        </DataSection>

        <DataSection title="erros e riscos">
          <MappedList items={map.errors} empty="nenhum erro detectado" />
        </DataSection>
      </ScrollView>
    </BottomSheet>
  )
}

function SheetAction({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  // Slice 6af · haptic Soft + press scale spring canon premium
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    onPress()
  }
  const pressScale = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))
  return (
    <Animated.View style={pressAnimStyle}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        hitSlop={8}
        onPressIn={() => {
          pressScale.value = withTiming(0.96, { duration: 120, easing: Easing.out(Easing.quad) })
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.7 })
        }}
        style={({ pressed }) => [
          styles.microAction,
          {
            borderColor: active ? c.bronze : c.border,
            backgroundColor: pressed ? c.bgRaised : 'transparent',
            opacity: disabled ? 0.35 : 1,
          },
        ]}
      >
        <Frau italic size={12} lineHeight={16} color={active ? c.bronze : c.ink2}>
          {label}
        </Frau>
      </Pressable>
    </Animated.View>
  )
}

function MappedList({ items, empty }: { items: string[]; empty: string }) {
  const { c } = useTheme()
  if (items.length === 0) return <EmptyInline text={empty} />
  return (
    <View style={styles.mappedList}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.mappedRow}>
          <Sans size={14} lineHeight={20} color={c.bronze} style={styles.mappedMarker}>
            —
          </Sans>
          <Sans size={13} lineHeight={19} color={c.ink} style={styles.mappedText}>
            {item}
          </Sans>
        </View>
      ))}
    </View>
  )
}

function truncateForDisplay(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function formatRelative(value: string | null | undefined): string {
  if (!value) return 'agora'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.round(hours / 24)
  return `${days} d`
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
  },
  searchInput: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 42,
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  executionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 7,
  },
  rowSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  microAction: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mappedList: {
    gap: 9,
  },
  mappedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  mappedMarker: {
    width: 12,
    paddingTop: 1,
  },
  mappedText: {
    flex: 1,
  },
})
