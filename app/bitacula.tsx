import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { SectionHeader } from '../components/SectionHeader'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import {
  formatRelativeSync,
  localDateKey,
  useAtlasStore,
  visibleBehaviorLogs,
  visibleBehaviors,
} from '../lib/atlasStore'
import { getBitaculaAnalysis, normalizeBitaculaText } from '../lib/api/client'
import type { AtlasBehavior, BehaviorCategory, BitaculaAnalysisResponse } from '../lib/api/client'
import { useShell } from '../components/AtlasShell'
import {
  behaviorFactorPayload,
  normalizeBehaviorFactor,
  normalizedFactorFromServer,
  type NormalizedBehaviorFactor,
} from '../lib/bitaculaFactors'

const CATEGORIES: Array<{ key: BehaviorCategory; label: string }> = [
  { key: 'substancias', label: 'Substâncias' },
  { key: 'alimentacao', label: 'Alimentação' },
  { key: 'sono_ritmo', label: 'Sono/Ritmo' },
  { key: 'treino_movimento', label: 'Treino/Movimento' },
  { key: 'recuperacao', label: 'Recuperação' },
  { key: 'digital', label: 'Digital' },
  { key: 'trabalho_cognicao', label: 'Trabalho/Cognição' },
  { key: 'relacional', label: 'Relacional' },
  { key: 'saude_sintoma', label: 'Saúde/Sintoma' },
  { key: 'ambiente_rotina', label: 'Ambiente/Rotina' },
  { key: 'outro', label: 'Outro' },
]

function useFactorSuggestion(text: string): {
  factor: NormalizedBehaviorFactor | null
  normalizing: boolean
} {
  const [remoteFactorSuggestion, setRemoteFactorSuggestion] = useState<NormalizedBehaviorFactor | null>(null)
  const [normalizing, setNormalizing] = useState(false)
  const localFactorSuggestion = useMemo(() => normalizeBehaviorFactor(text), [text])

  useEffect(() => {
    const value = text.trim()
    setRemoteFactorSuggestion(null)

    if (value.length < 3) {
      setNormalizing(false)
      return
    }

    let cancelled = false
    const timeout = setTimeout(() => {
      setNormalizing(true)
      normalizeBitaculaText({ text: value, limit: 1 })
        .then((response) => {
          if (cancelled) return
          setRemoteFactorSuggestion(response.suggestions[0] ? normalizedFactorFromServer(response.suggestions[0]) : null)
        })
        .catch(() => {
          if (!cancelled) setRemoteFactorSuggestion(null)
        })
        .finally(() => {
          if (!cancelled) setNormalizing(false)
        })
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [text])

  return { factor: remoteFactorSuggestion ?? localFactorSuggestion, normalizing }
}

export default function BitaculaScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const behaviors = useAtlasStore((s) => s.behaviors)
  const queuedBehaviors = useAtlasStore((s) => s.queuedBehaviors)
  const behaviorLogs = useAtlasStore((s) => s.behaviorLogs)
  const queuedBehaviorLogs = useAtlasStore((s) => s.queuedBehaviorLogs)
  const createBehavior = useAtlasStore((s) => s.createBehavior)
  const updateBehavior = useAtlasStore((s) => s.updateBehavior)
  const logBehavior = useAtlasStore((s) => s.logBehavior)
  const lastSyncAt = useAtlasStore((s) => s.lastSyncAt)

  const allBehaviors = useMemo(
    () => visibleBehaviors({ behaviors, queuedBehaviors }),
    [behaviors, queuedBehaviors],
  )
  const allLogs = useMemo(
    () => visibleBehaviorLogs({ behaviorLogs, queuedBehaviorLogs }),
    [behaviorLogs, queuedBehaviorLogs],
  )
  const activeBehaviors = useMemo(
    () => allBehaviors.filter((behavior) => (
      !behavior.archived_at
        && behavior.show_in_morning_briefing
        && isPromptableStatus(behavior.lifecycle_status)
    )),
    [allBehaviors],
  )
  const heldBehaviors = useMemo(
    () => allBehaviors.filter((behavior) => (
      !behavior.archived_at
        && (!behavior.show_in_morning_briefing || !isPromptableStatus(behavior.lifecycle_status))
    )),
    [allBehaviors],
  )

  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [category, setCategory] = useState<BehaviorCategory>('outro')
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [relationalPrivacy, setRelationalPrivacy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [useSuggestedFactor, setUseSuggestedFactor] = useState(true)
  const [occurrenceText, setOccurrenceText] = useState('')
  const [occurrenceDate, setOccurrenceDate] = useState<'today' | 'yesterday'>('today')
  const [occurrenceTime, setOccurrenceTime] = useState('')
  const [occurrenceQuantity, setOccurrenceQuantity] = useState('')
  const [occurrenceUnit, setOccurrenceUnit] = useState('')
  const [occurrenceIntensity, setOccurrenceIntensity] = useState<number | null>(null)
  const [useSuggestedOccurrence, setUseSuggestedOccurrence] = useState(true)
  const [savingOccurrence, setSavingOccurrence] = useState(false)
  const [analysis, setAnalysis] = useState<BitaculaAnalysisResponse | null>(null)
  const [analysisLoadingFor, setAnalysisLoadingFor] = useState<string | null>(null)
  const { factor: factorSuggestion, normalizing: normalizingFactor } = useFactorSuggestion(name)
  const { factor: occurrenceSuggestion, normalizing: normalizingOccurrence } = useFactorSuggestion(occurrenceText)
  const selectedFactor = useSuggestedFactor ? factorSuggestion : null
  const selectedOccurrenceFactor = useSuggestedOccurrence ? occurrenceSuggestion : null
  const effectiveCategory = !categoryTouched && selectedFactor ? selectedFactor.category : category
  const effectiveQuestion = question.trim() || selectedFactor?.questionText || `${name.trim()} aconteceu ontem?`
  const canCreate = name.trim().length > 0 && activeBehaviors.length < 12 && !saving
  const canRegisterOccurrence = occurrenceText.trim().length > 0 && !savingOccurrence

  const saveBehavior = async () => {
    if (!canCreate) return

    setSaving(true)
    try {
      const factorPayload = behaviorFactorPayload(selectedFactor)
      await createBehavior({
        name: selectedFactor?.label ?? name,
        category: effectiveCategory,
        questionText: effectiveQuestion,
        parentFactor: factorPayload.parent_factor ?? null,
        factorCondition: factorPayload.factor_condition ?? null,
        targetOutcomes: factorPayload.target_outcomes ?? [],
        expectedLag: factorPayload.expected_lag ?? null,
        expectedDirection: factorPayload.expected_direction ?? null,
        granularityLevel: factorPayload.granularity_level ?? 'binary',
        sensitivityLevel: factorPayload.sensitivity_level ?? 'normal',
        derivedFrom: factorPayload.derived_from ?? {},
        operatorConfirmed: factorPayload.operator_confirmed ?? true,
        relationalPrivacy,
        metadata: {
          entrypoint: 'bitacula_screen',
          normalization: selectedFactor
            ? { source: selectedFactor.normalizer ?? 'local_catalog_v2', factor_id: selectedFactor.id, confidence: selectedFactor.confidence }
            : { source: 'local_catalog_v2', status: 'unmatched' },
        },
      })
      setName('')
      setQuestion('')
      setCategory('outro')
      setCategoryTouched(false)
      setRelationalPrivacy(false)
      setUseSuggestedFactor(true)
      showToast('Fator adicionado à Bitácula', { variant: 'checkin' })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao criar fator')
    } finally {
      setSaving(false)
    }
  }

  const registerOccurrence = async () => {
    if (!canRegisterOccurrence) return

    const text = occurrenceText.trim()
    const logDate = dateForOccurrence(occurrenceDate)
    const existingBehavior = findMatchingBehavior(allBehaviors, selectedOccurrenceFactor, text)
    setSavingOccurrence(true)

    try {
      let behaviorClientId = existingBehavior?.client_id
      let createdBehavior = false

      if (!behaviorClientId) {
        const factorPayload = behaviorFactorPayload(selectedOccurrenceFactor)
        behaviorClientId = await createBehavior({
          name: selectedOccurrenceFactor?.label ?? text,
          category: selectedOccurrenceFactor?.category ?? 'outro',
          questionText: selectedOccurrenceFactor?.questionText ?? `${text} aconteceu?`,
          parentFactor: factorPayload.parent_factor ?? null,
          factorCondition: factorPayload.factor_condition ?? null,
          targetOutcomes: factorPayload.target_outcomes ?? [],
          expectedLag: factorPayload.expected_lag ?? null,
          expectedDirection: factorPayload.expected_direction ?? null,
          granularityLevel: factorPayload.granularity_level ?? 'binary',
          sensitivityLevel: factorPayload.sensitivity_level ?? 'normal',
          derivedFrom: factorPayload.derived_from ?? {},
          operatorConfirmed: factorPayload.operator_confirmed ?? true,
          lifecycleStatus: 'manual_only',
          showInMorningBriefing: false,
          metadata: {
            entrypoint: 'bitacula_manual_occurrence',
            normalization: normalizationMetadata(selectedOccurrenceFactor),
            created_from_occurrence: true,
          },
        })
        createdBehavior = true
      }

      await logBehavior({
        behaviorClientId,
        logDate,
        value: 'yes',
        source: 'manual',
        note: text,
        occurredAt: occurredAtFor(logDate, occurrenceTime),
        quantityNumeric: parseOptionalNumber(occurrenceQuantity),
        quantityUnit: occurrenceUnit.trim() || null,
        intensity: occurrenceIntensity,
        context: {
          raw_text: text,
          occurrence_time_text: occurrenceTime.trim() || null,
        },
        metadata: {
          entrypoint: 'bitacula_manual_occurrence',
          event_text: text,
          factor_created: createdBehavior,
          matched_behavior_client_id: existingBehavior?.client_id ?? null,
          normalization: normalizationMetadata(selectedOccurrenceFactor),
        },
      })

      setOccurrenceText('')
      setOccurrenceTime('')
      setOccurrenceQuantity('')
      setOccurrenceUnit('')
      setOccurrenceIntensity(null)
      setUseSuggestedOccurrence(true)
      showToast(createdBehavior ? 'Ocorrência registrada; fator criado fora do briefing' : 'Ocorrência registrada', { variant: 'checkin' })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao registrar ocorrência')
    } finally {
      setSavingOccurrence(false)
    }
  }

  const changeLifecycle = async (behavior: AtlasBehavior, status: AtlasBehavior['lifecycle_status']) => {
    try {
      const archivedAt = status === 'manual_only' && behavior.lifecycle_status !== 'manual_only'
        ? behavior.archived_at
        : undefined

      await updateBehavior(behavior.client_id, {
        lifecycleStatus: status,
        showInMorningBriefing: isPromptableStatus(status),
        archivedAt,
        autoSuppressReason: status === 'baseline' ? 'operator_baseline' : status === 'dormant' ? 'operator_dormant' : null,
      })
      showToast(status === 'active' ? 'Fator voltou ao briefing' : 'Fator atualizado', { variant: 'checkin' })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao atualizar fator')
    }
  }

  const archiveBehavior = async (behavior: AtlasBehavior) => {
    try {
      await updateBehavior(behavior.client_id, {
        lifecycleStatus: 'manual_only',
        showInMorningBriefing: false,
        archivedAt: new Date().toISOString(),
        autoSuppressReason: 'operator_archived',
      })
      showToast('Fator arquivado', { variant: 'checkin' })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao arquivar fator')
    }
  }

  const loadAnalysis = async (behavior: AtlasBehavior) => {
    setAnalysisLoadingFor(behavior.client_id)
    try {
      const response = await getBitaculaAnalysis({ behavior_client_id: behavior.client_id, window_days: 60 })
      setAnalysis(response)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao carregar análise')
    } finally {
      setAnalysisLoadingFor(null)
    }
  }

  return (
    <Screen bottomPad={104}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <BackArrow color={c.ink2} />
        </Pressable>
        <Mono size={11} letterSpacing={0.44} color={c.ink2}>
          Sync · {formatRelativeSync(lastSyncAt)}
        </Mono>
      </View>

      <View style={styles.header}>
        <Label>Bitácula</Label>
        <Frau size={42} lineHeight={44} letterSpacing={-1.05} color={c.ink} style={{ marginTop: 8 }}>
          Caderno de bordo
        </Frau>
        <Mono size={12} letterSpacing={0.24} color={c.ink2} style={{ marginTop: 8 }}>
          {activeBehaviors.length}/12 ativos · {allLogs.length} registros
        </Mono>
      </View>

      <SectionHeader label="Registrar fator relevante" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ex.: cafeína após 14h"
          placeholderTextColor={c.ink3}
          autoCapitalize="sentences"
          autoCorrect={false}
          selectionColor={c.prussian}
          style={[styles.input, { color: c.ink, borderBottomColor: c.border }]}
        />
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Pergunta opcional; Atlas gera se ficar vazio"
          placeholderTextColor={c.ink3}
          autoCapitalize="sentences"
          selectionColor={c.prussian}
          style={[styles.input, { color: c.ink, borderBottomColor: c.border }]}
        />

        <FactorPreview
          behaviorName={name}
          question={effectiveQuestion}
          factor={factorSuggestion}
          normalizing={normalizingFactor}
          useSuggestion={useSuggestedFactor}
          onToggleSuggestion={setUseSuggestedFactor}
        />

        <Label style={{ marginTop: 16 }}>Categoria</Label>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((item) => (
            <CategoryPill
              key={item.key}
              label={item.label}
              active={effectiveCategory === item.key}
              onPress={() => {
                setCategory(item.key)
                setCategoryTouched(true)
              }}
            />
          ))}
        </View>

        <View style={[styles.privacyRow, { borderTopColor: c.border }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Sans weight="med" size={15} color={c.ink}>
              Privacidade relacional
            </Sans>
            <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 2 }}>
              Use quando envolve outra pessoa. Atlas correlaciona só com a sua fisiologia.
            </Sans>
          </View>
          <Switch
            value={relationalPrivacy}
            onValueChange={setRelationalPrivacy}
            trackColor={{ false: c.border, true: c.prussian }}
            thumbColor={c.bg}
          />
        </View>

        <Pressable
          onPress={() => {
            void saveBehavior()
          }}
          disabled={!canCreate}
          style={({ pressed }) => [
            styles.createButton,
            {
              backgroundColor: canCreate ? c.ink : 'transparent',
              borderColor: canCreate ? c.ink : c.border,
              opacity: pressed ? 0.9 : canCreate ? 1 : 0.55,
            },
          ]}
        >
          <Sans weight="sb" size={14} color={canCreate ? c.bg : c.ink2} align="center">
            {activeBehaviors.length >= 12 ? 'Arquive um ativo antes de adicionar' : saving ? 'Salvando…' : 'Adicionar fator'}
          </Sans>
        </Pressable>
      </View>

      <SectionHeader label="Registrar ocorrência" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TextInput
          value={occurrenceText}
          onChangeText={setOccurrenceText}
          placeholder="Ex.: tereré depois das 16h"
          placeholderTextColor={c.ink3}
          autoCapitalize="sentences"
          autoCorrect={false}
          selectionColor={c.prussian}
          style={[styles.input, { color: c.ink, borderBottomColor: c.border }]}
        />
        <View style={styles.dateRow}>
          <DatePill label="Hoje" active={occurrenceDate === 'today'} onPress={() => setOccurrenceDate('today')} />
          <DatePill label="Ontem" active={occurrenceDate === 'yesterday'} onPress={() => setOccurrenceDate('yesterday')} />
        </View>
        <FactorPreview
          behaviorName={occurrenceText}
          question={selectedOccurrenceFactor?.questionText ?? 'Registro manual de ocorrência'}
          factor={occurrenceSuggestion}
          normalizing={normalizingOccurrence}
          useSuggestion={useSuggestedOccurrence}
          onToggleSuggestion={setUseSuggestedOccurrence}
        />
        <OccurrenceMatch behavior={findMatchingBehavior(allBehaviors, selectedOccurrenceFactor, occurrenceText)} />
        <OccurrenceDetails
          time={occurrenceTime}
          quantity={occurrenceQuantity}
          unit={occurrenceUnit}
          intensity={occurrenceIntensity}
          onTimeChange={setOccurrenceTime}
          onQuantityChange={setOccurrenceQuantity}
          onUnitChange={setOccurrenceUnit}
          onIntensityChange={setOccurrenceIntensity}
        />
        <Pressable
          onPress={() => {
            void registerOccurrence()
          }}
          disabled={!canRegisterOccurrence}
          style={({ pressed }) => [
            styles.createButton,
            {
              backgroundColor: canRegisterOccurrence ? c.ink : 'transparent',
              borderColor: canRegisterOccurrence ? c.ink : c.border,
              opacity: pressed ? 0.9 : canRegisterOccurrence ? 1 : 0.55,
            },
          ]}
        >
          <Sans weight="sb" size={14} color={canRegisterOccurrence ? c.bg : c.ink2} align="center">
            {savingOccurrence ? 'Registrando…' : 'Registrar ocorrência'}
          </Sans>
        </Pressable>
      </View>

      <SectionHeader label="Ativos no briefing" />
      <View style={[styles.listPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {activeBehaviors.length === 0 ? (
          <EmptyRow />
        ) : activeBehaviors.map((behavior, index) => (
          <BehaviorRow
            key={behavior.client_id}
            behavior={behavior}
            last={index === activeBehaviors.length - 1}
            logs={allLogs}
            analysisLoading={analysisLoadingFor === behavior.client_id}
            onAnalyze={() => void loadAnalysis(behavior)}
            onBaseline={() => void changeLifecycle(behavior, 'baseline')}
            onPause={() => void changeLifecycle(behavior, 'dormant')}
            onArchive={() => void archiveBehavior(behavior)}
          />
        ))}
      </View>

      {analysis ? <AnalysisPanel analysis={analysis} /> : null}

      {heldBehaviors.length > 0 ? (
        <>
          <SectionHeader label="Fora do briefing" />
          <View style={[styles.listPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
            {heldBehaviors.map((behavior, index) => (
              <HeldBehaviorRow
                key={behavior.client_id}
                behavior={behavior}
                last={index === heldBehaviors.length - 1}
                onReactivate={() => void changeLifecycle(behavior, 'active')}
                onAnalyze={() => void loadAnalysis(behavior)}
              />
            ))}
          </View>
        </>
      ) : null}

    </Screen>
  )
}

function FactorPreview({
  behaviorName,
  question,
  factor,
  normalizing,
  useSuggestion,
  onToggleSuggestion,
}: {
  behaviorName: string
  question: string
  factor: NormalizedBehaviorFactor | null
  normalizing: boolean
  useSuggestion: boolean
  onToggleSuggestion: (value: boolean) => void
}) {
  const c = usePalette()
  if (!behaviorName.trim()) return null

  return (
    <View style={[styles.factorPreview, { borderColor: c.border, backgroundColor: c.premium }]}>
      <Label>Estrutura</Label>
      {factor ? (
        <>
          <Sans weight="med" size={14} color={c.ink} style={{ marginTop: 8 }}>
            {factor.label}
          </Sans>
          <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 3 }}>
            {question}
          </Sans>
          <View style={styles.factorMeta}>
            <MetaPill label={factor.parentFactor.replace(/_/g, ' ')} />
            <MetaPill label={factor.factorCondition.replace(/_/g, ' ')} />
            <MetaPill label={factor.expectedLag.replace(/_/g, ' ')} />
          </View>
          <View style={styles.factorMeta}>
            {factor.targetOutcomes.slice(0, 4).map((outcome) => (
              <MetaPill key={outcome} label={outcomeLabel(outcome)} muted />
            ))}
          </View>
          <Pressable
            onPress={() => onToggleSuggestion(!useSuggestion)}
            style={({ pressed }) => [
              styles.suggestionToggle,
              { borderColor: c.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Mono size={10.5} letterSpacing={0.21} color={useSuggestion ? c.prussian : c.ink2}>
              {useSuggestion ? 'Usando estrutura sugerida' : 'Salvar como fator manual'}
            </Mono>
          </Pressable>
          {factor.guidance ? (
            <Sans size={11.5} lineHeight={16} color={c.ink2} style={{ marginTop: 8 }}>
              {factor.guidance}
            </Sans>
          ) : null}
        </>
      ) : (
        <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 8 }}>
          {normalizing ? 'Normalizando fator...' : 'Sem fator canônico ainda. Atlas vai salvar como fator manual; isso é útil para registro, mas fraco para correlação até ser normalizado.'}
        </Sans>
      )}
    </View>
  )
}

function MetaPill({ label, muted }: { label: string; muted?: boolean }) {
  const c = usePalette()
  return (
    <View style={[styles.metaPill, { borderColor: c.border, backgroundColor: muted ? 'transparent' : c.surface }]}>
      <Mono size={10.5} letterSpacing={0.21} color={c.ink2}>
        {label}
      </Mono>
    </View>
  )
}

function DatePill({
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
        styles.datePill,
        {
          backgroundColor: active ? c.prussian : 'transparent',
          borderColor: active ? c.prussian : c.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Mono size={11} letterSpacing={0.22} color={active ? c.bg : c.ink2}>
        {label}
      </Mono>
    </Pressable>
  )
}

function OccurrenceMatch({ behavior }: { behavior: AtlasBehavior | null }) {
  const c = usePalette()
  if (!behavior) return null

  return (
    <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 10 }}>
      Vai registrar em: {behavior.name}{behavior.show_in_morning_briefing ? '' : ' · fora do briefing'}
    </Sans>
  )
}

function OccurrenceDetails({
  time,
  quantity,
  unit,
  intensity,
  onTimeChange,
  onQuantityChange,
  onUnitChange,
  onIntensityChange,
}: {
  time: string
  quantity: string
  unit: string
  intensity: number | null
  onTimeChange: (value: string) => void
  onQuantityChange: (value: string) => void
  onUnitChange: (value: string) => void
  onIntensityChange: (value: number | null) => void
}) {
  const c = usePalette()

  return (
    <View style={styles.detailGrid}>
      <TextInput
        value={time}
        onChangeText={onTimeChange}
        placeholder="Hora"
        placeholderTextColor={c.ink3}
        keyboardType="numbers-and-punctuation"
        style={[styles.detailInput, { color: c.ink, borderColor: c.border }]}
      />
      <TextInput
        value={quantity}
        onChangeText={onQuantityChange}
        placeholder="Qtd."
        placeholderTextColor={c.ink3}
        keyboardType="decimal-pad"
        style={[styles.detailInput, { color: c.ink, borderColor: c.border }]}
      />
      <TextInput
        value={unit}
        onChangeText={onUnitChange}
        placeholder="Unid."
        placeholderTextColor={c.ink3}
        autoCapitalize="none"
        style={[styles.detailInput, { color: c.ink, borderColor: c.border }]}
      />
      <View style={styles.intensityRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            onPress={() => onIntensityChange(intensity === value ? null : value)}
            style={({ pressed }) => [
              styles.intensityPill,
              {
                borderColor: intensity === value ? c.prussian : c.border,
                backgroundColor: intensity === value ? c.prussian : 'transparent',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Mono size={10} color={intensity === value ? c.bg : c.ink2}>{value}</Mono>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function CategoryPill({
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
        styles.categoryPill,
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

function BehaviorRow({
  behavior,
  logs,
  last,
  analysisLoading,
  onAnalyze,
  onBaseline,
  onPause,
  onArchive,
}: {
  behavior: AtlasBehavior
  logs: ReturnType<typeof visibleBehaviorLogs>
  last?: boolean
  analysisLoading?: boolean
  onAnalyze: () => void
  onBaseline: () => void
  onPause: () => void
  onArchive: () => void
}) {
  const c = usePalette()
  const behaviorLogs = logs.filter((log) => log.behavior_client_id === behavior.client_id && !log.reverted_at)
  const latestLog = behaviorLogs[0]
  const localYesCount = behaviorLogs.filter((log) => log.value === 'yes' && log.metadata?.local === true).length
  const yesCount = behavior.total_yes_count + localYesCount
  const subtitle = behavior.parent_factor
    ? `${formatFactorLabel(behavior)} · ${formatOutcomes(behavior.target_outcomes ?? [])}`
    : behavior.question_text

  return (
    <View style={[styles.behaviorRow, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={16} color={c.ink}>
          {behavior.name}{behavior.relational_privacy ? ' · privado' : ''}
        </Sans>
        <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 2 }}>
          {subtitle}
        </Sans>
        {behavior.parent_factor ? (
          <Sans size={11.5} lineHeight={16} color={c.ink3} style={{ marginTop: 2 }}>
            {behavior.question_text}
          </Sans>
        ) : null}
      </View>
      <View style={styles.rowMeta}>
        <Mono size={12} letterSpacing={0.24} color={c.ink}>
          {yesCount} sim
        </Mono>
        <Mono size={10.5} letterSpacing={0.21} color={c.ink2}>
          {latestLog ? latestLog.log_date.slice(5).replace('-', '/') : 'sem log'}
        </Mono>
        <View style={styles.rowActions}>
          <RowAction label={analysisLoading ? '...' : 'Análise'} onPress={onAnalyze} />
          <RowAction label="Base" onPress={onBaseline} />
          <RowAction label="Pausar" onPress={onPause} />
          <RowAction label="Arquivar" onPress={onArchive} muted />
        </View>
      </View>
    </View>
  )
}

function HeldBehaviorRow({
  behavior,
  last,
  onReactivate,
  onAnalyze,
}: {
  behavior: AtlasBehavior
  last?: boolean
  onReactivate: () => void
  onAnalyze: () => void
}) {
  const c = usePalette()

  return (
    <View style={[styles.behaviorRow, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={15} color={c.ink}>
          {behavior.name}
        </Sans>
        <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 2 }}>
          {lifecycleLabel(behavior)} · não aparece no briefing
        </Sans>
      </View>
      <View style={styles.rowActionsVertical}>
        <RowAction label="Voltar" onPress={onReactivate} />
        <RowAction label="Análise" onPress={onAnalyze} muted />
      </View>
    </View>
  )
}

function RowAction({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowAction,
        { borderColor: c.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Mono size={9.5} letterSpacing={0.1} color={muted ? c.ink3 : c.prussian}>
        {label}
      </Mono>
    </Pressable>
  )
}

function EmptyRow() {
  const c = usePalette()
  return (
    <View style={styles.emptyRow}>
      <Sans size={14} lineHeight={20} color={c.ink2}>
        Nenhum fator ativo ainda. Adicione algo factual, pequeno e rastreável.
      </Sans>
    </View>
  )
}

function AnalysisPanel({ analysis }: { analysis: BitaculaAnalysisResponse }) {
  const c = usePalette()
  const rows = analysis.analysis.filter((row) => row.yes_count > 0 || row.no_count > 0).slice(0, 4)

  return (
    <>
      <SectionHeader label="Análise exploratória" />
      <View style={[styles.analysisPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Sans weight="med" size={15} color={c.ink}>
          {analysis.behavior.name}
        </Sans>
        <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 3 }}>
          Janela de {analysis.window_days} dias · lag {analysis.lag_days}d · hipótese, não causalidade
        </Sans>
        {rows.length === 0 ? (
          <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 12 }}>
            Ainda não há contraste suficiente entre dias com e sem esse fator.
          </Sans>
        ) : rows.map((row) => (
          <View key={row.outcome} style={[styles.analysisRow, { borderTopColor: c.border }]}>
            <Sans weight="med" size={13} color={c.ink}>
              {outcomeLabel(row.outcome)}
            </Sans>
            <Sans size={12} lineHeight={17} color={c.ink2}>
              {row.yes_count} sim / {row.no_count} não · {effectText(row)}
            </Sans>
          </View>
        ))}
        {analysis.confounders.length > 0 ? (
          <Sans size={11.5} lineHeight={16} color={c.ink3} style={{ marginTop: 10 }}>
            Confundidores: {analysis.confounders.slice(0, 3).map((item) => item.name).join(', ')}
          </Sans>
        ) : null}
      </View>
    </>
  )
}

function formatFactorLabel(behavior: AtlasBehavior): string {
  const parent = behavior.parent_factor?.replace(/_/g, ' ') ?? 'fator'
  const condition = behavior.factor_condition?.replace(/_/g, ' ')

  return condition ? `${parent} / ${condition}` : parent
}

function formatOutcomes(outcomes: string[]): string {
  if (!outcomes.length) return 'sem desfecho-alvo'

  return outcomes.slice(0, 3).map(outcomeLabel).join(', ')
}

function outcomeLabel(outcome: string): string {
  return ({
    sleep: 'sono',
    hrv: 'HRV',
    resting_heart_rate: 'RHR',
    anxiety: 'ansiedade',
    focus: 'foco',
    mood: 'humor',
    energy: 'energia',
    application_ratio: 'aplicação',
    reflux: 'refluxo',
    appetite: 'apetite',
  } as Record<string, string>)[outcome] ?? outcome
}

function findMatchingBehavior(
  behaviors: AtlasBehavior[],
  factor: NormalizedBehaviorFactor | null,
  text: string,
): AtlasBehavior | null {
  const candidates = behaviors.filter((behavior) => !behavior.deleted_at)

  if (factor) {
    return candidates.find((behavior) => (
      behavior.derived_from?.canonical_factor === factor.id
        || (behavior.parent_factor === factor.parentFactor && behavior.factor_condition === factor.factorCondition)
    )) ?? null
  }

  const normalizedText = normalizePlainText(text)
  if (!normalizedText) return null

  return candidates.find((behavior) => normalizePlainText(behavior.name) === normalizedText) ?? null
}

function normalizationMetadata(factor: NormalizedBehaviorFactor | null): Record<string, unknown> {
  if (!factor) return { source: 'local_catalog_v2', status: 'unmatched' }

  return {
    source: factor.normalizer ?? 'local_catalog_v2',
    factor_id: factor.id,
    confidence: factor.confidence,
  }
}

function dateForOccurrence(selection: 'today' | 'yesterday'): string {
  const date = new Date()
  if (selection === 'yesterday') date.setDate(date.getDate() - 1)

  return localDateKey(date)
}

function occurredAtFor(date: string, timeText: string): string | null {
  const value = timeText.trim()
  if (!value) return null

  const match = value.match(/^(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return null

  const hour = Math.min(23, Number(match[1]))
  const minute = Math.min(59, Number(match[2] ?? '0'))
  const occurredAt = new Date(`${date}T00:00:00`)
  occurredAt.setHours(hour, minute, 0, 0)

  return occurredAt.toISOString()
}

function parseOptionalNumber(value: string): number | null {
  const parsed = Number(value.trim().replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : null
}

function isPromptableStatus(status: AtlasBehavior['lifecycle_status']): boolean {
  return status === 'active' || status === 'experiment'
}

function lifecycleLabel(behavior: AtlasBehavior): string {
  if (behavior.archived_at) return 'arquivado'

  return ({
    active: 'ativo',
    experiment: 'experimento',
    baseline: 'baseline',
    dormant: 'dormente',
    paused: 'pausado',
    manual_only: 'manual',
  } as Record<string, string>)[behavior.lifecycle_status] ?? behavior.lifecycle_status
}

function effectText(row: BitaculaAnalysisResponse['analysis'][number]): string {
  if (row.difference === null) return 'sem dados suficientes'

  const direction = row.difference > 0 ? 'maior' : row.difference < 0 ? 'menor' : 'igual'
  return `${outcomeLabel(row.outcome)} ${direction} nos dias com fator`
}

function normalizePlainText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function BackArrow({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 18, transform: [{ rotate: '45deg' }] }}>
      <View style={{ position: 'absolute', left: 2, top: 2, width: 13, height: 3, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ position: 'absolute', left: 2, top: 2, width: 3, height: 13, backgroundColor: color, borderRadius: 2 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { marginBottom: 8 },
  panel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  input: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  datePill: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  factorPreview: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  factorMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  suggestionToggle: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  metaPill: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  categoryPill: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  detailInput: {
    minWidth: 74,
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  intensityPill: {
    width: 28,
    height: 32,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
    paddingTop: 14,
  },
  createButton: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  listPanel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  behaviorRow: {
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 5,
    maxWidth: 136,
  },
  rowActionsVertical: {
    alignItems: 'flex-end',
    gap: 6,
  },
  rowAction: {
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  analysisPanel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  analysisRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingTop: 10,
  },
  emptyRow: {
    padding: 16,
  },
})
