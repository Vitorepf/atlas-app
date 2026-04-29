import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { CapturePulse } from '../components/CapturePulse'
import { CaptureCounter } from '../components/CaptureCounter'
import { CaptureWave } from '../components/CaptureWave'
import { DomainChip } from '../components/DomainChip'
import { Frau, Sans } from '../design/Type'
import { useTheme } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import { useOverlays } from '../lib/overlays'
import { DOMAINS, type DomainKey } from '../lib/domains'
import { useAtlasStore } from '../lib/atlasStore'

export default function CaptureScreen() {
  const { c, name } = useTheme()
  const router = useRouter()
  const { pulseSync, showToast } = useShell()
  const openMic = useOverlays((s) => s.openMic)
  const createAudioCapture = useAtlasStore((s) => s.createAudioCapture)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(recorder, 150)
  const recordingRef = useRef(false)
  const [domain, setDomain] = useState<DomainKey>('blackink')
  const [starting, setStarting] = useState(true)
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function startRecording() {
      try {
        const permission = await requestRecordingPermissionsAsync()
        if (!permission.granted) {
          openMic()
          router.replace('/')
          return
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        })
        await recorder.prepareToRecordAsync()
        if (!mounted) return

        recorder.record()
        recordingRef.current = true
        setStarting(false)
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      } catch (recordingError) {
        if (!mounted) return
        setError(recordingError instanceof Error ? recordingError.message : 'Não foi possível iniciar a gravação.')
        setStarting(false)
      }
    }

    void startRecording()

    return () => {
      mounted = false
      if (recordingRef.current) {
        recordingRef.current = false
        try {
          recorder.stop().catch(() => {})
        } catch {
          // expo-audio can invalidate the native shared object during unmount.
        }
      }
      setAudioModeAsync({ allowsRecording: false }).catch(() => {})
    }
  }, [openMic, recorder, router])

  const handleStop = async () => {
    if (stopping || starting) return

    setStopping(true)
    setError(null)

    try {
      const durationMs = recorderState.durationMillis
      if (recordingRef.current || recorderState.isRecording) {
        recordingRef.current = false
        await recorder.stop()
      }

      const fileUri = safeRecorderUri(recorder) ?? recorderState.url
      if (!fileUri) {
        throw new Error('Gravação não gerou arquivo local.')
      }

      const location = await getOptionalLocation()

      await createAudioCapture({
        domain,
        fileUri,
        durationMs,
        capturedLat: location.lat,
        capturedLng: location.lng,
        metadata: location.metadata,
      })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast('Áudio capturado')
      pulseSync(2000)
      router.replace('/inbox')
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'Falha ao salvar captura.')
      setStopping(false)
    }
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.content}>
        <CapturePulse />
        <CaptureCounter running={recorderState.isRecording && !stopping} />
        <Frau italic size={18} lineHeight={26} color={c.ink2} style={{ maxWidth: 280, marginTop: 18 }}>
          {starting ? 'Preparando microfone…' : stopping ? 'Salvando captura…' : 'Fale o que está pensando. Atlas escuta.'}
        </Frau>
        {error && (
          <Sans size={13} lineHeight={18} color={c.recRed} style={{ maxWidth: 280, marginTop: 10 }}>
            {error}
          </Sans>
        )}

        <CaptureWave />

        <View style={styles.chipRow}>
          {DOMAINS.map((d) => (
            <DomainChip
              key={d.key}
              domain={d.key}
              label={d.label}
              active={d.key === domain}
              onPress={() => {
                Haptics.selectionAsync()
                setDomain(d.key)
              }}
            />
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={handleStop}
          disabled={starting || stopping}
          style={({ pressed }) => [
            styles.stop,
            {
              backgroundColor: c.ink,
              opacity: starting || stopping ? 0.45 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
              shadowColor: name === 'dark' ? '#000' : '#1C1916',
            },
          ]}
        >
          <View style={[styles.stopInner, { backgroundColor: c.bg }]} />
        </Pressable>
      </View>
    </View>
  )
}

function safeRecorderUri(recorder: ReturnType<typeof useAudioRecorder>): string | null {
  try {
    return recorder.uri
  } catch {
    return null
  }
}

async function getOptionalLocation(): Promise<{
  lat: number | null
  lng: number | null
  metadata: Record<string, unknown>
}> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync()
    if (!permission.granted) {
      return { lat: null, lng: null, metadata: { location_permission: 'denied' } }
    }

    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60 * 1000,
      requiredAccuracy: 500,
    })
    const position = lastKnown ?? await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      metadata: {
        location_accuracy_m: position.coords.accuracy,
        location_source: lastKnown ? 'last_known' : 'current',
      },
    }
  } catch (error) {
    return {
      lat: null,
      lng: null,
      metadata: {
        location_error: error instanceof Error ? error.message : 'unknown',
      },
    }
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flex: 1,
    paddingTop: 90,
    paddingBottom: 60,
    paddingHorizontal: 28,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 28,
  },
  stop: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  stopInner: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
})
