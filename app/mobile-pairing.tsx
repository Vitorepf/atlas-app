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
  AtlasApiError,
  clearMobileDeviceSession,
  confirmMobilePairing,
  getApiConfig,
  getMobileDeviceSession,
  hydrateApiConfig,
  listMobileDevices,
  recoverMobileDeviceSession,
  revokeMobileDevice,
  updateMobileNotificationPreferences,
  type AtlasMobileDevice,
  type AtlasNotificationPreferences,
  type MobileDevicesResponse,
  type MobileDeviceSession,
} from '../lib/api/client'

export default function MobilePairingScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'pair' | 'push' | 'prefs' | 'revoke' | null>(null)
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

      const currentSession = getMobileDeviceSession() ?? await recoverMobileDeviceSession()
      setSession(currentSession)
      if (!currentSession) {
        setDevice(null)
        return
      }

      try {
        const response = await listMobileDevices()
        setDevice(currentDeviceFromResponse(response, currentSession.deviceId))
      } catch (err) {
        // 401 já foi neutralizado em mobileApiRequest (sessão local limpa).
        // Aqui só ressincroniza o React state e cai pro form de re-pareamento.
        if (err instanceof AtlasApiError && err.status === 401) {
          setSession(null)
          setDevice(null)
          setPushResult(null)
          return
        }
        throw err
      }
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

  const revokePairing = async () => {
    if (busy) return

    setBusy('revoke')
    setError(null)
    const currentSession = session
    try {
      if (currentSession) {
        await revokeMobileDevice(currentSession.deviceId)
      } else {
        await clearMobileDeviceSession()
      }
      setSession(null)
      setDevice(null)
      setPushResult(null)
      showToast(currentSession ? 'device revogado' : 'pareamento local removido')
    } catch (err) {
      // 401 = servidor já não conhece esse device; mobileApiRequest limpou a
      // sessão local. Apenas ressincroniza o React state.
      if (err instanceof AtlasApiError && err.status === 401) {
        setSession(null)
        setDevice(null)
        setPushResult(null)
        showToast('sessão local removida')
        return
      }

      setError(err instanceof Error ? err.message : 'Falha ao revogar device mobile.')
    } finally {
      setBusy(null)
    }
  }

  const startRepair = async () => {
    if (busy) return
    setError(null)
    await clearMobileDeviceSession()
    setSession(null)
    setDevice(null)
    setPushResult(null)
    setCode('')
    showToast('pronto para parear de novo')
  }

  const updatePreferences = async (patch: Partial<AtlasNotificationPreferences>) => {
    if (!device || busy) return

    setBusy('prefs')
    setError(null)
    try {
      const response = await updateMobileNotificationPreferences({
        ...notificationPreferences(device),
        ...patch,
      })
      setDevice(response.device)
      showToast('preferências atualizadas', { durationMs: 1800 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar preferências.')
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
          Conecte este app ao seu Atlas server pra ativar Inbox operacional, push e deep links.
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
              <Label>Como obter o código</Label>

              <View style={styles.steps}>
                <Step number={1} text="No seu Mac, abra o terminal." />
                <View style={[styles.stepDivider, { backgroundColor: c.border }]} />
                <Step number={2} text="Rode o comando:" command="atlas mobile pair" />
                <View style={[styles.stepDivider, { backgroundColor: c.border }]} />
                <Step number={3} text="O CLI mostra um código (ex.: ABCD2345). Digite ele aqui em baixo." />
              </View>

              <View style={[styles.formDivider, { backgroundColor: c.border }]} />

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
              <Frau italic size={13} lineHeight={18} color={c.ink2}>
                O código expira em alguns minutos — gere e use logo.
              </Frau>
              <PrimaryButton
                label={busy === 'pair' ? 'Pareando...' : 'Parear este app'}
                onPress={canPair ? () => void pairDevice() : undefined}
                style={!canPair ? { opacity: 0.55 } : undefined}
              />
            </View>
          ) : (
            <>
              <NotificationPreferencesPanel
                device={device}
                disabled={busy !== null}
                updating={busy === 'prefs'}
                onToggle={(key, value) => void updatePreferences({ [key]: value })}
              />
              <View style={styles.actions}>
                <PrimaryButton
                  label={busy === 'push' ? 'Registrando push...' : 'Registrar push novamente'}
                  variant="secondary"
                  onPress={busy ? undefined : () => void registerPush()}
                />
                <PrimaryButton
                  label="Refazer pareamento"
                  variant="ghost"
                  onPress={busy ? undefined : () => void startRepair()}
                />
                <PrimaryButton
                  label={busy === 'revoke' ? 'Revogando...' : 'Revogar este device'}
                  variant="ghost"
                  onPress={busy ? undefined : () => void revokePairing()}
                />
                <PrimaryButton
                  label="Voltar para Inbox"
                  onPress={() => router.replace('/inbox')}
                />
              </View>
            </>
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

type VisibleNotificationPreferenceKey =
  | 'critical_push_enabled'
  | 'telemetry_health_push_enabled'
  | 'daily_report_push_enabled'

function NotificationPreferencesPanel({
  device,
  disabled,
  updating,
  onToggle,
}: {
  device: AtlasMobileDevice | null
  disabled: boolean
  updating: boolean
  onToggle: (key: VisibleNotificationPreferenceKey, value: boolean) => void
}) {
  const c = usePalette()
  if (!device) return null

  const preferences = notificationPreferences(device)

  return (
    <View style={[styles.preferencePanel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.preferenceHeader}>
        <Label>Notificações</Label>
        {updating ? <ActivityIndicator color={c.prussian} size="small" /> : null}
      </View>
      <View style={styles.preferenceRows}>
        <PreferenceRow
          label="Alertas críticos"
          detail="interrupção imediata"
          enabled={preferences.critical_push_enabled}
          disabled={disabled}
          onPress={() => onToggle('critical_push_enabled', !preferences.critical_push_enabled)}
        />
        <PreferenceRow
          label="Saúde do Atlas"
          detail="diagnóstico operacional"
          enabled={preferences.telemetry_health_push_enabled}
          disabled={disabled}
          onPress={() => onToggle('telemetry_health_push_enabled', !preferences.telemetry_health_push_enabled)}
        />
        <PreferenceRow
          label="Relatório da manhã"
          detail="resumo diário"
          enabled={preferences.daily_report_push_enabled}
          disabled={disabled}
          onPress={() => onToggle('daily_report_push_enabled', !preferences.daily_report_push_enabled)}
        />
      </View>
    </View>
  )
}

function PreferenceRow({
  label,
  detail,
  enabled,
  disabled,
  onPress,
}: {
  label: string
  detail: string
  enabled: boolean
  disabled: boolean
  onPress: () => void
}) {
  const c = usePalette()

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.preferenceRow,
        {
          borderTopColor: c.border,
          opacity: disabled ? 0.58 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={14} lineHeight={18} color={c.ink}>
          {label}
        </Sans>
        <Mono size={11} lineHeight={15} color={c.ink2} letterSpacing={0.32} style={{ marginTop: 2 }}>
          {detail}
        </Mono>
      </View>
      <View
        style={[
          styles.toggleTrack,
          {
            backgroundColor: enabled ? c.prussian : c.premium,
            borderColor: enabled ? c.prussian : c.border,
          },
        ]}
      >
        <View
          style={[
            styles.toggleKnob,
            {
              backgroundColor: enabled ? c.onInk : c.ink3,
              transform: [{ translateX: enabled ? 18 : 0 }],
            },
          ]}
        />
      </View>
    </Pressable>
  )
}

function Step({ number, text, command }: { number: number; text: string; command?: string }) {
  const c = usePalette()
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Mono size={13} lineHeight={18} color={c.bronze} letterSpacing={0.4}>
          {number}
        </Mono>
      </View>
      <View style={styles.stepBody}>
        <Sans size={14} lineHeight={20} color={c.ink}>
          {text}
        </Sans>
        {command ? (
          <View style={[styles.commandBox, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Mono size={13.5} lineHeight={18} color={c.ink} letterSpacing={0.2}>
              {command}
            </Mono>
          </View>
        ) : null}
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

const DEFAULT_NOTIFICATION_PREFERENCES: AtlasNotificationPreferences = {
  critical_push_enabled: true,
  telemetry_health_push_enabled: true,
  daily_report_push_enabled: true,
  quiet_hours_enabled: false,
}

function notificationPreferences(device: AtlasMobileDevice): AtlasNotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(device.notification_preferences ?? {}),
  }
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

function currentDeviceFromResponse(response: MobileDevicesResponse, deviceId: string): AtlasMobileDevice | null {
  if (response.current_device?.id) return response.current_device
  return response.devices.find((candidate) => candidate.id === (response.current_device_id ?? deviceId))
    ?? response.devices.find((candidate) => candidate.id === deviceId)
    ?? response.devices.find((candidate) => !candidate.revoked_at)
    ?? null
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
  preferencePanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  preferenceHeader: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  preferenceRows: {
    gap: 0,
  },
  preferenceRow: {
    minHeight: 62,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  toggleTrack: {
    width: 46,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  formPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
  },
  steps: {
    gap: 0,
    marginTop: 4,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 12,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBody: {
    flex: 1,
    gap: 8,
  },
  stepDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 36,
  },
  commandBox: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  formDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
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
