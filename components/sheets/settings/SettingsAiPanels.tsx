import { ScrollView, StyleSheet, View } from 'react-native'
import { Mono, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import {
  type AiProvidersStatusResponse,
  type AtlasAiJob,
} from '../../../lib/api/client'
import { MiniButton, ModelMetric, Row, Section } from './SettingsPrimitives'
import { RuntimeButton } from './SettingsPolicyPanels'
import {
  activeAiJobCanOpen,
  activeAiJobPrompt,
  activeAiJobStatusLabel,
  activeAiJobSubtitle,
  activeAiJobTitle,
  activeAiSessionsDescription,
  aiRuntimeModelGroups,
  formatCompactNumber,
  providerLabel,
} from './settingsStatus'

export function AiSessionsDashboard({
  jobs,
  status,
  jobsLoading,
  busyJobId,
  onRefresh,
  onOpenJob,
  onCancelJob,
}: {
  jobs: AtlasAiJob[]
  status: AiProvidersStatusResponse | null
  jobsLoading: boolean
  busyJobId: string | null
  onRefresh: () => void
  onOpenJob: (job: AtlasAiJob) => void
  onCancelJob: (job: AtlasAiJob) => void
}) {
  const { c } = useTheme()
  const runningThreadCount = new Set(
    jobs.map((job) => job.trace?.thread_id).filter((id): id is string => typeof id === 'string'),
  ).size

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      <Section label="Controle">
        <Row first name="Atualização" desc="Somente execuções que podem consumir token">
          <MiniButton label={jobsLoading ? 'Atualizando...' : 'Atualizar'} disabled={jobsLoading} onPress={onRefresh} />
        </Row>
        <Row name="Consumindo agora" desc={activeAiSessionsDescription(jobs, jobsLoading)}>
          <Mono size={12} letterSpacing={0.48} color={jobs.length > 0 ? c.bronze : c.ink2}>
            {jobsLoading ? '...' : String(jobs.length)}
          </Mono>
        </Row>
        <Row name="Conversas em execução" desc="Conversas só aparecem aqui se tiverem job em fila, rodando ou aguardando escolha">
          <Mono size={12} letterSpacing={0.48} color={jobs.length > 0 ? c.bronze : c.ink2}>
            {jobsLoading ? '...' : String(runningThreadCount)}
          </Mono>
        </Row>
      </Section>

      <Section label="Modelos consumindo">
        <AiRuntimeModelSummary jobs={jobs} status={status} loading={jobsLoading} />
      </Section>

      <Section label="Execuções consumindo">
        <ActiveAiSessionsList
          jobs={jobs}
          status={status}
          loading={jobsLoading}
          busyJobId={busyJobId}
          onOpen={onOpenJob}
          onCancel={onCancelJob}
        />
      </Section>
    </ScrollView>
  )
}

export function AiRuntimeModelSummary({
  jobs,
  status,
  loading,
}: {
  jobs: AtlasAiJob[]
  status: AiProvidersStatusResponse | null
  loading: boolean
}) {
  const { c } = useTheme()
  const groups = aiRuntimeModelGroups(jobs, status)

  if (groups.length === 0) {
    return (
      <View style={styles.activeJobEmpty}>
        <Sans size={13} lineHeight={18} color={c.ink2}>
          {loading ? 'Montando visão por modelo...' : 'Nenhum modelo consumindo agora'}
        </Sans>
      </View>
    )
  }

  return (
    <View style={styles.activeJobList}>
      {groups.map((group, index) => (
        <View
          key={group.key}
          style={[
            styles.modelGroupItem,
            index > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <View style={styles.activeJobHeader}>
            <View style={styles.activeJobTitleBlock}>
              <Sans weight="med" size={15} lineHeight={19} color={c.ink}>
                {providerLabel(group.provider)} · {group.modelLabel}
              </Sans>
              <Sans size={12} lineHeight={16} color={c.ink2}>
                {group.origins.join(' · ')}
              </Sans>
            </View>
            <Mono size={10.5} letterSpacing={0.36} color={group.activeJobs > 0 ? c.bronze : c.ink2}>
              CONSUMINDO
            </Mono>
          </View>
          <View style={styles.modelMetricRow}>
            <ModelMetric label="execuções" value={String(group.activeJobs)} />
            <ModelMetric label="origens" value={String(group.origins.length)} />
            <ModelMetric label="tokens ativos" value={`~${formatCompactNumber(group.tokens)}`} />
          </View>
        </View>
      ))}
    </View>
  )
}

export function ActiveAiSessionsList({
  jobs,
  status,
  loading,
  busyJobId,
  onOpen,
  onCancel,
}: {
  jobs: AtlasAiJob[]
  status: AiProvidersStatusResponse | null
  loading: boolean
  busyJobId: string | null
  onOpen: (job: AtlasAiJob) => void
  onCancel: (job: AtlasAiJob) => void
}) {
  const { c } = useTheme()

  if (jobs.length === 0) {
    return (
      <View style={styles.activeJobEmpty}>
        <Sans size={13} lineHeight={18} color={c.ink2}>
          {loading ? 'Verificando execuções ativas...' : 'Nada rodando agora'}
        </Sans>
      </View>
    )
  }

  return (
    <View style={styles.activeJobList}>
      {jobs.map((job, index) => {
        const title = activeAiJobTitle(job, status)
        const subtitle = activeAiJobSubtitle(job)
        const prompt = activeAiJobPrompt(job)
        const canOpen = activeAiJobCanOpen(job)
        const busy = busyJobId === job.id
        const statusColor = job.status === 'processing'
          ? c.bronze
          : job.status === 'queued'
            ? c.prussian
            : c.ink2

        return (
          <View
            key={job.id}
            style={[
              styles.activeJobItem,
              index > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <View style={styles.activeJobHeader}>
              <View style={styles.activeJobTitleBlock}>
                <Sans weight="med" size={15} lineHeight={19} color={c.ink}>
                  {title}
                </Sans>
                <Sans size={12} lineHeight={16} color={c.ink2}>
                  {subtitle}
                </Sans>
              </View>
              <Mono size={10.5} letterSpacing={0.36} color={statusColor}>
                {activeAiJobStatusLabel(job.status)}
              </Mono>
            </View>
            {prompt ? (
              <Sans size={12} lineHeight={17} color={c.ink2}>
                {prompt}
              </Sans>
            ) : null}
            <View style={styles.activeJobActions}>
              <RuntimeButton label={canOpen ? 'Entrar' : 'Sem conversa'} disabled={!canOpen || busy} onPress={() => onOpen(job)} />
              <RuntimeButton label={busy ? 'Cancelando...' : 'Cancelar'} disabled={busy} danger onPress={() => onCancel(job)} />
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  activeJobEmpty: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
  },
  activeJobList: {
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  activeJobItem: {
    paddingVertical: 12,
    gap: 8,
  },
  activeJobHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  activeJobTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  activeJobActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modelGroupItem: {
    paddingVertical: 12,
    gap: 10,
  },
  modelMetricRow: {
    flexDirection: 'row',
    gap: 10,
  },
})
