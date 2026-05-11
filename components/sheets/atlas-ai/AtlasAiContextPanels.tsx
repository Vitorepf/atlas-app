import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Mono, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import {
  bootstrapStatusLabel,
  type OperationalBootstrapData,
  type OperationalBootstrapStep,
} from '../../../lib/atlasOperationalBootstrap'
import type { RoutingMode } from '../../console/StatusRouting'

export interface AtlasAiContextIntroData {
  title: string
  summary: string | null
  body: string | null
  focus: string
  permission: string
  execution: string
}

export interface AtlasAiModeNoticeData {
  title: string
  summary: string
  tone: RoutingMode
}

export function AtlasAiModeNotice({ notice }: { notice: AtlasAiModeNoticeData }) {
  const { c } = useTheme()

  return (
    <View style={[styles.modeNotice, { borderColor: modeColor(notice.tone, c), backgroundColor: c.surface }]}>
      <View style={[styles.modeNoticeDot, { backgroundColor: modeColor(notice.tone, c) }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Mono size={9.5} lineHeight={13} color={c.ink2} letterSpacing={0.35}>
          MODO DA CONVERSA
        </Mono>
        <Sans weight="sb" size={14} lineHeight={19} color={c.ink} numberOfLines={2} style={{ marginTop: 3 }}>
          {notice.title}
        </Sans>
        <Frau italic size={12} lineHeight={17} color={c.ink2} numberOfLines={2} style={{ marginTop: 2 }}>
          {notice.summary}
        </Frau>
      </View>
    </View>
  )
}

export function OperationalBootstrapPanel({
  status,
  retrying,
  onRefresh,
  onRetry,
}: {
  status: OperationalBootstrapData
  retrying: boolean
  onRefresh: () => void
  onRetry: () => void
}) {
  const { c } = useTheme()
  const active = status.status === 'queued' || status.status === 'processing' || status.status === 'retrying'
  const failed = status.status === 'failed' || status.status === 'cancelled' || status.status === 'skipped'
  const primaryAction = failed ? onRetry : onRefresh
  const primaryLabel = failed
    ? (retrying ? 'Tentando...' : 'Tentar novamente')
    : 'Atualizar'

  return (
    <View style={[
      styles.bootstrapPanel,
      {
        borderColor: failed ? c.recRed : active ? c.bronze : c.border,
        backgroundColor: c.surface,
      },
    ]}>
      <View style={styles.bootstrapHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Mono size={9.5} lineHeight={13} color={failed ? c.recRed : c.bronze} letterSpacing={0.35}>
            BOOTSTRAP OPERACIONAL
          </Mono>
          <Sans weight="sb" size={15} lineHeight={20} color={c.ink} numberOfLines={2} style={{ marginTop: 4 }}>
            {status.title}
          </Sans>
        </View>
        <View style={[
          styles.bootstrapStatusPill,
          { borderColor: failed ? c.recRed : active ? c.bronze : c.border },
        ]}>
          <Mono size={9.5} lineHeight={12} color={failed ? c.recRed : c.prussian} letterSpacing={0.25}>
            {bootstrapStatusLabel(status.status)}
          </Mono>
        </View>
      </View>

      <Sans size={12.5} lineHeight={18} color={c.ink2}>
        {status.summary}
      </Sans>

      <View style={styles.bootstrapSteps}>
        {status.steps.map((step) => (
          <View key={step.key} style={styles.bootstrapStep}>
            <View style={[
              styles.bootstrapStepDot,
              { backgroundColor: bootstrapStepColor(step.state, c) },
            ]} />
            <Sans weight={step.state === 'active' ? 'sb' : 'med'} size={11.5} lineHeight={15} color={step.state === 'pending' ? c.ink3 : c.ink2} numberOfLines={1}>
              {step.label}
            </Sans>
          </View>
        ))}
      </View>

      {status.responsePreview ? (
        <View style={[styles.bootstrapPreview, { borderColor: c.border }]}>
          <Sans size={12} lineHeight={17} color={c.ink2} numberOfLines={4}>
            {status.responsePreview}
          </Sans>
        </View>
      ) : null}

      {(active || failed) ? (
        <Pressable
          onPress={primaryAction}
          disabled={retrying}
          style={({ pressed }) => [
            styles.bootstrapRefresh,
            { borderColor: c.border, opacity: pressed || retrying ? 0.68 : 1 },
          ]}
        >
          <Sans weight="sb" size={12.5} lineHeight={17} color={c.prussian}>
            {primaryLabel}
          </Sans>
        </Pressable>
      ) : null}
    </View>
  )
}

export function AtlasAiContextIntro({
  intro,
  onPromoteToDevelopment,
}: {
  intro: AtlasAiContextIntroData
  onPromoteToDevelopment: () => void
}) {
  const { c } = useTheme()

  return (
    <View style={[styles.contextIntro, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.contextIntroHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: 0.56 }}>
            contexto carregado
          </Frau>
          <Sans weight="med" size={15} lineHeight={20} color={c.ink} numberOfLines={2} style={{ marginTop: 4 }}>
            {intro.title}
          </Sans>
        </View>
        <View style={[styles.contextIntroBadge, { borderColor: c.border }]}>
          <Mono size={10.5} lineHeight={14} color={c.prussian} letterSpacing={0.2}>
            auditável
          </Mono>
        </View>
      </View>

      {intro.summary ? (
        <Sans size={12.5} lineHeight={18} color={c.ink2}>
          {intro.summary}
        </Sans>
      ) : null}

      {intro.body ? (
        <Sans size={12.5} lineHeight={18} color={c.ink2} numberOfLines={5}>
          {intro.body}
        </Sans>
      ) : null}

      <View style={styles.contextIntroGrid}>
        <ContextIntroMetric label="Foco" value={intro.focus} />
        <ContextIntroMetric label="Permissão" value={intro.permission} />
        <ContextIntroMetric label="Execução" value={intro.execution} />
      </View>

      <Pressable
        onPress={onPromoteToDevelopment}
        style={({ pressed }) => [
          styles.contextIntroAction,
          { borderColor: c.prussian, opacity: pressed ? 0.68 : 1 },
        ]}
      >
        <Sans weight="sb" size={12.5} lineHeight={17} color={c.prussian} align="center">
          Desenvolver com este contexto
        </Sans>
      </Pressable>
    </View>
  )
}

function ContextIntroMetric({ label, value }: { label: string; value: string }) {
  const { c } = useTheme()

  return (
    <View style={styles.contextIntroMetric}>
      <Mono size={9.5} lineHeight={12} color={c.ink2} letterSpacing={0.35}>
        {label.toUpperCase()}
      </Mono>
      <Sans weight="med" size={12} lineHeight={16} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

function modeColor(mode: RoutingMode, c: ReturnType<typeof useTheme>['c']): string {
  switch (mode) {
    case 'programming':
      return c.prussian
    case 'operational':
      return c.bronze
    default:
      return c.ink3
  }
}

function bootstrapStepColor(
  state: OperationalBootstrapStep['state'],
  c: ReturnType<typeof useTheme>['c'],
): string {
  if (state === 'done') return c.moss
  if (state === 'active') return c.bronze
  if (state === 'failed') return c.recRed
  return c.ink3
}

const styles = StyleSheet.create({
  modeNotice: {
    minHeight: 74,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  modeNoticeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  bootstrapPanel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 11,
    marginBottom: 14,
  },
  bootstrapHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  bootstrapStatusPill: {
    minHeight: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootstrapPreview: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
  },
  bootstrapSteps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bootstrapStep: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bootstrapStepDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  bootstrapRefresh: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  contextIntro: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
    marginBottom: 18,
  },
  contextIntroHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  contextIntroBadge: {
    minHeight: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextIntroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contextIntroMetric: {
    minWidth: '30%',
    flex: 1,
    gap: 4,
  },
  contextIntroAction: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
})
