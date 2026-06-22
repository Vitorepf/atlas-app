import { Pressable, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useActiveAgents } from '../lib/agents'

// PERSISTENT FLEET ALARM — always-visible when any autonomous agent is running, on every screen. This is the
// operator's hard requirement: nothing spends a provider account silently. Tapping it opens the full fleet
// screen (loops ativos + histórico + DESLIGAR). It renders NOTHING when the fleet is idle, so a quiet machine
// stays quiet.
export function ActiveAgentsBadge() {
  const c = usePalette()
  const router = useRouter()
  const { data } = useActiveAgents()

  const count = data?.active_count ?? 0
  if (count <= 0) return null

  const accounts = (data?.spending_accounts ?? []).join(' · ') || 'conta de provider'

  return (
    <View pointerEvents="box-none" style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
      <Pressable
        onPress={() => router.push('/agents' as Href)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 9,
          paddingHorizontal: 13,
          borderRadius: 11,
          backgroundColor: c.recRed,
          opacity: pressed ? 0.88 : 1,
        })}
      >
        <Sans size={14}>🔴</Sans>
        <Sans weight="sb" size={13} color={c.bg} numberOfLines={1} style={{ flex: 1 }}>
          {count} {count === 1 ? 'agente ativo' : 'agentes ativos'} gastando {accounts}
        </Sans>
        <Sans weight="sb" size={12} color={c.bg}>
          DESLIGAR ›
        </Sans>
      </Pressable>
    </View>
  )
}
