import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SyncBar } from './SyncBar'
import { Dock } from './Dock'
import { Frau, Sans } from '../design/Type'
import { useTheme } from '../design/theme'
import { OfflineBanner } from './OfflineBanner'
import { OfflineQueue } from './OfflineQueue'
import { OverlayHost } from './sheets/OverlayHost'
import { useAtlasStore } from '../lib/atlasStore'

interface ShellContextValue {
  pulseSync: (durationMs?: number) => void
  showToast: (msg: string, opts?: { variant?: ToastVariant; durationMs?: number }) => void
}

type ToastVariant = 'success' | 'checkin'

const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell(): ShellContextValue {
  const v = useContext(ShellContext)
  if (!v) throw new Error('useShell must be used inside <AtlasShell />')
  return v
}

interface Props {
  children: ReactNode
}

export function AtlasShell({ children }: Props) {
  const { c } = useTheme()
  const hydrate = useAtlasStore((s) => s.hydrate)
  const sync = useAtlasStore((s) => s.sync)
  const syncing = useAtlasStore((s) => s.syncing)
  const reachable = useAtlasStore((s) => s.serverReachable)
  const lastError = useAtlasStore((s) => s.lastError)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures.length)
  const queuedCheckins = useAtlasStore((s) => s.queuedCheckins.length)
  const queuedBehaviors = useAtlasStore((s) => s.queuedBehaviors.length)
  const queuedBehaviorLogs = useAtlasStore((s) => s.queuedBehaviorLogs.length)
  const queuedSignals = useAtlasStore((s) => s.queuedPassiveSignals.length)
  const queuedSnapshots = useAtlasStore((s) => s.queuedHealthSnapshots.length)
  const queue = queuedCaptures + queuedCheckins + queuedBehaviors + queuedBehaviorLogs + queuedSignals + queuedSnapshots

  const [syncActive, setSyncActive] = useState(false)
  const syncT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [toast, setToast] = useState<{ msg: string; variant: ToastVariant; key: number } | null>(null)
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pulseSync = useCallback((durationMs = 2200) => {
    setSyncActive(true)
    if (syncT.current) clearTimeout(syncT.current)
    syncT.current = setTimeout(() => setSyncActive(false), durationMs)
  }, [])

  const showToast = useCallback(
    (msg: string, opts?: { variant?: ToastVariant; durationMs?: number }) => {
      setToast({ msg, variant: opts?.variant ?? 'success', key: Date.now() })
      if (toastT.current) clearTimeout(toastT.current)
      toastT.current = setTimeout(() => setToast(null), opts?.durationMs ?? 1800)
    },
    [],
  )

  useEffect(() => {
    void hydrate().then(() => {
      void sync()
    })
  }, [hydrate, sync])

  // Initial sync whisper, then every 18s.
  useEffect(() => {
    const t1 = setTimeout(() => {
      pulseSync(2200)
      void sync()
    }, 800)
    const t2 = setInterval(() => {
      pulseSync(2200)
      void sync()
    }, 18000)
    return () => {
      clearTimeout(t1)
      clearInterval(t2)
    }
  }, [pulseSync, sync])

  const value = useMemo(() => ({ pulseSync, showToast }), [pulseSync, showToast])
  const showOffline = !syncing && !reachable && queue > 0
  const showPending = !syncing && reachable && queue > 0 && Boolean(lastError)
  const showQueue = showOffline || showPending

  return (
    <ShellContext.Provider value={value}>
      <View style={[styles.fill, { backgroundColor: c.bg }]}>
        <View style={[styles.fill, showQueue && { opacity: 0.85 }]}>{children}</View>
        <SyncBar active={syncActive || syncing} />
        <OfflineBanner visible={showQueue} queue={queue} label={showOffline ? 'Sem conexão' : 'Sync pendente'} />
        <OfflineQueue visible={showQueue} queue={queue} />
        <Dock />
        <OverlayHost />
        {toast && <Toast key={toast.key} variant={toast.variant} msg={toast.msg} />}
      </View>
    </ShellContext.Provider>
  )
}

interface ToastProps {
  msg: string
  variant: ToastVariant
}

function Toast({ msg, variant }: ToastProps) {
  const { c } = useTheme()
  const opacity = useSharedValue(0)
  const ty = useSharedValue(-8)

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })
    ty.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) })
  }, [opacity, ty])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }))

  const isCheckin = variant === 'checkin'

  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <SafeAreaView edges={['top']} style={styles.toastSafe}>
        <Animated.View
          style={[
            styles.toast,
            { marginTop: 16 },
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              shadowColor: '#1C1916',
            },
            animStyle,
          ]}
        >
        <View style={styles.toastIcon}>
          <Sans
            weight={isCheckin ? 'reg' : 'sb'}
            size={isCheckin ? 14 : 13}
            color={isCheckin ? c.bronze : c.moss}
          >
            {isCheckin ? '✦' : '✓'}
          </Sans>
        </View>
        {isCheckin ? (
          <Frau italic size={14} color={c.ink} numberOfLines={1}>
            {msg}
          </Frau>
        ) : (
          <Sans weight="med" size={14} letterSpacing={-0.07} color={c.ink} numberOfLines={1}>
            {msg}
          </Sans>
        )}
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  toastWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  toastSafe: {
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 6,
    maxWidth: 280,
  },
  toastIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
