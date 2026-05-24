import { Pressable, View } from 'react-native'
import { Frau, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import {
  operationalActiveLabel,
  operationalCriticalLabel,
} from '../../lib/inboxOperationalModels'
import { styles } from './inboxScreenStyles'

function MobileGatewayBanner({ onPress }: { onPress: () => void }) {
  const c = usePalette()
  return (
    <View
      style={[
        styles.opEmptyCanon,
        { borderTopColor: 'rgba(233,238,242,0.05)' },
      ]}
    >
      <Mono
        size={10}
        lineHeight={14}
        letterSpacing={1.6}
        color={c.ink3}
        style={[styles.uppercase, styles.opEmptyEyebrow]}
      >
        Mobile Gateway
      </Mono>
      <Frau
        italic
        size={19}
        lineHeight={26}
        letterSpacing={-0.3}
        color={c.ink}
        style={styles.opEmptyState}
      >
        Desconectado.
      </Frau>
      <Frau
        italic
        size={14}
        lineHeight={22}
        color={c.ink2}
        style={styles.opEmptyProse}
      >
        Pareie este app pra receber push e mensagens operacionais do Atlas server.
      </Frau>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Parear app ao Atlas server"
        style={({ pressed }) => [
          styles.opEmptyAction,
          { borderBottomColor: c.bronze, opacity: pressed ? 0.55 : 1 },
        ]}
      >
        <Mono
          size={11}
          lineHeight={14}
          letterSpacing={1.6}
          color={c.bronze}
          weight="med"
        >
          PAREAR
        </Mono>
      </Pressable>
    </View>
  )
}

export function OperationalStatusPanel({
  total,
  critical,
  mobilePaired,
  error,
  onPair,
  onRetry,
}: {
  total: number
  critical: number
  mobilePaired: boolean | null
  error: string | null
  onPair: () => void
  onRetry: () => void
}) {
  const c = usePalette()

  if (mobilePaired === false) {
    return <MobileGatewayBanner onPress={onPair} />
  }

  if (error) {
    return <OperationalErrorCard message={error} onRetry={onRetry} />
  }

  const checking = mobilePaired === null
  const title = checking
    ? 'Checando operacional'
    : critical > 0
      ? 'Operacional requer atenção'
      : total > 0
        ? 'Operacional com itens ativos'
        : 'Operacional limpo'
  const body = checking
    ? 'Sincronizando gateway e carregando aprovações, recomendações e alertas.'
    : critical > 0
      ? `${operationalCriticalLabel(critical).toLowerCase()} precisam de revisão antes de misturar com as capturas.`
      : total > 0
        ? `${operationalActiveLabel(total).toLowerCase()} separados da Inbox de capturas.`
        : 'Nenhuma recomendação, aprovação ou alerta ativo agora.'

  return (
    <View style={[
      styles.operationalSummary,
      {
        borderColor: critical > 0 ? c.recRed : c.border,
        backgroundColor: c.surface,
      },
    ]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={13} lineHeight={17} color={c.ink}>
          {title}
        </Sans>
        <Sans size={12} lineHeight={16} color={c.ink2} style={{ marginTop: 3 }}>
          {body}
        </Sans>
      </View>
      <View style={[
        styles.operationalSummaryBadge,
        {
          borderColor: critical > 0 ? c.recRed : c.border,
          backgroundColor: critical > 0 ? c.bg : c.premium,
        },
      ]}>
        <Mono size={11} lineHeight={15} color={critical > 0 ? c.recRed : c.prussian}>
          {checking ? '...' : critical > 0 ? String(critical) : 'OK'}
        </Mono>
      </View>
    </View>
  )
}

function OperationalErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  const c = usePalette()
  return (
    <View style={[styles.operationalErrorCard, { borderColor: c.recRed, backgroundColor: c.surface }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={13} lineHeight={17} color={c.ink}>
          Inbox operacional indisponível
        </Sans>
        <Sans size={12} lineHeight={16} color={c.ink2} style={{ marginTop: 3 }} numberOfLines={3}>
          {message}
        </Sans>
      </View>
      <Pressable
        onPress={onRetry}
        hitSlop={8}
        style={({ pressed }) => [styles.operationalRetryButton, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}
      >
        <Sans weight="sb" size={12} lineHeight={16} color={c.prussian}>
          Tentar
        </Sans>
      </Pressable>
    </View>
  )
}

export function OperationalEmptyState({ title, body }: { title: string; body: string }) {
  const c = usePalette()

  return (
    <View
      style={[
        styles.opEmptyCanon,
        { borderTopColor: 'rgba(233,238,242,0.05)' },
      ]}
    >
      <Mono
        size={10}
        lineHeight={14}
        letterSpacing={1.6}
        color={c.ink3}
        style={[styles.uppercase, styles.opEmptyEyebrow]}
      >
        Operacional
      </Mono>
      <Frau
        italic
        size={19}
        lineHeight={26}
        letterSpacing={-0.3}
        color={c.ink}
        style={styles.opEmptyState}
      >
        {title.endsWith('.') ? title : `${title}.`}
      </Frau>
      <Frau
        italic
        size={14}
        lineHeight={22}
        color={c.ink2}
        style={styles.opEmptyProseClean}
      >
        {body}
      </Frau>
    </View>
  )
}
