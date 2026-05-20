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
import { Keyboard, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Dock } from './Dock'
import { Frau, Sans } from '../design/Type'
import { useTheme } from '../design/theme'
import { OfflineBanner } from './OfflineBanner'
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

  // Track keyboard via ref (not state) to avoid re-rendering the shell — and
  // therefore the entire children tree — every time the keyboard toggles.
  // Used to skip sync ticks while the user is typing, which prevents the
  // re-render cascade that causes iOS to refocus multiline TextInputs.
  const keyboardVisibleRef = useRef(false)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      keyboardVisibleRef.current = true
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisibleRef.current = false
    })
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  // Initial sync whisper, then every 18s. Skip ticks while the keyboard is
  // open to keep TextInputs stable.
  useEffect(() => {
    const tick = () => {
      if (keyboardVisibleRef.current) return
      pulseSync(2200)
      void sync()
    }
    const t1 = setTimeout(tick, 800)
    const t2 = setInterval(tick, 18000)
    return () => {
      clearTimeout(t1)
      clearInterval(t2)
    }
  }, [pulseSync, sync])

  const value = useMemo(() => ({ pulseSync, showToast }), [pulseSync, showToast])
  const showOffline = !syncing && !reachable && queue > 0
  const showPending = !syncing && reachable && queue > 0 && Boolean(lastError)
  const showQueue = showOffline || showPending

  // Push the children down by the banner's content height (excluding the
  // safe-area top, which is already covered by each Screen's SafeAreaView)
  // when the banner is visible. Animation is synced with OfflineBanner's
  // own slide so the page content moves in lockstep.
  const bannerOffset = useSharedValue(0)
  useEffect(() => {
    bannerOffset.value = withTiming(showQueue ? BANNER_CONTENT_HEIGHT : 0, {
      duration: 320,
      easing: Easing.bezier(0.2, 0.7, 0.2, 1),
    })
  }, [bannerOffset, showQueue])
  const childrenWrapStyle = useAnimatedStyle(() => ({
    paddingTop: bannerOffset.value,
  }))

  return (
    <ShellContext.Provider value={value}>
      <View style={[styles.fill, { backgroundColor: c.bg }]}>
        <Animated.View style={[styles.fill, showQueue && { opacity: 0.85 }, childrenWrapStyle]}>
          {children}
        </Animated.View>
        {/* v13 · SyncBar removido · era a "listra bronze sweep animada" no topo,
            visível em toda tela durante sync activity. Junto com LiveStatus e
            NewCapturesPill removidos · header zone agora completamente silencioso.
            OfflineBanner abaixo já dá sinal visual de sync ("Sem conexão · fila local")
            mais informativo que hairline animada. */}
        <OfflineBanner visible={showQueue} queue={queue} label={showOffline ? 'Sem conexão' : 'Sync pendente'} />
        <Dock />
        <OverlayHost />
        {toast && <Toast key={toast.key} variant={toast.variant} msg={toast.msg} />}
      </View>
    </ShellContext.Provider>
  )
}

// Banner inner content height (paddingV 10 + content ~17 + paddingV 10 +
// hairline). The banner's safe-area top is already provided by each
// Screen's own SafeAreaView, so we only push down by the content portion.
const BANNER_CONTENT_HEIGHT = 38

interface ToastProps {
  msg: string
  variant: ToastVariant
}

function Toast({ msg, variant }: ToastProps) {
  const { c, name } = useTheme()
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
              shadowColor: name === 'dark' ? '#000' : '#1A1612',
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
