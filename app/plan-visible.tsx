/**
 * Plan-Visible Mobile screen · Atlas Dev Patamar A5 (AP-703 paridade Mobile).
 *
 * Lê o read model HTTP shipado pela AP-700 em atlas-server:
 *   GET /atlas-code/programming/plan-visible
 *
 * Read-only. Operador inspeciona o plano canônico `atlas.dev.plan_visible.v1`
 * antes de aprovar provider execution. A aprovação fica em outra tela
 * (gate surface · fora de escopo aqui).
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'

import { Screen } from '../components/Screen'
import { Masthead } from '../components/editorial'
import { Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { getApiBase, getAtlasAuthHeaders } from '../lib/api/client'

interface PlanVisible {
  schema_version: 'atlas.dev.plan_visible.v1'
  target_files: string[]
  tests_to_run: string[]
  risk_band: 'low' | 'medium' | 'high'
  proposed_diff_summary: string
  run_id: string
  task_contract_hash: string
  approval_status: 'pending' | 'approved' | 'rejected'
}

interface PlanVisibleEntry {
  work_item_id: string
  work_item_code?: string | null
  plan_hash: string
  plan_visible: PlanVisible
}

interface PlanVisibleIndexResponse {
  schema: 'atlas.dev.plan_visible.index.v1'
  count: number
  items: PlanVisibleEntry[]
}

async function fetchIndex(): Promise<PlanVisibleIndexResponse> {
  const base = getApiBase()
  const response = await fetch(`${base}/atlas-code/programming/plan-visible`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getAtlasAuthHeaders(),
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`plan-visible http ${response.status}: ${body.slice(0, 200)}`)
  }

  return (await response.json()) as PlanVisibleIndexResponse
}

export default function PlanVisibleScreen() {
  const palette = usePalette()
  const [items, setItems] = useState<PlanVisibleEntry[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchIndex()
      setItems(next.items ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const handle = setInterval(() => {
      void load()
    }, 5000)

    return () => clearInterval(handle)
  }, [load])

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={palette.ink} />
      }
    >
      <Masthead title="Plan · Visible" folio="atlas dev · A2" />

      {error ? (
        <View style={styles.errorBox}>
          <Sans size={13} color={palette.bronze}>
            {error}
          </Sans>
        </View>
      ) : null}

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Sans size={13} color={palette.ink3}>
            No work item with persisted plan yet.
          </Sans>
        </View>
      ) : (
        <ScrollView>
          {items.map((entry) => (
            <PlanCard key={entry.work_item_id} entry={entry} palette={palette} />
          ))}
        </ScrollView>
      )}
    </Screen>
  )
}

interface PlanCardProps {
  entry: PlanVisibleEntry
  palette: ReturnType<typeof usePalette>
}

function PlanCard({ entry, palette }: PlanCardProps) {
  const plan = entry.plan_visible

  return (
    <View style={[styles.card, { borderColor: palette.borderSoft }]}>
      <View style={styles.cardHeader}>
        <Mono size={11} color={palette.ink}>
          {entry.work_item_code ?? entry.work_item_id.slice(0, 8)}
        </Mono>
        <Label size={9} color={palette.ink3}>
          {plan.risk_band.toUpperCase()} · {plan.approval_status}
        </Label>
      </View>

      <Sans size={13} color={palette.ink} style={styles.summary}>
        {plan.proposed_diff_summary}
      </Sans>

      <Section title="Target files" palette={palette}>
        {plan.target_files.length === 0 ? (
          <Sans size={11} color={palette.ink3}>
            none
          </Sans>
        ) : (
          plan.target_files.map((f) => (
            <Mono key={f} size={11} color={palette.ink}>
              {f}
            </Mono>
          ))
        )}
      </Section>

      <Section title="Tests to run" palette={palette}>
        {plan.tests_to_run.length === 0 ? (
          <Sans size={11} color={palette.ink3}>
            none
          </Sans>
        ) : (
          plan.tests_to_run.map((t) => (
            <Mono key={t} size={11} color={palette.ink}>
              {t}
            </Mono>
          ))
        )}
      </Section>

      <View style={styles.footer}>
        <Mono size={10} color={palette.ink3}>
          run {plan.run_id}
        </Mono>
        <Mono size={10} color={palette.ink3}>
          hash {entry.plan_hash.slice(0, 12)}
        </Mono>
      </View>
    </View>
  )
}

interface SectionProps {
  title: string
  palette: ReturnType<typeof usePalette>
  children: React.ReactNode
}

function Section({ title, palette, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Label size={9} color={palette.ink3} style={styles.sectionTitle}>
        {title.toUpperCase()}
      </Label>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  errorBox: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  empty: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  summary: {
    marginBottom: 12,
    lineHeight: 18,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 4,
    letterSpacing: 1,
  },
  sectionBody: {
    paddingLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
})
