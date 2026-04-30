import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { PrimaryButton } from '../components/PrimaryButton'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { fonts } from '../design/tokens'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import { registerAtlasPushNotifications, type AtlasPushRegistrationResult } from '../lib/pushNotifications'
import {
  clearMobileDeviceSession,
  confirmMobilePairing,
  getApiConfig,
  getMobileDeviceSession,
  hydrateApiConfig,
  listMobileDevices,
  type AtlasMobileDevice,
  type MobileDeviceSession,
} from '../lib/api/client'

export default function MobilePairingScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'pair' | 'push' | 'clear' | null>(null)
  const [session, setSession] = useState<MobileDeviceSession | null>(null)
  const [device, setDevice] = useState<AtlasMobileDevice | null>(null)
  const [serverLabel, setServerLabel] = useState('Atlas server')
  const [error, setError] = useState<string | null>(null)
  const [pushResult, setPushResult] = useState<AtlasPushRegistrationResult | null>(null)

  const normalizedCode = useMemo(() => normalizePairingCode(code), [code])
  const canPair = normalizedCode.length >= 4 && busy === null
  const paired = Boolean(session)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await hydrateApiConfig()
      const apiConfig = getApiConfig()
      setServerLabel(`${apiConfig.apiHost}:${apiConfig.apiPort}`)

      const currentSession = getMobileDeviceSession()
      setSession(currentSession)
      if (!currentSession) {
        setDevice(null)
        return
      }

      const response = await listMobileDevices()
      setDevice(response.devices.find((candidate) => candidate.id === currentSession.deviceId) ?? response.devices[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar pareamento mobile.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pairDevice = async () => {
    if (!canPair) return

    setBusy('pair')
    setError(null)
    setPushResult(null)
    try {
      const response = await confirmMobilePairing({
        code: normalizedCode,
        platform: pairingPlatform(),
        device_label: defaultDeviceLabel(),
        app_version: appVersion(),
        os_version: osVersion(),
        notification_permissions: 'unknown',
      })
      setDevice(response.device)
      setSession(getMobileDeviceSession())
      setCode('')

      const result = await registerAtlasPushNotifications()
      setPushResult(result)
      showToast(pushToast(result), { durationMs: 2400 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao parear device.')
    } finally {
      setBusy(null)
    }
  }

  const registerPush = async () => {
    if (!session || busy) return

    setBusy('push')
    setError(null)
    try {
      const result = await registerAtlasPushNotifications()
      setPushResult(result)
      if (result.status === 'registered') {
        await load()
      }
      showToast(pushToast(result), { durationMs: 2400 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar push.')
    } finally {
      setBusy(null)
    }
  }

  const clearPairing = async () => {
    if (busy) return

    setBusy('clear')
    setError(null)
    try {
      await clearMobileDeviceSession()
      setSession(null)
      setDevice(null)
      setPushResult(null)
      showToast('pareamento local removido')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Screen topExtra={18}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, { backgroundColor: pressed ? c.surface : c.premium, borderColor: c.border }]}
        >
          <Sans size={26} lineHeight={28} color={c.ink}>‹</Sans>
        </Pressable>
        <Mono size={11} color={c.ink2} letterSpacing={0.44}>
          {serverLabel}
        </Mono>
      </View>

      <View style={styles.hero}>
        <Label>Mobile Gateway</Label>
        <Frau size={42} lineHeight={44} color={c.ink} style={{ marginTop: 6 }}>
          Pareamento seguro
        </Frau>
        <Sans size={14} lineHeight={20} color={c.ink2} style={{ marginTop: 10 }}>
          Use o código gerado pelo Atlas CLI para habilitar Inbox operacional, push e deep links contextuais neste app.
        </Sans>
      </View>

      {loading ? (
        <View style={[styles.statusPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
          <ActivityIndicator color={c.prussian} />
          <Sans size={13} lineHeight={18} color={c.ink2} align="center">
            Carregando sessão mobile...
          </Sans>
        </View>
      ) : (
        <View style={styles.stack}>
          <StatusPanel
            paired={paired}
            device={device}
            session={session}
            pushResult={pushResult}
          />

          {!paired ? (
            <View style={[styles.formPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Sans weight="med" size={14} lineHeight={18} color={c.ink}>
                Código de pareamento
              </Sans>
              <TextInput
                value={code}
                onChangeText={(value) => setCode(normalizePairingCode(value))}
                placeholder="ABCD2345"
                placeholderTextColor={c.ink3}
                autoCapitalize="characters"
                autoCorrect={false}
                keyboardType="default"
                textContentType="oneTimeCode"
                selectionColor={c.ink}
                maxLength={8}
                style={[
                  styles.codeInput,
                  {
                    color: c.ink,
                    borderColor: c.border,
                    backgroundColor: c.bg,
                  },
                ]}
              />
              <Sans size={12} lineHeight={17} color={c.ink2}>
                Gere um código no servidor com `atlas mobile pair` e informe aqui antes de expirar.
              </Sans>
              <PrimaryButton
                label={busy === 'pair' ? 'Pareando...' : 'Parear este app'}
                onPress={canPair ? () => void pairDevice() : undefined}
                style={!canPair ? { opacity: 0.55 } : undefined}
              />
            </View>
          ) : (
            <View style={styles.actions}>
              <PrimaryButton
                label={busy === 'push' ? 'Registrando push...' : 'Registrar push novamente'}
                variant="secondary"
                onPress={busy ? undefined : () => void registerPush()}
              />
              <PrimaryButton
                label={busy === 'clear' ? 'Removendo...' : 'Remover pareamento local'}
                variant="ghost"
                onPress={busy ? undefined : () => void clearPairing()}
              />
              <PrimaryButton
                label="Voltar para Inbox"
                onPress={() => router.replace('/inbox')}
              />
            </View>
          )}
        </View>
      )}

      {error ? (
        <View style={[styles.errorPanel, { borderColor: c.recRed, backgroundColor: c.surface }]}>
          <Sans weight="med" size={13} lineHeight={18} color={c.recRed}>
            {error}
          </Sans>
        </View>
      ) : null}
    </Screen>
  )
}

function StatusPanel({
  paired,
  device,
  session,
  pushResult,
}: {
  paired: boolean
  device: AtlasMobileDevice | null
  session: MobileDeviceSession | null
  pushResult: AtlasPushRegistrationResult | null
}) {
  const c = usePalette()
  return (
    <View style={[styles.statusPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.statusHeader}>
        <View style={[styles.statusDot, { backgroundColor: paired ? c.prussian : c.ink3 }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sans weight="med" size={14} lineHeight={18} color={c.ink}>
            {paired ? 'Device pareado' : 'Device ainda não pareado'}
          </Sans>
          <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 3 }}>
            {paired ? pairedDescription(device, session) : 'A Inbox operacional usa um bearer próprio por device.'}
          </Sans>
        </View>
      </View>
      <View style={styles.statusRows}>
        <StatusRow label="Push" value={pushStatus(device, pushResult)} />
        <StatusRow label="Permissão" value={permissionStatus(device, pushResult)} />
        <StatusRow label="Plataforma" value={device?.platform ?? pairingPlatform()} />
      </View>
    </View>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  const c = usePalette()
  return (
    <View style={[styles.statusRow, { borderTopColor: c.border }]}>
      <Mono size={11} lineHeight={15} color={c.ink3} letterSpacing={0.3}>
        {label}
      </Mono>
      <Sans weight="med" size={12} lineHeight={16} color={c.ink} numberOfLines={1}>
        {value}
      </Sans>
    </View>
  )
}

function normalizePairingCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

function pairingPlatform(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios'
}

function defaultDeviceLabel(): string {
  return Device.deviceName ?? Device.modelName ?? `${Platform.OS} Atlas app`
}

function appVersion(): string | null {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? null
}

function osVersion(): string | null {
  return Device.osVersion ?? String(Platform.Version)
}

function pairedDescription(device: AtlasMobileDevice | null, session: MobileDeviceSession | null): string {
  if (device) return `${device.device_label} · ${shortId(device.id)}`
  if (session) return `Sessão local ativa · ${shortId(session.deviceId)}`
  return 'Sessão local ativa.'
}

function pushStatus(device: AtlasMobileDevice | null, result: AtlasPushRegistrationResult | null): string {
  if (result) return pushStatusLabel(result.status)
  if (device?.has_push_token) return 'registrado'
  return 'não registrado'
}

function permissionStatus(device: AtlasMobileDevice | null, result: AtlasPushRegistrationResult | null): string {
  return result?.permissionStatus ?? device?.notification_permissions ?? 'unknown'
}

function pushStatusLabel(status: AtlasPushRegistrationResult['status']): string {
  switch (status) {
    case 'registered': return 'registrado'
    case 'permission_denied': return 'permissão negada'
    case 'simulator': return 'simulador'
    case 'unpaired': return 'não pareado'
    case 'failed':
    default: return 'falhou'
  }
}

function pushToast(result: AtlasPushRegistrationResult): string {
  switch (result.status) {
    case 'registered': return 'push registrado'
    case 'permission_denied': return 'push sem permissão'
    case 'simulator': return 'push indisponível no simulador'
    case 'unpaired': return 'device ainda não pareado'
    case 'failed':
    default: return result.error ?? 'falha ao registrar push'
  }
}

function shortId(id: string): string {
  return id.length <= 10 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    marginBottom: 22,
  },
  stack: {
    gap: 14,
  },
  statusPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 5,
  },
  statusRows: {
    gap: 0,
  },
  statusRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  formPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
  },
  codeInput: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontFamily: fonts.monoMd,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 3,
  },
  actions: {
    gap: 10,
  },
  errorPanel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    padding: 14,
  },
})
