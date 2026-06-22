import { Alert, Pressable, RefreshControl, View } from 'react-native'
import { Screen } from '../components/Screen'
import { Frau, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import {
  humanDuration,
  useAgentHistory,
  useFleetStatus,
  useTurnOffAgent,
  useTurnOffAll,
  type FleetAgent,
} from '../lib/agents'

// FLEET — every autonomous Atlas agent the operator can see + turn off. The hard rule made visible: nothing
// spends a provider account silently, and one tap kills any of it. No turn-ON here (deliberate; that stays a
// CLI/operator act) — this screen can only ever reduce spend.
export default function AgentsScreen() {
  const c = usePalette()
  const fleet = useFleetStatus()
  const history = useAgentHistory()
  const turnOff = useTurnOffAgent()
  const turnOffAll = useTurnOffAll()

  const snap = fleet.data
  const active = (snap?.agents ?? []).filter((a) => a.alive)
  const idle = (snap?.agents ?? []).filter((a) => !a.alive)
  const accounts = (snap?.spending_accounts ?? []).join(' · ')

  const confirmOff = (a: FleetAgent) => {
    Alert.alert('Desligar agente?', `${a.label} — gasta ${a.account}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'DESLIGAR', style: 'destructive', onPress: () => turnOff.mutate(a.key) },
    ])
  }

  const confirmOffAll = () => {
    Alert.alert('Desligar TUDO?', 'Para toda a frota e trava os master switches. Nada roda nem volta sozinho.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'DESLIGAR TUDO', style: 'destructive', onPress: () => turnOffAll.mutate() },
    ])
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={fleet.isFetching} onRefresh={() => void fleet.refetch()} tintColor={c.ink2} />
      }
    >
      <View style={{ paddingBottom: 18 }}>
        <Sans weight="bd" size={22} color={c.ink}>
          Frota
        </Sans>
        <Frau italic size={14} color={c.ink2}>
          Todo agente autônomo que gasta suas contas — e como desligar.
        </Frau>
      </View>

      {/* Summary + panic */}
      <View
        style={{
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: active.length > 0 ? c.recRed : c.border,
          backgroundColor: c.surface,
          marginBottom: 18,
        }}
      >
        {active.length > 0 ? (
          <Sans weight="sb" size={15} color={c.recRed}>
            🔴 {active.length} {active.length === 1 ? 'agente ativo' : 'agentes ativos'} gastando {accounts || 'provider'}
          </Sans>
        ) : (
          <Sans weight="sb" size={15} color={c.moss}>
            ✓ Nada rodando. Nenhuma conta sendo gasta.
          </Sans>
        )}
        <Sans size={12} color={c.ink3} style={{ marginTop: 4 }}>
          Fleet master: {snap?.fleet_master ?? '—'}
        </Sans>
        {(active.length > 0 || snap?.fleet_master === 'on') && (
          <Pressable
            onPress={confirmOffAll}
            style={({ pressed }) => ({
              marginTop: 12,
              paddingVertical: 12,
              borderRadius: 11,
              alignItems: 'center',
              backgroundColor: c.recRed,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Sans weight="bd" size={14} color={c.bg}>
              DESLIGAR TUDO
            </Sans>
          </Pressable>
        )}
      </View>

      {fleet.isError && (
        <Sans size={13} color={c.recRedMuted} style={{ marginBottom: 14 }}>
          Não consegui ler a frota do servidor. Puxe para atualizar.
        </Sans>
      )}

      {active.length > 0 && (
        <Section title="Ativos agora">
          {active.map((a) => (
            <AgentCard key={a.key} a={a} onOff={() => confirmOff(a)} c={c} />
          ))}
        </Section>
      )}

      <Section title="Frota">
        {idle.map((a) => (
          <AgentCard key={a.key} a={a} onOff={a.desired ? () => confirmOff(a) : undefined} c={c} />
        ))}
      </Section>

      <Section title="Histórico">
        {(history.data?.events ?? []).slice(0, 40).map((e, i) => (
          <View key={`${e.agent_key}-${e.at}-${i}`} style={{ flexDirection: 'row', gap: 8, paddingVertical: 5 }}>
            <Sans size={11} color={c.ink3} style={{ width: 122 }} numberOfLines={1}>
              {formatAt(e.at)}
            </Sans>
            <Sans size={12} color={c.ink2} style={{ flex: 1 }} numberOfLines={1}>
              {e.agent_key} · {e.event}
              {e.reason ? ` (${e.reason})` : ''}
            </Sans>
          </View>
        ))}
        {(history.data?.events ?? []).length === 0 && (
          <Sans size={12} color={c.ink3}>
            Sem eventos ainda.
          </Sans>
        )}
      </Section>
    </Screen>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = usePalette()
  return (
    <View style={{ marginBottom: 22 }}>
      <Sans weight="sb" size={11} color={c.ink3} style={{ letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
        {title}
      </Sans>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  )
}

function AgentCard({ a, onOff, c }: { a: FleetAgent; onOff?: () => void; c: ReturnType<typeof usePalette> }) {
  const dot = a.status === 'running' ? c.recRed : a.status === 'desired_dead' ? c.bronze : c.ink3
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bg,
      }}
    >
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: dot }} />
      <View style={{ flex: 1 }}>
        <Sans weight="sb" size={14} color={c.ink} numberOfLines={1}>
          {a.label}
        </Sans>
        <Sans size={12} color={c.ink2} numberOfLines={1}>
          {a.account}
        </Sans>
        <Sans size={11} color={c.ink3}>
          {a.status === 'running'
            ? `rodando · ${humanDuration(a.uptime_seconds)}${a.ttl_remaining_seconds !== null ? ` · TTL ${humanDuration(a.ttl_remaining_seconds)}` : ''}`
            : a.status === 'desired_dead'
              ? 'ligado (esperando subir)'
              : 'desligado'}
        </Sans>
      </View>
      {onOff && (
        <Pressable
          onPress={onOff}
          style={({ pressed }) => ({
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 9,
            borderWidth: 1,
            borderColor: c.recRed,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Sans weight="sb" size={12} color={c.recRed}>
            DESLIGAR
          </Sans>
        </Pressable>
      )}
    </View>
  )
}

function formatAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}
